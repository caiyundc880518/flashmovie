import type {
  Competitor,
  CompetitorFilm,
  FilmProject,
  GameState,
  ProjectEvent,
  Script,
  WorldEvent,
} from '../types'
import { FILM_TYPES } from '../types'
import { ECONOMY } from '../config/economy'
import { IPO_CONFIG, SCHOOL_CONFIG } from '../config/company'
import { SCRIPT_POOL } from '../config/scripts'
import { SHOOTING_EVENTS, INDUSTRY_EVENTS, FILM_TYPE_ZH } from '../config/events'
import { WORLD_CONFIG } from '../config/world'
import { WRITER_POOL_MAP } from '../config/writers'
import type { Rng } from '../rng'
import { chance, clamp, pick, randInt, round1, weightedPick } from '../rng'
import { applyWeeklyWorkerState } from '../rules/growth'
import { chemistrySpeedFactor } from '../rules/chemistry'
import { settleDistribution, settleIpLongtail } from './distribution'
import { applyAwardEffects, computeYearAwards } from '../rules/awards'
import { annualCriticRotation } from '../rules/critics'
import { generateScript, generateTierScript } from '../generators/scriptGen'
import { generateMarketScripts } from '../generators/scriptGen'
import { generateCandidates } from '../generators/workerGen'
import { pushNews, teamIds, uid } from '../state/utils'
import { advanceWeek as advCalendar } from '../types/calendar'

/** 剧组平均心情（影响拍摄速度） */
function teamAvgMood(state: GameState, project: FilmProject): number {
  const ids = teamIds(project.team)
  if (ids.length === 0) return 60
  const sum = ids.reduce((s, id) => s + (state.workers[id]?.active.mood ?? 60), 0)
  return sum / ids.length
}

/** 写作学校：编剧产出质量加成 + 精品概率（GDD §3.1 自建写作学校） */
function applySchoolBuff(draft: GameState, script: Script, rng: Rng): void {
  const level = draft.company.schoolLevel
  if (level <= 0) return
  const q = 1 + level * SCHOOL_CONFIG.writerQualityPerLevel
  script.storyPoint = clamp(Math.round(script.storyPoint * q), 0, 100)
  script.artPot = clamp(Math.round(script.artPot * q), 0, 100)
  script.marketPot = clamp(Math.round(script.marketPot * q), 0, 100)
  if (chance(rng, level * SCHOOL_CONFIG.boutiqueChancePerLevel)) {
    script.storyPoint = clamp(script.storyPoint + SCHOOL_CONFIG.boutiqueBonus, 0, 100)
    script.artPot = clamp(script.artPot + SCHOOL_CONFIG.boutiqueBonus, 0, 100)
    script.marketPot = clamp(script.marketPot + SCHOOL_CONFIG.boutiqueBonus, 0, 100)
    pushNews(draft, `写作学校产出精品剧本《${script.title}》！`)
  }
}

function generateProjectEvent(state: GameState, rng: Rng): ProjectEvent {
  const def = weightedPick(
    rng,
    SHOOTING_EVENTS.map((e) => [e.weight, e] as const),
  )
  return {
    id: uid(state, 'evt'),
    kind: def.kind,
    title: def.title,
    desc: def.desc,
    options: def.options.map((o) => ({ ...o })),
  }
}

/** 行业/公司随机事件：触发并结算（GDD §6 Random Events） */
function spawnIndustryEvent(state: GameState, rng: Rng): void {
  const def = weightedPick(
    rng,
    INDUSTRY_EVENTS.map((e) => [e.weight, e] as const),
  )
  applyIndustryEvent(state, def, rng)
}

