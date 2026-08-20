import type { Competitor, CompetitorFilm, FilmType, GameState } from '../types'
import { FILM_TYPES } from '../types'
import { SCRIPT_POOL } from '../config/scripts'
import { WORLD_CONFIG } from '../config/world'
import { ECONOMY } from '../config/economy'
import { SCORE_WEIGHTS } from '../config/weights'
import { audienceFit } from './audience'
import { eventBoxOfficeFactor } from './events'
import { competitionPenalty } from './scoring'
import type { Rng } from '../rng'
import { clamp, pick, randInt, round1 } from '../rng'

/** 按权重随机抽一个类型 */
function weightedPick(weights: Record<FilmType, number>, rng: Rng): FilmType {
  const total = FILM_TYPES.reduce((s, t) => s + Math.max(0, weights[t]), 0)
  let roll = rng() * Math.max(0.0001, total)
  for (const t of FILM_TYPES) {
    roll -= Math.max(0, weights[t])
    if (roll <= 0) return t
  }
  return FILM_TYPES[FILM_TYPES.length - 1]
}

/** 玩家上映窗口内的影片类型（本周/下周开映或正在放映，供狙击型决策） */
export function playerWindowTypes(state: GameState): FilmType[] {
  const cal = state.calendar
  const types: FilmType[] = []
  for (const p of state.projects) {
    if (p.stage !== 'released' || !p.run) continue
    const rs = p.run
    if (rs.status === 'running' && rs.currentRunId) {
      const run = rs.runs.find((x) => x.id === rs.currentRunId)
      if (run && run.weekly.length > 0) {
        const t = state.scripts[p.scriptId]?.type
        if (t && !types.includes(t)) types.push(t)
      }
    } else if (
      rs.status === 'presale' &&
      rs.releaseYear === cal.year &&
      rs.releaseWeek - cal.week <= 1 &&
      rs.releaseWeek >= cal.week
    ) {
      const t = state.scripts[p.scriptId]?.type
      if (t && !types.includes(t)) types.push(t)
    }
  }
  return types
}

/** 当前竞争拥挤度：本周+上周上映的片数（对手 + 玩家开映窗口） */
export function competitorCrowd(state: GameState): number {
  const cal = state.calendar
  const overlap = WORLD_CONFIG.competition.overlapWeeks
  let n = 0
  for (const c of state.world.competitors) {
    for (const f of c.history) {
      if (f.year === cal.year && f.week >= cal.week - overlap && f.week <= cal.week) n++
    }
  }
  for (const p of state.projects) {
    if (p.stage !== 'released' || !p.run) continue
    const rs = p.run
    if (rs.status === 'presale' && rs.releaseYear === cal.year && rs.releaseWeek === cal.week) {
      n++
    } else if (rs.status === 'running' && rs.currentRunId) {
      const run = rs.runs.find((x) => x.id === rs.currentRunId)
      if (run && run.weekly.length > 0 && run.weekly[0].year === cal.year && run.weekly[0].week >= cal.week - overlap) {
        n++
      }
    }
  }
  return n
}

/**
 * 档期决策：倒计时归零时是否本周上映。
 * 拥挤（≥3 部同窗口）时：狙击型照常撞档、快发型不断档，其余避让推迟 1–2 周。
 */
export function shouldCompetitorRelease(state: GameState, c: Competitor, rng: Rng): boolean {
  if (competitorCrowd(state) < 3) return true
  if (c.personality === 'sniper' || c.personality === 'volume') return true
  c.nextReleaseIn = randInt(rng, 1, 2)
  return false
}

/** 类型决策：专精锁定 / 追趋势 / 追观众 / 追类型热潮 / 狙击玩家窗口 */
export function decideCompetitorType(state: GameState, c: Competitor, rng: Rng): FilmType {
  const w: Record<FilmType, number> = {
    comedy: 0.5,
    horror: 0.5,
    action: 0.5,
    love: 0.5,
    war: 0.5,
    drama: 0.5,
  }
  const p = c.personality
  // 专精型：深耕 homeTypes
  if (p === 'specialist' && c.homeTypes?.length) {
    for (const t of c.homeTypes) w[t] += 3.5
  }
  // 趋势跟随（balanced 强、quality/sniper 中、volume 弱）
  if (state.world.trend) {
    w[state.world.trend.type] += p === 'balanced' ? 2.5 : p === 'quality' || p === 'sniper' ? 1.5 : 0.5
  }
  // 观众偏好（balanced 强跟随）
  const audK = p === 'balanced' ? 1.6 : 0.8
  for (const g of state.world.audience) {
    for (const t of FILM_TYPES) w[t] += g.size * g.focus[t] * audK
  }
  // 类型热潮事件
  for (const e of state.world.activeEvents) {
    if (e.kind === 'typeBoom' && e.type) w[e.type] += 2.5
  }
  // 狙击型：撞玩家窗口类型
  if (p === 'sniper') {
    for (const t of playerWindowTypes(state)) w[t] += 2.5
  }
  return weightedPick(w, rng)
}

