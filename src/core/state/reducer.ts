import type { GameState, ProjectStage } from '../types'
import { createRng, clamp, randInt, round1 } from '../rng'
import { uid, teamIds, pushNews } from './utils'
import { advanceWeek as tickAdvance } from '../tick/advance'
import {
  createRun,
  createRunConfigForChannel,
  endRun,
  initRunState,
  isLowerChannel,
} from '../tick/distribution'
import { computeFilmResult } from '../rules/scoring'
import { generateWorker } from '../generators/workerGen'
import { generateCandidates } from '../generators/workerGen'
import { ECONOMY } from '../config/economy'
import { SCRIPT_POOL } from '../config/scripts'
import { INVESTOR_CONFIG, IPO_CONFIG, SCHOOL_CONFIG } from '../config/company'
import { IP_CONFIG, IP_LONGTAIL_CONFIG } from '../config/ip'
import { RECRUIT_POOLS } from '../config/recruit'
import { ROLES } from '../config/roles'
import { TEN_PULL_DISCOUNT, WRITER_POOLS } from '../config/writers'
import { TECH_CONFIG, TECH_LINES, techLevel } from '../config/tech'
import { techBonuses } from '../rules/tech'
import { TIMING_CONFIG } from '../config/minigame'
import { VFX_CONFIG } from '../config/minigame'
import { BUDGET_CONFIG } from '../config/budget'
import { AD_CONFIG, AD_SPONSOR_MAP } from '../config/ads'
import { CHANNEL_CONFIG, CHANNEL_INFO, TOTAL_CINEMAS, WEB_PLATFORMS } from '../config/channels'
import { availableVfxTiers } from '../rules/scoring'
import type { Action } from './actions'
import type { SkillKey } from '../types'

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
      const idx = draft.world.candidates.findIndex((c) => c.id === action.candidateId)
      if (idx < 0) return state
      const w = draft.world.candidates[idx]
      // 作弊人才免费雇佣
      const fee = w.cheat ? 0 : ECONOMY.hireWorkerSignFee
      if (draft.company.cash < fee) return state
      draft.company.cash -= fee
      draft.workers[w.id] = w
      draft.company.employeeIds.push(w.id)
      draft.world.candidates.splice(idx, 1)
      pushNews(draft, `${w.name} 加入公司（${w.role}）。`)
      break
    }

    case 'hireCandidates': {
      // 批量雇佣：抽卡结果一键签约（逐人校验现金，一次新闻）；作弊人才免费
      let hired = 0
      for (const id of action.candidateIds) {
        const idx = draft.world.candidates.findIndex((c) => c.id === id)
        if (idx < 0) continue
        const w = draft.world.candidates[idx]
        const fee = w.cheat ? 0 : ECONOMY.hireWorkerSignFee
        if (draft.company.cash < fee) continue
        draft.company.cash = round1(draft.company.cash - fee)
        draft.workers[w.id] = w
        draft.company.employeeIds.push(w.id)
        draft.world.candidates.splice(idx, 1)
        hired++
      }
      if (hired > 0) {
        pushNews(
          draft,
          `批量签约 ${hired} 位新人加入公司（签约费共 ${Math.round(ECONOMY.hireWorkerSignFee * hired)} 万）。`,
        )
      }
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
      // 花钱抽招聘市场（三档卡池，单演员计价，1 抽 / 10 连；可定向抽取职位，GDD §4.4）
      const cfg = RECRUIT_POOLS.find((p) => p.id === action.pool)
      if (!cfg) return state
      const total = round1(cfg.cost * action.count * (action.count === 10 ? TEN_PULL_DISCOUNT : 1))
      if (draft.company.cash < total) return state
      draft.company.cash = round1(draft.company.cash - total)
      const candidates = generateCandidates(rng, action.count, cfg.id, action.role)
      for (const c of candidates) c.id = uid(draft, 'wrk')
      draft.world.candidates = candidates
      const focus = action.role ? `定向「${ROLES[action.role].nameZh}」` : '随机职位'
      pushNews(
        draft,
        `花费 ${total} 万在「${cfg.label}」${action.count === 10 ? '10 连' : '抽取'}（${focus}），${action.count} 位新人进入招聘市场。`,
      )
      break
    }

    case 'drawScripts': {
      // 签约编剧抽卡：三档委托创作，10 连 9 折（GDD §3.1）
      const cfg = WRITER_POOLS.find((p) => p.id === action.pool)
      if (!cfg) return state
      const total = round1(cfg.price * action.count * (action.count === 10 ? TEN_PULL_DISCOUNT : 1))
      if (draft.company.cash < total) return state
      draft.company.cash = round1(draft.company.cash - total)
      for (let i = 0; i < action.count; i++) {
        draft.scriptDrafts.push({
          id: uid(draft, 'dft'),
          tier: cfg.id,
          weeksLeft: randInt(rng, cfg.produceWeeks[0], cfg.produceWeeks[1]),
        })
      }
      pushNews(
        draft,
        `委托「${cfg.label}」${action.count === 10 ? '10 连' : ''}创作剧本，花费 ${total} 万，${action.count} 部约 ${cfg.produceWeeks[0]}–${cfg.produceWeeks[1]} 周后陆续到货。`,
      )
      break
    }

    case 'takeLoan': {
      // 上市后贷款额度提升（大规模扩张，GDD §3.1）
      const factor = draft.company.public
        ? IPO_CONFIG.loanCapFactorAfter
        : ECONOMY.loanCapFactor
      const cap = Math.max(0, draft.company.cash * factor)
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
      // 预算占比校验：单项 0–100，总和 ≤ 100
      const alloc = {
        story: clamp(action.budgetAlloc?.story ?? 0, 0, 100),
        vfx: clamp(action.budgetAlloc?.vfx ?? 0, 0, 100),
        acting: clamp(action.budgetAlloc?.acting ?? 0, 0, 100),
        edit: clamp(action.budgetAlloc?.edit ?? 0, 0, 100),
      }
      if (alloc.story + alloc.vfx + alloc.acting + alloc.edit > BUDGET_CONFIG.totalCap) return state
      // 特效档位：clamp 到技术员可解锁范围
      const techSkill = draft.workers[action.team.technicianId ?? '']?.skills.vfx ?? 40
      const maxLevel = availableVfxTiers(techSkill).length - 1
      const vfxLevel = clamp(action.vfxLevel ?? 0, 0, maxLevel)
      const tier = VFX_CONFIG.tiers[vfxLevel]
      // 广告商校验：存在、去重、上限
      const adSponsorIds = [...new Set(action.adSponsorIds ?? [])].filter((id) => AD_SPONSOR_MAP[id])
      if (adSponsorIds.length > AD_CONFIG.maxSponsors) return state
      // 虚拟制片科技：降低 VFX 预算成本（GDD §5 科技树）
      const studioDiscount = 1 - techBonuses(draft).studio
      const base = script.scale * ECONOMY.costPerStage
      // 预算 = 基础 + VFX 投入（档位成本系数）× 虚拟制片折扣 + 其他侧重投入
      const budget =
        base +
        base * (alloc.vfx / 100) * ECONOMY.vfxCostFactor * studioDiscount * tier.costMul +
        base * ((alloc.story + alloc.acting + alloc.edit) / 100) * BUDGET_CONFIG.allocCostFactor
      const stage: ProjectStage = 'preparing'
      // 续作立项（GDD §3.8）：须与 IP 同类型；自带初始热度；项目名 = 系列名 + 部数
      let ipId: string | undefined
      let ipEntry: number | undefined
      let hype = 0
      let projectName = script.title
      if (action.ipId) {
        const ip = draft.company.ips.find((x) => x.id === action.ipId)
        if (!ip || script.type !== ip.type) return state
        ipId = ip.id
        ipEntry = ip.entry + 1
        projectName = `${ip.name} ${ipEntry}`
        hype = clamp(IP_CONFIG.sequelHypeBase + ip.level * IP_CONFIG.sequelHypePerLevel, 0, 100)
      }
      draft.projects.push({
        id: uid(draft, 'prj'),
        name: projectName,
        scriptId: script.id,
        stage,
        team: action.team,
        totalStages: script.scale,
        shotStages: 0,
        budgetAlloc: alloc,
        vfxLevel,
        adSponsorIds,
        hype,
        budget: round1(budget),
        spent: 0,
        editStyle: null,
        buffs: 0,
        apAdjust: 0,
        pendingEvents: [],
        channel: null,
        cinemaCount: 0,
        webPlatforms: [],
        webWeeks: 0,
        dvdPrice: 0,
        freeAdPrice: 0,
        warmup: 0,
        shotGameBonus: 0,
        pendingShotGame: false,
        editGameDone: false,
        editGameBonus: 0,
        ipId,
        ipEntry,
      })
      const projectId = draft.projects[draft.projects.length - 1].id
      for (const id of teamIds(action.team)) {
        const w = draft.workers[id]
        if (w) w.currentProjectId = projectId
      }
      if (adSponsorIds.length > 0) {
        pushNews(
          draft,
          `《${script.title}》与 ${adSponsorIds.length} 家广告商达成植入合作（${adSponsorIds
            .map((id) => AD_SPONSOR_MAP[id].name)
            .join('、')}），达标后到账赞助费。`,
        )
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
      if (!p || p.stage !== 'editing' || !p.editGameDone) return state
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

    case 'setWarmup': {
      // 筹备：投入预热成本（扣现金，MP 加成无上限）
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'preparing') return state
      const amount = Math.max(0, Math.round(action.amount))
      if (amount <= 0) return state
      if (draft.company.cash < amount) return state
      draft.company.cash = round1(draft.company.cash - amount)
      p.warmup = round1(p.warmup + amount)
      p.spent = round1(p.spent + amount)
      pushNews(draft, `《${p.name}》筹备预热投入 ${amount} 万（累计 ${Math.round(p.warmup)} 万，MP 加成 +${Math.round(p.warmup / ECONOMY.warmupPerMp)}）。`)
      break
    }

    case 'applyShotGame': {
      // 拍摄小游戏（被动触发）：3 轮判定 → 完美越多 AP/MP 加成越高；全失败无效果
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'shooting' || !p.pendingShotGame) return state
      const perfect = action.qualities.filter((q) => q === 'perfect').length
      const good = action.qualities.filter((q) => q === 'good').length
      const bonus = perfect * 2 + good * 1
      p.shotGameBonus = round1(p.shotGameBonus + bonus)
      p.pendingShotGame = false
      if (bonus > 0) {
        pushNews(draft, `《${p.name}》拍摄小游戏：${perfect} 完美 ${good} 不错，成片 AP/MP 加成 +${bonus}。`)
      } else {
        pushNews(draft, `《${p.name}》拍摄小游戏全部失误，无加成。`)
      }
      break
    }

    case 'applyEditGame': {
      // 剪辑小游戏（强制完成才能推进）：3 轮判定 → 完美越多 AP/MP 加成越高
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'editing' || p.editGameDone) return state
      const perfect = action.qualities.filter((q) => q === 'perfect').length
      const good = action.qualities.filter((q) => q === 'good').length
      const bonus = perfect * 2 + good * 1
      p.editGameBonus = round1(p.editGameBonus + bonus)
      p.editGameDone = true
      if (bonus > 0) {
        pushNews(draft, `《${p.name}》剪辑完成：${perfect} 完美 ${good} 不错，成片 AP/MP 加成 +${bonus}。`)
      } else {
        pushNews(draft, `《${p.name}》剪辑完成，节奏平平无加成。`)
      }
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

    case 'setChannel': {
      // 宣发：单选发行渠道（流媒体已取消、发行商已取消）；选定渠道视为宣发投入，提升热度
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing') return state
      if (p.channel !== action.channel) {
        p.channel = action.channel
        p.hype = clamp(p.hype + 8, 0, 100)
      }
      break
    }

    case 'setCinemaCount': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing' || p.channel !== 'cinema') return state
      const prev = p.cinemaCount
      p.cinemaCount = clamp(Math.round(action.count), 0, TOTAL_CINEMAS)
      // 投放更多影院 → 热度小幅提升（宣发力度）
      const delta = Math.floor((p.cinemaCount - prev) / 100)
      if (delta > 0) p.hype = clamp(p.hype + delta, 0, 100)
      break
    }

    case 'setWebConfig': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing' || p.channel !== 'web') return state
      const valid = WEB_PLATFORMS.filter((x) => action.platforms.includes(x))
      p.webPlatforms = [...new Set(valid)]
      p.webWeeks = clamp(Math.round(action.weeks), 1, 52)
      break
    }

    case 'setDvdPrice': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing' || p.channel !== 'dvd') return state
      p.dvdPrice = clamp(Math.round(action.price), 1, CHANNEL_CONFIG.dvdPriceRange[1])
      break
    }

    case 'setFreeAdPrice': {
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing' || p.channel !== 'free') return state
      p.freeAdPrice = clamp(Math.round(action.price), 1, CHANNEL_CONFIG.freeAdPriceRange[1])
      break
    }

    case 'setTargetRegion': {
      // 主攻地区（GDD §6 Area）：宣发阶段选择集中发行的地区
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing') return state
      if (action.region) {
        p.targetRegion = action.region
      } else {
        delete p.targetRegion
      }
      break
    }

    case 'upgradeSchool': {
      const next = draft.company.schoolLevel + 1
      // 普通上限 3 级，上市后解锁至 5 级
      const maxLevel = draft.company.public
        ? SCHOOL_CONFIG.maxLevelPublic
        : SCHOOL_CONFIG.maxLevel
      if (next > maxLevel) return state
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

    case 'investTech': {
      // 科技树研发（GDD §5）：投入资金，技术员 VFX 技能越高效率越高
      const line = TECH_LINES.find((l) => l.id === action.lineId)
      if (!line) return state
      const level = techLevel(draft.company.tech, line.id, line.maxLevel)
      if (level >= line.maxLevel) return state
      if (draft.company.cash < TECH_CONFIG.investCost) return state
      draft.company.cash = round1(draft.company.cash - TECH_CONFIG.investCost)
      // 效率：公司技术/特效岗位员工（或 vfx 技能者）的 VFX 技能均值
      const vfxSkills = draft.company.employeeIds
        .map((id) => draft.workers[id])
        .filter((w): w is NonNullable<typeof w> => !!w && w.skills.vfx > 0)
        .map((w) => w.skills.vfx)
      const avgSkill = vfxSkills.length > 0 ? vfxSkills.reduce((a, b) => a + b, 0) / vfxSkills.length : 0
      const efficiency = 1 + (avgSkill / 100) * TECH_CONFIG.techSkillEfficiency
      const gain = TECH_CONFIG.progressPerInvest * efficiency
      const before = level
      draft.company.tech[line.id] = round1((draft.company.tech[line.id] ?? 0) + gain)
      const after = techLevel(draft.company.tech, line.id, line.maxLevel)
      if (after > before) {
        pushNews(draft, `科技突破！「${line.name}」升至 ${after} 级：${line.effectText(after)}`)
      }
      break
    }

    case 'ipo': {
      // IPO 上市（GDD §3.1）：声誉与累计收入达标后融资，解锁大规模扩张
      if (draft.company.public) return state
      const rep = draft.company.reputation
      if (rep < IPO_CONFIG.minReputation) return state
      const totalRevenue = draft.company.history.reduce(
        (s, r) => s + (r.revenue ?? r.boxOffice * ECONOMY.cinemaShare),
        0,
      )
      if (totalRevenue < IPO_CONFIG.minTotalRevenue) return state
      const valuation = Math.round(
        rep * IPO_CONFIG.valuationPerRep + totalRevenue * IPO_CONFIG.valuationRevenueRatio,
      )
      const raised = Math.round(valuation * IPO_CONFIG.raiseRatio)
      draft.company.cash = round1(draft.company.cash + raised)
      draft.company.public = {
        week: draft.calendar.week,
        year: draft.calendar.year,
        raised,
      }
      pushNews(
        draft,
        `星光影业成功上市！IPO 融资 ${raised} 万元（估值 ${valuation} 万）。贷款额度提升、写作学校可扩建至 ${SCHOOL_CONFIG.maxLevelPublic} 级、IP 授权收入提高 ${Math.round((IPO_CONFIG.ipRoyaltyMultiplier - 1) * 100)}%，股东每季度分红。`,
      )
      break
    }

    case 'cheatSpawnWorker': {
      // 作弊：在招聘市场生成一个全属性 100 的免费人才（CA/PA 100，全部技能/精神/身体满）
      const w = generateWorker(rng, action.role, 'pro')
      w.id = uid(draft, 'wrk')
      w.basic.pa = 100
      w.basic.ca = 100
      w.basic.fame = 100
      w.basic.hype = 100
      for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 100
      for (const k of Object.keys(w.mental) as SkillKey[]) w.mental[k as keyof typeof w.mental] = 100
      for (const k of Object.keys(w.physical) as SkillKey[]) w.physical[k as keyof typeof w.physical] = 100
      w.active.mood = 100
      w.active.volume = 100
      w.cheat = true
      draft.world.candidates.push(w)
      pushNews(draft, `⚡ 作弊模式：满属性${ROLES[action.role].nameZh}「${w.name}」免费进入招聘市场（CA/PA 100）。`)
      break
    }

    case 'toggleNoCaDecay': {
      // 作弊开关：员工 CA 不衰退（成长照常）；默认关闭 = 正常衰退/成长
      const cur = draft.cheats?.noCaDecay ?? false
      draft.cheats = { ...(draft.cheats ?? {}), noCaDecay: !cur }
      pushNews(draft, cur ? '⛔ 已关闭「员工 CA 不衰退」，恢复正常衰退。' : '⚡ 已开启「员工 CA 不衰退」：空闲不再掉技能/CA，成长照常。')
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
      // 定档：决定提前周数（weeks=0 本周上映；>0 待映攒预售），不瞬时结算
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'marketing') return state
      if (!p.channel) return state
      const weeks = Math.max(0, Math.min(Math.floor(action.weeks) || 0, CHANNEL_CONFIG.run.presaleMaxWeeks))
      // 固定品质：影评/AP/六项分数/初始 MP/口碑（此后不变，口碑/MP 动态漂移）
      const fixed = computeFilmResult(draft, p, rng)
      p.run = initRunState(draft, p, weeks, fixed.boxOffice)
      p.currentMp = fixed.mp
      p.currentAudience = fixed.audienceScore ?? 0
      p.stage = 'released'
      p.releasedWeek = draft.calendar.week
      // result：固定品质 + 累计从 0 开始（每周结算累加）
      p.result = {
        ...fixed,
        boxOffice: 0,
        revenue: 0,
        admissions: 0,
        dvdUnits: 0,
        freeViews: 0,
        channel: p.channel,
        channels: [p.channel],
        targetRegion: p.targetRegion,
      }
      // 释放 crew（制作期结束）
      for (const id of teamIds(p.team)) {
        const w = draft.workers[id]
        if (w) w.currentProjectId = null
      }
      pushNews(
        draft,
        weeks > 0
          ? `《${p.name}》定档：${weeks} 周后（第 ${p.run.releaseWeek} 周）正式上映，等待期间将累积预售。`
          : `《${p.name}》定档本周上映，进入${CHANNEL_INFO[p.channel].label}档放映。`,
      )
      break
    }

    case 'endRun': {
      // 手动下片：结束当前放映段（本周已结算收入保留）
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'released' || !p.run) return state
      const rs = p.run
      const run = rs.runs.find((x) => x.id === rs.currentRunId)
      if (!run || run.status !== 'running') return state
      endRun(draft, p, run)
      break
    }

    case 'rerelease': {
      // 再发行：选择严格更低档渠道，下周开映（不定档不预售）
      const p = draft.projects.find((x) => x.id === action.projectId)
      if (!p || p.stage !== 'released' || !p.run) return state
      const rs = p.run
      if (rs.status !== 'idle') return state
      const last = rs.runs[rs.runs.length - 1]
      if (!last || !isLowerChannel(action.channel, last.channel)) return state
      const run = createRun(
        draft,
        p,
        action.channel,
        false,
        { ...createRunConfigForChannel(action.channel), ...(action.config ?? {}) },
      )
      rs.runs.push(run)
      rs.currentRunId = run.id
      rs.status = 'running'
      pushNews(draft, `《${p.name}》再发行：登陆${CHANNEL_INFO[action.channel].label}渠道，下周开映。`)
      break
    }

    case 'sellCopyright': {
      // 版权交易：IP 版权卖给电视剧/游戏公司，固定总额每周分期
      const ip = draft.company.ips.find((x) => x.id === action.ipId)
      if (!ip) return state
      const deals = ip.deals ?? []
      if (deals.some((d) => d.kind === action.kind && d.status === 'active')) return state
      const cc = IP_LONGTAIL_CONFIG.copyright
      const base = action.kind === 'tv' ? cc.tvBase : cc.gameBase
      const weeks = action.kind === 'tv' ? cc.tvWeeks : cc.gameWeeks
      const total = round1(
        base * (1 + ((ip.level ?? 1) - 1) * cc.levelK) * (cc.hotnessK + (ip.hotness ?? 0) / 100),
      )
      deals.push({
        id: uid(draft, 'cpr'),
        kind: action.kind,
        total,
        paid: 0,
        weeks,
        weeksPaid: 0,
        status: 'active',
        startWeek: draft.calendar.week,
        startYear: draft.calendar.year,
      })
      ip.deals = deals
      pushNews(
        draft,
        `《${ip.name}》IP 版权授权给${action.kind === 'tv' ? '电视剧' : '游戏'}公司，合同总额 ${total} 万（${weeks} 周分期到账）。`,
      )
      break
    }

    case 'cancelProject': {
      // 取消未上映项目：投入不退（定金/拍摄成本/预热沉没）、剧组人员释放回员工池、IP 不受影响
      const idx = draft.projects.findIndex((x) => x.id === action.projectId)
      if (idx < 0) return state
      const p = draft.projects[idx]
      if (p.stage === 'released') return state
      for (const id of teamIds(p.team)) {
        const w = draft.workers[id]
        if (w) {
          w.currentProjectId = null
          w.idleWeeks = 0
        }
      }
      draft.projects.splice(idx, 1)
      pushNews(
        draft,
        `《${p.name}》未上映即被取消，已投入 ${Math.round(p.spent)} 万沉没，剧组人员已释放回员工池。`,
      )
      break
    }
  }

  draft.seed = (draft.seed + 1) >>> 0
  draft.company.cash = round1(draft.company.cash)
  return draft
}
