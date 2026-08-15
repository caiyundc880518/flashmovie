import type { Competitor, CompetitorFilm, FilmProject, GameState, ProjectEvent, Script } from '../types'
import { FILM_TYPES } from '../types'
import { ECONOMY } from '../config/economy'
import { SCHOOL_CONFIG } from '../config/company'
import { SCRIPT_POOL } from '../config/scripts'
import { SHOOTING_EVENTS } from '../config/events'
import { WORLD_CONFIG } from '../config/world'
import type { Rng } from '../rng'
import { chance, clamp, pick, randInt, round1, weightedPick } from '../rng'
import { applyWeeklyWorkerState } from '../rules/growth'
import { chemistrySpeedFactor } from '../rules/chemistry'
import { applyAwardEffects, computeYearAwards } from '../rules/awards'
import { generateScript } from '../generators/scriptGen'
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
    if (p.stage !== 'released') for (const id of teamIds(p.team)) busy.add(id)
  }
  for (const id of draft.company.employeeIds) {
    const w = draft.workers[id]
    if (w) applyWeeklyWorkerState(w, busy.has(id), rng)
  }

  // 4. 编剧产出剧本
  for (const [writerId, left] of Object.entries(draft.writerQueues)) {
    const next = left - 1
    if (next <= 0) {
      const writer = draft.workers[writerId]
      const script: Script = generateScript(rng, 'company', writerId)
      script.id = uid(draft, 'scr')
      if (writer) script.title = `《${writer.name}新作·${script.title}》`
      // 写作学校：质量加成 + 精品概率（GDD §3.1 自建写作学校）
      const level = draft.company.schoolLevel
      if (level > 0) {
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
      draft.scripts[script.id] = script
      draft.company.ownedScriptIds.push(script.id)
      if (writer) writer.experience += 20 // 写作实践（Post-Scripting Buff 基础）
      delete draft.writerQueues[writerId]
    } else {
      draft.writerQueues[writerId] = next
    }
  }

  // 5. 项目推进
  for (const p of draft.projects) {
    if (p.stage !== 'shooting') continue
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
    if (p.shotStages >= p.totalStages && p.stage === 'shooting') {
      p.stage = 'editing'
    }
  }

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

  // 8. 年度切换：TMA 颁奖典礼（GDD §6 Award Ceremony）
  if (draft.calendar.week === 1 && draft.calendar.year > 1) {
    const prevYear = draft.calendar.year - 1
    const ceremony = computeYearAwards(draft, prevYear)
    draft.lastCeremony = ceremony
    applyAwardEffects(draft, ceremony)
    pushNews(draft, `第 ${prevYear} 年收官，TMA 颁奖典礼隆重举行，恭喜所有获奖影片！`)
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