/** 应用一个行业事件定义（导出供测试） */
export function applyIndustryEvent(
  state: GameState,
  def: (typeof INDUSTRY_EVENTS)[number],
  rng: Rng,
): void {
  const week = state.calendar.week

  // 持续型：写入 world.activeEvents
  if (def.weeks) {
    const base: WorldEvent = {
      id: uid(state, 'wve'),
      title: def.title,
      desc: def.desc,
      kind: def.kind as WorldEvent['kind'],
      untilWeek: week + randInt(rng, def.weeks[0], def.weeks[1]),
      boxOfficeMul: def.boxOfficeMul,
      typeBoomMul: def.typeBoomMul,
      vfxBonus: def.vfxBonus,
    }
    if (def.kind === 'typeBoom') {
      const type = pick(rng, FILM_TYPES)
      base.type = type
      base.title = `${FILM_TYPE_ZH[type]}类型热潮`
      base.desc = `一部现象级大片带动${FILM_TYPE_ZH[type]}片观影热潮，该类型票房走高。`
    }
    state.world.activeEvents.push(base)
    pushNews(state, `【行业事件】${base.title}：${base.desc}（持续至第 ${base.untilWeek} 周）`)
    return
  }

  // 即时型：作用于员工/公司
  const employeeIds = state.company.employeeIds
  const employees = employeeIds.map((id) => state.workers[id]).filter((w): w is NonNullable<typeof w> => !!w)
  if (def.kind === 'grant') {
    state.company.cash = round1(state.company.cash + (def.cash ?? 0))
    pushNews(state, `【好消息】${def.title}：${def.desc} 获得 ${def.cash ?? 0} 万补贴。`)
    return
  }
  // scandal：优先高 Fame 员工；praise：随机员工（无员工则跳过）
  if (employees.length === 0) return
  const target =
    def.kind === 'scandal'
      ? [...employees].sort((a, b) => b.basic.fame - a.basic.fame)[0]
      : pick(rng, employees)
  if (def.fame) target.basic.fame = clamp(target.basic.fame + def.fame, 0, 100)
  if (def.mood) target.active.mood = clamp(target.active.mood + def.mood, 10, 95)
  pushNews(
    state,
    `【${def.kind === 'scandal' ? '风波' : '喜讯'}】${target.name}：${def.desc}${
      def.fame ? ` Fame ${def.fame > 0 ? '+' : ''}${def.fame}` : ''
    }。`,
  )
}

/**
 * 推进一周（GDD §2 / §3.3）：
 * 日历 → 周成本/薪酬 → 贷款 → 员工状态 → 编剧产出 → 项目推进 → 市场刷新 → 趋势 → 年度钩子
 */