/**
 * NPC 片口碑闭环：影评人评分 + 观众评分 + 复用玩家票房 gross 管线
 * （无宣发热度/IP 加成，但趋势/观众契合/事件/档期竞争惩罚全部生效，与玩家同量级）。
 */
export function scoreCompetitorFilm(
  state: GameState,
  type: FilmType,
  ap: number,
  mp: number,
  rng: Rng,
): { criticScore: number; audienceScore: number; boxOffice: number } {
  const reviews = state.world.critics.map((crit) => {
    let s = ap / 10
    if (crit.taste !== 'none') {
      s += crit.taste === type ? WORLD_CONFIG.tasteBonus : -WORLD_CONFIG.tasteMismatchPenalty
    }
    s += (rng() - 0.5) * 1.0
    return clamp(Math.round(s * 10) / 10, 0, 10)
  })
  const criticScore =
    reviews.length > 0 ? round1(reviews.reduce((a, b) => a + b, 0) / reviews.length) : round1(ap / 10)

  const fit = audienceFit(state, type)
  const audBase = (mp * 0.7 + ap * 0.3) / 10
  const audienceScore = clamp(
    Math.round((audBase + (fit - 1) * 5 + (rng() - 0.5) * 0.6) * 10) / 10,
    0,
    10,
  )

  const f = ECONOMY.boxOfficeFactor
  const base = 8 * ECONOMY.boxOfficeBasePerStage
  const mpFactor = f.mpMin + (mp / 100) * f.mpSpan
  const trendFactor = state.world.trend && type === state.world.trend.type ? 1 + f.trendSpan : 1
  const audFactor = fit
  const compFactor = 1 - competitionPenalty(state, state.calendar.week)
  const eventFactor = eventBoxOfficeFactor(state, type)
  const random = 1 + (rng() - 0.5) * 2 * SCORE_WEIGHTS.variance
  const boxOffice = Math.round(
    base * mpFactor * trendFactor * audFactor * compFactor * eventFactor * random,
  )
  return { criticScore, audienceScore, boxOffice }
}

/**
 * 对手上映一部影片（感知决策 + 口碑闭环）：
 * 类型决策 → 品质（声誉 + 性格投入）→ 影评/观众/事件/竞争结算 → 入历史 + 声誉微调。
 */
export function releaseCompetitorFilm(state: GameState, c: Competitor, rng: Rng): CompetitorFilm {
  const type = decideCompetitorType(state, c, rng)
  const title = pick(rng, SCRIPT_POOL.titles[type])

  // 品质投入：性格 investMul 决定精雕/粗糙（品质型 ap/mp 更高、快发型更低）
  const invest = WORLD_CONFIG.competitor.investMul[c.personality]
  const qualityBonus = Math.round((invest - 1) * 25)
  const ap = clamp(Math.round(randInt(rng, 20, 60) + c.reputation * 0.4 + qualityBonus), 0, 100)
  const mp = clamp(Math.round(randInt(rng, 25, 65) + c.reputation * 0.5 + qualityBonus * 0.6), 0, 100)

  const { criticScore, audienceScore, boxOffice } = scoreCompetitorFilm(state, type, ap, mp, rng)

  const film: CompetitorFilm = {
    week: state.calendar.week,
    year: state.calendar.year,
    name: title,
    type,
    ap,
    mp,
    criticScore,
    audienceScore,
    boxOffice,
  }
  c.history.push(film)
  c.history = c.history.slice(-10)
  c.reputation = clamp(c.reputation + (mp >= 50 ? 1 : -1), 0, 100)
  c.nextType = type
  return film
}
