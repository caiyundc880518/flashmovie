import type { GameState, ProjectStage } from '../types'
import { createRng, clamp, randInt, round1 } from '../rng'
import { uid, teamIds, pushNews } from './utils'
import { advanceWeek as tickAdvance } from '../tick/advance'
import { computeFilmResult } from '../rules/scoring'
import { applyProjectGrowth } from '../rules/growth'
import { generateWorker } from '../generators/workerGen'
import { ECONOMY } from '../config/economy'
import { SCRIPT_POOL } from '../config/scripts'
import type { Action } from './actions'

/**
 * 状态容器：纯函数 reduce(action, state) → state
 * 采用结构化克隆（structuredClone）后原地修改的"草稿"模式，
 * 保证返回全新引用（zustand 触发更新），且 V1 状态量小、成本可接受。
 */
export function reduce(state: GameState, action: Action): GameState {
  const draft = structuredClone(state)
  const rng = createRng(draft.seed)

  switch (action.type) {
    case 'advanceWeek': {
      tickAdvance(draft, rng)
      break
    }

    case 'buyScript': {
      const idx = draft.world.marketScripts.findIndex((s) => s.id === action.scriptId)
      if (idx < 0) return state
      const script = draft.world.marketScripts[idx]
      if (draft.company.cash < script.price) return state
      draft.company.cash -= script.price
      script.owner = 'company'
      draft.scripts[script.id] = script
      draft.company.ownedScriptIds.push(script.id)
      draft.world.marketScripts.splice(idx, 1)
      break
    }

    case 'sellScript': {
      const script = draft.scripts[action.scriptId]
      if (!script || script.owner !== 'company') return state
      const gain = Math.max(
        script.marketPot * ECONOMY.scriptSellPerMarketPot,
        ECONOMY.scriptSellFloor,
      )
      draft.company.cash += gain
      draft.company.ownedScriptIds = draft.company.ownedScriptIds.filter((id) => id !== script.id)
      delete draft.scripts[script.id]
      break
    }

    case 'hireWriter': {
      if (draft.company.cash < ECONOMY.hireWriterSignFee) return state
      const w = generateWorker(rng, 'writer', 'rookie')
      w.id = uid(draft, 'wrk')
      draft.workers[w.id] = w
      draft.company.employeeIds.push(w.id)
      draft.company.cash -= ECONOMY.hireWriterSignFee
      draft.writerQueues[w.id] = randInt(
        rng,
        SCRIPT_POOL.writerProduceWeeks[0],
        SCRIPT_POOL.writerProduceWeeks[1],
      )
      pushNews(draft, `签约编剧 ${w.name}，开始创作剧本。`)
      break
    }

    case 'hireWorker': {
      if (draft.company.cash < ECONOMY.hireWorkerSignFee) return state
      const idx = draft.world.candidates.findIndex((c) => c.id === action.candidateId)
      if (idx < 0) return state
      const w = draft.world.candidates[idx]
      draft.company.cash -= ECONOMY.hireWorkerSignFee
      draft.workers[w.id] = w
      draft.company.employeeIds.push(w.id)
      draft.world.candidates.splice(idx, 1)
      pushNews(draft, `${w.name} 加入公司（${w.role}）。`)
      break
    }

    case 'fireWorker': {
      draft.company.employeeIds = draft.company.employeeIds.filter((id) => id !== action.workerId)
      const w = draft.workers[action.workerId]
      if (w) {
        w.currentProjectId = null
        w.idleWeeks = 0
      }
      break
    }

    case 'takeLoan': {
      const cap = Math.max(0, draft.company.cash * ECONOMY.loanCapFactor)
      const amount = Math.min(Math.max(0, action.amount), cap)
      if (amount <= 0) return state
      draft.company.cash += amount
      draft.company.loans.push({
        id: uid(draft, 'ln'),
        principal: amount,
        rate: ECONOMY.loanRate,
        weeksLeft: ECONOMY.loanWeeks,
      })
      pushNews(draft, `获得银行贷款 ${Math.round(amount)} 万元。`)
      break
    }

    case 'repayLoan': {
      const loan = draft.company.loans.find((l) => l.id === action.loanId)
      if (!loan) return state
      draft.company.cash -= loan.principal
      draft.company.loans = draft.company.loans.filter((l) => l.id !== loan.id)
      break
    }

    case 'startProject': {
      const script = draft.scripts[action.scriptId]
      if (!script || script.owner !== 'company') return state
      if (
        !action.team.directorId ||
        action.team.actorIds.length === 0 ||
        !action.team.shooterId ||
        !action.team.editorId ||
        !action.team.marketId
      ) {
        return state
      }
      const vfx = clamp(action.vfxPercent, 0, 100)
      const budget = script.scale * ECONOMY.costPerStage * (1 + (vfx / 100) * ECONOMY.vfxCostFactor)
      const stage: ProjectStage = 'preparing'
      draft.projects.push({
        id: uid(draft, 'prj'),
        name: script.title,
        scriptId: script.id,
        stage,
        team: action.team,
        totalStages: script.scale,
        shotStages: 0,
        vfxPercent: vfx,
        hasAd: action.hasAd,
        hype: 0,
        marketingBudget: 0,
        budget: round1(budget),
        spent: 0,
        editStyle: null,
        buffs: 0,
        apAdjust: 0,
        pendingEvents: [],
      })
      const projectId = draft.projects[draft.projects.length - 1].id
      for (const id of teamIds(action.team)) {
        const w = draft.workers[id]
        if (w) w.currentProjectId = projectId
      }
      if (action.hasAd) {
        draft.company.cash += ECONOMY.adDealIncome
        pushNews(draft, `《${script.title}》接受植入广告，获得 ${ECONOMY.adDealIncome} 万元赞助。`)
      }
      break
    }

    case 'startShooting': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'preparing') return state
      p.stage = 'shooting'
      const deposit = p.budget * 0.1
      p.spent = round1(p.spent + deposit)
      draft.company.cash -= deposit
      pushNews(draft, `《${p.name}》正式开拍！`)
      break
    }

    case 'chooseEditStyle': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'editing') return state
      const editorSkill = draft.workers[p.team.editorId ?? '']?.skills.edit ?? 40
      const buff = Math.max(0, Math.round((editorSkill - 40) / 10) + randInt(rng, 0, 3))
      p.editStyle = action.style
      if (action.style === 'market') {
        p.buffs += buff
        p.hype = clamp(p.hype + buff, 0, 100)
      } else {
        p.apAdjust += buff
      }
      p.stage = 'marketing'
      break
    }

    case 'setMarketingBudget': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p) return state
      p.marketingBudget = clamp(action.budget, 0, ECONOMY.marketingBudgetCap)
      break
    }

    case 'launchMarketing': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing') return state
      const cost = Math.min(p.marketingBudget, ECONOMY.marketingBudgetCap)
      if (draft.company.cash < cost) return state
      draft.company.cash -= cost
      p.marketingBudget -= cost
      const marketSkill = draft.workers[p.team.marketId ?? '']?.skills.market ?? 30
      const advSkill = draft.workers[p.team.marketId ?? '']?.skills.advertise ?? 30
      p.hype = clamp(
        p.hype + cost / ECONOMY.costPerHypePoint + marketSkill * 0.15 + advSkill * 0.1,
        0,
        100,
      )
      break
    }

    case 'applyShotBuff': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p) return state
      p.buffs += action.success ? randInt(rng, 2, 5) : -randInt(rng, 1, 3)
      break
    }

    case 'resolveEvent': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p) return state
      const ev = p.pendingEvents.find((e) => e.id === action.eventId)
      if (!ev) return state
      const opt = ev.options[action.optionIndex]
      if (!opt) return state
      if (opt.cash) draft.company.cash += opt.cash
      if (opt.morale) {
        for (const id of teamIds(p.team)) {
          const w = draft.workers[id]
          if (w) w.active.mood = clamp(w.active.mood + opt.morale, 10, 95)
        }
      }
      if (opt.buff) p.buffs += opt.buff
      if (opt.hype) p.hype = clamp(p.hype + opt.hype, 0, 100)
      if (opt.ap) p.apAdjust += opt.ap
      p.pendingEvents = p.pendingEvents.filter((e) => e.id !== action.eventId)
      break
    }

    case 'release': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing') return state
      const result = computeFilmResult(draft, p, rng)
      const revenue = result.boxOffice * ECONOMY.cinemaShare
      draft.company.cash += round1(revenue)
      draft.company.reputation = clamp(
        draft.company.reputation + result.reputationGain,
        0,
        100,
      )
      applyProjectGrowth(draft, p, result)
      p.result = result
      p.stage = 'released'
      p.releasedWeek = draft.calendar.week
      draft.company.history.push(result)
      for (const id of teamIds(p.team)) {
        const w = draft.workers[id]
        if (w) w.currentProjectId = null
      }
      pushNews(
        draft,
        `《${p.name}》上映！票房 ${Math.round(result.boxOffice)} 万元，AP ${result.ap} / MP ${result.mp}。`,
      )
      break
    }
  }

  draft.seed = (draft.seed + 1) >>> 0
  draft.company.cash = round1(draft.company.cash)
  return draft
}