export function advanceWeek(draft: GameState, rng: Rng): void {
  draft.calendar = advCalendar(draft.calendar)

  // 1. 每周固定成本 + 薪酬
  draft.company.cash -= ECONOMY.weeklyOfficeCost
  for (const id of draft.company.employeeIds) {
    const w = draft.workers[id]
    if (w) draft.company.cash -= w.salary
  }

  // 1.5 IP 长尾收益（每周结算）：热门度衰减 + 周边收入 + 版权交易合同分期（GDD §3.8 大修）
  settleIpLongtail(draft)

  // 1.55 上市股东季度分红（GDD §3.1 IPO 代价）
  if (draft.company.public && draft.calendar.week % 13 === 0) {
    const dividend = Math.max(
      IPO_CONFIG.dividendBase,
      Math.round(draft.company.cash * IPO_CONFIG.dividendRatio),
    )
    draft.company.cash = round1(draft.company.cash - dividend)
    pushNews(draft, `上市股东分红：支付 ${dividend} 万元。`)
  }

  // 1.6 观众群体偏好季度微调：类型关注度缓慢漂移（GDD §6）
  if (draft.world.audience.length > 0 && draft.calendar.week % 13 === 0) {
    const drift = WORLD_CONFIG.audience.drift
    for (const g of draft.world.audience) {
      for (const t of FILM_TYPES) {
        g.focus[t] = round1(clamp(g.focus[t] + (rng() - 0.5) * 2 * drift, 0.05, 0.95))
      }
    }
  }

  // 2. 贷款每周还款
  for (const loan of draft.company.loans) {
    const payment =
      loan.principal / ECONOMY.loanWeeks + (loan.principal * loan.rate) / ECONOMY.weeksPerYear
    draft.company.cash -= payment
    loan.weeksLeft -= 1
  }
  draft.company.loans = draft.company.loans.filter((l) => l.weeksLeft > 0)

  // 3. 员工状态（项目内/空闲）
  const busy = new Set<string>()
  for (const p of draft.projects) {
    if (p.stage !== 'released') {
      for (const id of teamIds(p.team)) busy.add(id)
    } else if (p.run && !p.run.firstRunEnded) {
      // 首轮放映（待映/放映中）期间：成员仍视为在项目内（不空闲衰减），首轮下片结算后才真正释放
      for (const id of teamIds(p.team)) busy.add(id)
    }
  }
  for (const id of draft.company.employeeIds) {
    const w = draft.workers[id]
    if (w) applyWeeklyWorkerState(w, busy.has(id), rng)
  }

  // 4. 编剧产出剧本（旧签约编剧机制，writerQueues 排队）
  for (const [writerId, left] of Object.entries(draft.writerQueues)) {
    const next = left - 1
    if (next <= 0) {
      const writer = draft.workers[writerId]
      const script: Script = generateScript(rng, 'company', writerId)
      script.id = uid(draft, 'scr')
      if (writer) script.title = `《${writer.name}新作·${script.title}》`
      applySchoolBuff(draft, script, rng)
      draft.scripts[script.id] = script
      draft.company.ownedScriptIds.push(script.id)
      if (writer) writer.experience += 20 // 写作实践（Post-Scripting Buff 基础）
      // 签约编剧持续创作：产出后自动接下个剧本（修复：产出即闲置的断供 bug）
      draft.writerQueues[writerId] = randInt(
        rng,
        SCRIPT_POOL.writerProduceWeeks[0],
        SCRIPT_POOL.writerProduceWeeks[1],
      )
    } else {
      draft.writerQueues[writerId] = next
    }
  }

  // 4.5 编剧抽卡委托到货：倒计时归零 → 生成对应档位剧本进公司剧本库
  for (const d of draft.scriptDrafts) {
    d.weeksLeft -= 1
    if (d.weeksLeft <= 0) {
      const cfg = WRITER_POOL_MAP[d.tier]
      const script = generateTierScript(rng, cfg)
      script.id = uid(draft, 'scr')
      applySchoolBuff(draft, script, rng)
      draft.scripts[script.id] = script
      draft.company.ownedScriptIds.push(script.id)
      pushNews(draft, `${cfg.label}创作完成：《${script.title}》已入库公司剧本库。`)
    }
  }
  draft.scriptDrafts = draft.scriptDrafts.filter((d) => d.weeksLeft > 0)

  // 5. 项目推进
  for (const p of draft.projects) {
    if (p.stage !== 'shooting') continue
    // 被动小游戏：有待玩小游戏时本周暂停拍摄（必须完成小游戏才能继续推进）
    if (p.pendingShotGame) continue
    const directorSkill = draft.workers[p.team.directorId ?? '']?.skills.direct ?? 40
    const shooterSkill = draft.workers[p.team.shooterId ?? '']?.skills.shoot ?? 40
    const avgMood = teamAvgMood(draft, p)
    const chemSpeed = chemistrySpeedFactor(draft, p)
    const speed = Math.max(
      1,
      Math.round((1 + directorSkill * 0.02 + shooterSkill * 0.015 + avgMood * 0.003) * chemSpeed),
    )
    p.shotStages = Math.min(p.totalStages, p.shotStages + speed)
    const weeklyCost = (p.budget / p.totalStages) * speed
    p.spent = round1(p.spent + weeklyCost)
    draft.company.cash -= weeklyCost

    if (p.pendingEvents.length === 0 && p.shotStages < p.totalStages && chance(rng, 0.35)) {
      p.pendingEvents.push(generateProjectEvent(draft, rng))
    }
    // 被动触发拍摄小游戏：某几场戏需要完成运镜挑战（必须玩完才能继续推进）
    if (!p.pendingShotGame && p.shotStages < p.totalStages && chance(rng, 0.4)) {
      p.pendingShotGame = true
    }
    if (p.shotStages >= p.totalStages && p.stage === 'shooting') {
      p.stage = 'editing'
    }
  }

  // 5.5 发行放映每周结算：待映攒预售 → 每周票房 → 自动下片（GDD §3.6 大修）
  settleDistribution(draft)

  // 6. 市场刷新（剧本 + 候选人）
  draft.world.marketRefreshIn -= 1
  if (draft.world.marketRefreshIn <= 0) {
    const scripts = generateMarketScripts(
      rng,
      randInt(rng, SCRIPT_POOL.marketScriptCount[0], SCRIPT_POOL.marketScriptCount[1]),
    )
    for (const s of scripts) s.id = uid(draft, 'scr')
    draft.world.marketScripts = scripts
    const candidates = generateCandidates(rng, randInt(rng, 4, 6))
    for (const c of candidates) c.id = uid(draft, 'wrk')
    draft.world.candidates = candidates
    draft.world.marketRefreshIn = randInt(
      rng,
      SCRIPT_POOL.marketRefreshWeeks[0],
      SCRIPT_POOL.marketRefreshWeeks[1],
    )
  }

  // 7. 趋势过期 → 新趋势
  if (draft.world.trend && draft.calendar.week > draft.world.trend.untilWeek) {
    draft.world.trend = {
      type: pick(rng, FILM_TYPES),
      untilWeek: draft.calendar.week + randInt(rng, 20, 52),
    }
  }

  // 7.5 竞争对手周期：倒计时归零 → 上映一部影片
  for (const c of draft.world.competitors) {
    c.nextReleaseIn -= 1
    if (c.nextReleaseIn <= 0) {
      const film = releaseCompetitorFilm(draft, c, rng)
      pushNews(draft, `竞争对手「${c.name}」本周上映《${film.name}》，档期竞争加剧！`)
      c.nextReleaseIn = randInt(
        rng,
        WORLD_CONFIG.competitorReleaseWeeks[0],
        WORLD_CONFIG.competitorReleaseWeeks[1],
      )
    }
  }

  // 7.6 行业/公司随机事件（GDD §6 Random Events）：清理过期 + 概率触发
  draft.world.activeEvents = draft.world.activeEvents.filter(
    (e) => e.untilWeek >= draft.calendar.week,
  )
  if (draft.world.activeEvents.length < 3 && chance(rng, WORLD_CONFIG.eventChance)) {
    spawnIndustryEvent(draft, rng)
  }

  // 8. 年度切换：TMA 颁奖典礼（GDD §6 Award Ceremony）
  if (draft.calendar.week === 1 && draft.calendar.year > 1) {
    const prevYear = draft.calendar.year - 1
    const ceremony = computeYearAwards(draft, prevYear)
    draft.lastCeremony = ceremony
    applyAwardEffects(draft, ceremony)
    pushNews(draft, `第 ${prevYear} 年收官，TMA 颁奖典礼隆重举行，恭喜所有获奖影片！`)
    // 年度影评人换血：随机 0–1 位退休、补入新锐（始终 5 位）
    annualCriticRotation(draft, rng)
  }

  draft.company.cash = round1(draft.company.cash)
  draft.world.news = draft.world.news.slice(-30)
}

/** 对手上映一部影片（简化质量模型，声誉越高出品越强） */
export function releaseCompetitorFilm(
  state: GameState,
  c: Competitor,
  rng: Rng,
): CompetitorFilm {
  const type = pick(rng, FILM_TYPES)
  const title = pick(rng, SCRIPT_POOL.titles[type])
  const ap = clamp(Math.round(randInt(rng, 20, 60) + c.reputation * 0.4), 0, 100)
  const mp = clamp(Math.round(randInt(rng, 25, 65) + c.reputation * 0.5), 0, 100)
  const boxOffice = Math.round((randInt(rng, 400, 900) + c.reputation * 15) * (0.8 + mp / 100))
  const film: CompetitorFilm = {
    week: state.calendar.week,
    year: state.calendar.year,
    name: title,
    ap,
    mp,
    boxOffice,
  }
  c.history.push(film)
  c.history = c.history.slice(-10)
  c.reputation = clamp(c.reputation + (mp >= 50 ? 1 : -1), 0, 100)
  return film
}
