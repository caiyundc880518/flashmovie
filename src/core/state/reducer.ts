import type { Channel, GameState, ProjectStage } from '../types'
import { createRng, clamp, randInt, round1 } from '../rng'
import { uid, teamIds, pushNews } from './utils'
import { advanceWeek as tickAdvance } from '../tick/advance'
import { channelRevenue, computeFilmResult } from '../rules/scoring'
import { applyProjectGrowth } from '../rules/growth'
import { generateWorker } from '../generators/workerGen'
import { generateCandidates } from '../generators/workerGen'
import { ECONOMY } from '../config/economy'
import { SCRIPT_POOL } from '../config/scripts'
import { INVESTOR_CONFIG, SCHOOL_CONFIG } from '../config/company'
import { IP_CONFIG } from '../config/ip'
import { RECRUIT_POOLS } from '../config/recruit'
import { ipLevel, refreshIpDerived, royaltyPerQuarter, sequelBonusFactor } from '../rules/ip'
import { TIMING_CONFIG } from '../config/minigame'
import type { Action } from './actions'
import type { IpAsset } from '../types'

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

    case 'refreshCandidates': {
      // 花钱刷新招聘市场（三档抽卡式，GDD §4.4）
      const cfg = RECRUIT_POOLS.find((p) => p.id === action.pool)
      if (!cfg) return state
      if (draft.company.cash < cfg.cost) return state
      draft.company.cash = round1(draft.company.cash - cfg.cost)
      const count = randInt(rng, cfg.count[0], cfg.count[1])
      const candidates = generateCandidates(rng, count, cfg.id)
      for (const c of candidates) c.id = uid(draft, 'wrk')
      draft.world.candidates = candidates
      pushNews(draft, `花费 ${cfg.cost} 万刷新「${cfg.label}」，${count} 位新人进入招聘市场。`)
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
      // 流程约束：同一剧本只能立项一次（含已上映的历史项目）
      if (draft.projects.some((p) => p.scriptId === action.scriptId)) return state
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
      // 续作立项（GDD §3.8）：须与 IP 同类型；自带初始热度
      let ipId: string | undefined
      let ipEntry: number | undefined
      let hype = 0
      if (action.ipId) {
        const ip = draft.company.ips.find((x) => x.id === action.ipId)
        if (!ip || script.type !== ip.type) return state
        ipId = ip.id
        ipEntry = ip.entry + 1
        hype = clamp(IP_CONFIG.sequelHypeBase + ip.level * IP_CONFIG.sequelHypePerLevel, 0, 100)
      }
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
        hype,
        marketingBudget: 0,
        budget: round1(budget),
        spent: 0,
        editStyle: null,
        buffs: 0,
        apAdjust: 0,
        pendingEvents: [],
        channels: [] as Channel[],
        ipId,
        ipEntry,
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
      if (ipId) {
        const ip = draft.company.ips.find((x) => x.id === ipId)
        pushNews(
          draft,
          `《${ip?.name}》第 ${ipEntry} 部立项！${ip ? `IP Lv.${ip.level}` : ''} 自带热度 ${hype}。`,
        )
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
      if (!p || p.stage !== 'shooting') return state
      p.buffs += TIMING_CONFIG.shotBuff[action.quality]
      break
    }

    case 'applyEditBuff': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'editing') return state
      p.buffs += TIMING_CONFIG.editBuff[action.quality]
      break
    }

    case 'setChannels': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing') return state
      p.channels = action.channels.filter((c, i, arr) => arr.indexOf(c) === i)
      break
    }

    case 'selectPublisher': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing' || p.publisherId) return state
      const pub = draft.world.publishers.find((x) => x.id === action.publisherId)
      if (!pub) return state
      let prepay = Math.round(pub.prepayBase + pub.reputation * pub.prepayPerRep)
      // 续作投资溢价：发行商更愿意为成熟 IP 系列预付（GDD §3.8）
      if (p.ipId) {
        const ip = draft.company.ips.find((x) => x.id === p.ipId)
        if (ip) prepay = Math.round(prepay * (1 + ip.level * IP_CONFIG.publisherPrepayPerLevel))
      }
      draft.company.cash += prepay
      p.publisherId = pub.id
      pushNews(draft, `与发行商「${pub.name}」签约，获得预付款 ${prepay} 万元。`)
      break
    }

    case 'upgradeSchool': {
      const next = draft.company.schoolLevel + 1
      if (next >= SCHOOL_CONFIG.upgradeCost.length) return state
      const cost = SCHOOL_CONFIG.upgradeCost[next]
      if (draft.company.cash < cost) return state
      draft.company.cash -= cost
      draft.company.schoolLevel = next
      pushNews(draft, `写作学校升级到 ${next} 级，编剧产出质量提升。`)
      break
    }

    case 'signInvestor': {
      if (draft.company.investor) return state
      const inv = draft.world.investors.find((x) => x.id === action.investorId)
      if (!inv) return state
      const investment = Math.round(
        inv.investmentBase + draft.company.reputation * inv.investmentPerRep,
      )
      draft.company.cash += investment
      draft.company.investor = {
        id: inv.id,
        name: inv.name,
        share: inv.share,
        remainingToCollect: Math.round(investment * INVESTOR_CONFIG.repayMultiplier),
      }
      pushNews(
        draft,
        `投资人「${inv.name}」注资 ${investment} 万元，将按 ${Math.round(inv.share * 100)}% 分成片方收入直至回收 ${Math.round(investment * INVESTOR_CONFIG.repayMultiplier)} 万元。`,
      )
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
      // 渠道结算：票房 × 各渠道系数；发行商：预付款 + 后端分成
      const channels: Channel[] = p.channels.length > 0 ? p.channels : ['cinema']
      const baseRevenue = channelRevenue(p, result.boxOffice)
      const publisher = p.publisherId
        ? draft.world.publishers.find((x) => x.id === p.publisherId)
        : undefined
      const backEnd = publisher ? baseRevenue * (1 - publisher.shareRate) : baseRevenue
      const prepayment = publisher
        ? Math.round(publisher.prepayBase + publisher.reputation * publisher.prepayPerRep)
        : 0
      const revenue = backEnd + prepayment
      draft.company.cash += round1(revenue)
      // 投资人分成：按片方收入比例扣除，直至回收完毕退出
      const investor = draft.company.investor
      if (investor) {
        const investorIncome = revenue * investor.share
        draft.company.cash -= round1(investorIncome)
        investor.remainingToCollect = round1(investor.remainingToCollect - investorIncome)
        if (investor.remainingToCollect <= 0) {
          draft.company.investor = undefined
          pushNews(draft, `投资人「${investor.name}」已回收全部投资，退出公司。`)
        }
      }
      // 免费渠道：换口碑
      let repGain = result.reputationGain
      if (channels.includes('free')) repGain = clamp(repGain + 2, -3, 6)
      draft.company.reputation = clamp(draft.company.reputation + repGain, 0, 100)
      // IP 售后与续作（GDD §3.8）：续作成长已有 IP；首作达标则沉淀新 IP
      let ipName: string | undefined
      let ipEntry: number | undefined
      const sequelIp = p.ipId ? draft.company.ips.find((x) => x.id === p.ipId) : undefined
      if (sequelIp) {
        sequelIp.entry = Math.max(sequelIp.entry, p.ipEntry ?? sequelIp.entry + 1)
        sequelIp.totalBoxOffice = round1(sequelIp.totalBoxOffice + result.boxOffice)
        sequelIp.bestBoxOffice = Math.max(sequelIp.bestBoxOffice, result.boxOffice)
        sequelIp.bestCriticScore = Math.max(sequelIp.bestCriticScore, result.criticScore)
        sequelIp.films.push(p.id)
        const prevLevel = sequelIp.level
        refreshIpDerived(sequelIp)
        if (sequelIp.level > prevLevel) {
          pushNews(
            draft,
            `《${sequelIp.name}》系列累计票房突破 ${Math.round(sequelIp.totalBoxOffice)} 万，IP 升级至 Lv.${sequelIp.level}！`,
          )
        }
        ipName = sequelIp.name
        ipEntry = sequelIp.entry
      } else if (
        result.boxOffice >= IP_CONFIG.originBoxOffice &&
        result.criticScore >= IP_CONFIG.originCriticScore
      ) {
        const type = draft.scripts[p.scriptId]?.type ?? 'drama'
        const lv = ipLevel(result.boxOffice)
        const newIp: IpAsset = {
          id: uid(draft, 'ip'),
          name: p.name,
          type,
          entry: 1,
          originWeek: draft.calendar.week,
          originYear: draft.calendar.year,
          totalBoxOffice: round1(result.boxOffice),
          bestBoxOffice: round1(result.boxOffice),
          bestCriticScore: result.criticScore,
          level: lv,
          royaltyPerQuarter: royaltyPerQuarter(lv),
          sequelBonus: sequelBonusFactor(lv),
          royaltyEarned: 0,
          films: [p.id],
        }
        draft.company.ips.push(newIp)
        pushNews(
          draft,
          `《${p.name}》票房 ${Math.round(result.boxOffice)} 万、影评 ${result.criticScore} 分，沉淀为公司 IP（Lv.${lv}），可立项续作！`,
        )
        ipName = newIp.name
        ipEntry = 1
      }
      const settlements = applyProjectGrowth(draft, p, result)
      p.result = {
        ...result,
        revenue: round1(revenue),
        channels,
        publisherName: publisher?.name,
        ipName,
        ipEntry,
        settlement: settlements,
      }
      p.stage = 'released'
      p.releasedWeek = draft.calendar.week
      draft.company.history.push(p.result)
      for (const id of teamIds(p.team)) {
        const w = draft.workers[id]
        if (w) w.currentProjectId = null
      }
      pushNews(
        draft,
        `《${p.name}》上映！票房 ${Math.round(result.boxOffice)} 万元，AP ${result.ap} / MP ${result.mp}。`,
      )
      pushNews(draft, `《${p.name}》口碑出炉：影评人平均 ${result.criticScore} 分。`)
      break
    }
  }

  draft.seed = (draft.seed + 1) >>> 0
  draft.company.cash = round1(draft.company.cash)
  return draft
}
