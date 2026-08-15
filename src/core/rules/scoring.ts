import type { FilmProject, FilmResult, FilmScores, GameState, RoleId } from '../types'
import { SCORE_WEIGHTS } from '../config/weights'
import { ECONOMY } from '../config/economy'
import type { Rng } from '../rng'
import { clamp, round1 } from '../rng'

const BASE_KEYS = ['story', 'directing', 'acting', 'shooting', 'edit', 'music'] as const

/** 团队成员技能取值；缺员用 40 兜底 */
function memberSkill(state: GameState, workerId: string | undefined, skill: keyof FilmScores & string): number {
  if (!workerId) return 40
  const w = state.workers[workerId]
  if (!w) return 40
  const map: Record<string, number> = {
    story: w.basic.fame * 0.4 + 30,
    music: w.basic.fame * 0.3 + 30,
    edit: w.skills.edit,
    acting: w.skills.act,
    shooting: w.skills.shoot,
    directing: w.skills.direct,
  }
  return map[skill] ?? 40
}

/**
 * 成片评分（GDD §7.2）
 * 基础分六项 + VFX + Specific + Buff/AP 修正 → AP / MP
 */
export function computeFilmResult(state: GameState, project: FilmProject, rng: Rng): FilmResult {
  const script = state.scripts[project.scriptId]
  const variance = () => 1 + (rng() - 0.5) * 2 * SCORE_WEIGHTS.variance

  const actorSkill =
    project.team.actorIds.length > 0
      ? project.team.actorIds.reduce((s, id) => s + (state.workers[id]?.skills.act ?? 40), 0) /
        project.team.actorIds.length
      : 40

  const scores: FilmScores = {
    story: clamp(script.storyPoint * variance(), 0, 100),
    music: clamp((40 + script.artPot * 0.3) * variance(), 0, 100),
    edit: clamp(memberSkill(state, project.team.editorId, 'edit') * variance(), 0, 100),
    acting: clamp(actorSkill * variance(), 0, 100),
    shooting: clamp(memberSkill(state, project.team.shooterId, 'shooting') * variance(), 0, 100),
    directing: clamp(memberSkill(state, project.team.directorId, 'directing') * variance(), 0, 100),
  }

  const vfxSkill = state.workers[project.team.technicianId ?? '']?.skills.vfx ?? 40
  const vfx = clamp(
    (project.vfxPercent / 100) * (vfxSkill / 100) * SCORE_WEIGHTS.vfxMax * variance(),
    0,
    SCORE_WEIGHTS.vfxMax,
  )
  const specific = clamp(
    5 + project.buffs * 0.5 + project.apAdjust * 0.3,
    0,
    SCORE_WEIGHTS.specificMax,
  )

  const base = BASE_KEYS.reduce((s, k) => s + SCORE_WEIGHTS.base[k] * scores[k], 0)
  void base

  // AP / MP（0–100）
  const apRaw =
    scores.story * SCORE_WEIGHTS.ap.story +
    script.artPot * SCORE_WEIGHTS.ap.artPot +
    scores.directing * SCORE_WEIGHTS.ap.directing +
    scores.shooting * SCORE_WEIGHTS.ap.shooting
  const ap = clamp(
    project.hasAd ? apRaw - ECONOMY.adDealApPenalty : apRaw,
    0,
    100,
  )
  const mp = clamp(
    script.marketPot * SCORE_WEIGHTS.mp.marketPot +
      actorSkill * SCORE_WEIGHTS.mp.acting +
      project.hype * SCORE_WEIGHTS.mp.hype,
    0,
    100,
  )

  const { boxOffice, reputationGain } = computeBoxOfficeAndGain(state, project, ap, mp, rng)

  const groupPerformance = buildGroupPerformance(state, project, rng)

  return {
    scores,
    vfx: round1(vfx),
    specific: round1(specific),
    ap: round1(ap),
    mp: round1(mp),
    boxOffice: round1(boxOffice),
    reputationGain,
    groupPerformance,
    week: state.calendar.week,
    year: state.calendar.year,
  }
}

/** 票房与声誉（GDD §7.3） */
export function computeBoxOfficeAndGain(
  state: GameState,
  project: FilmProject,
  ap: number,
  mp: number,
  rng: Rng,
): { boxOffice: number; reputationGain: number } {
  const script = state.scripts[project.scriptId]
  const f = ECONOMY.boxOfficeFactor

  const base = project.totalStages * ECONOMY.boxOfficeBasePerStage
  const mpFactor = f.mpMin + (mp / 100) * f.mpSpan
  const hypeFactor = 1 + (project.hype / 100) * f.hypeSpan
  const trendActive = state.world.trend !== null && script.type === state.world.trend.type
  const trendFactor = trendActive ? 1 + f.trendSpan : 1
  const repFactor = 1 + (state.company.reputation / 100) * f.reputationSpan
  const random = 1 + (rng() - 0.5) * 2 * SCORE_WEIGHTS.variance

  const boxOffice = base * mpFactor * hypeFactor * trendFactor * repFactor * random
  const reputationGain = clamp(Math.round((ap - 45) / 10), -3, 5)
  return { boxOffice, reputationGain }
}

/** Group Performance：每位成员个人成绩 0–100 */
export function buildGroupPerformance(state: GameState, project: FilmProject, rng: Rng): FilmResult['groupPerformance'] {
  const team = project.team
  const ids: Array<[string, RoleId]> = []
  if (team.producerId) ids.push([team.producerId, 'producer'])
  if (team.directorId) ids.push([team.directorId, 'director'])
  if (team.writerId) ids.push([team.writerId, 'writer'])
  for (const id of team.actorIds) ids.push([id, 'actor'])
  if (team.shooterId) ids.push([team.shooterId, 'shooter'])
  if (team.editorId) ids.push([team.editorId, 'editor'])
  if (team.technicianId) ids.push([team.technicianId, 'technician'])
  if (team.marketId) ids.push([team.marketId, 'market'])
  if (team.assistantId) ids.push([team.assistantId, 'assistant'])

  return ids.map(([workerId, role]) => {
    const w = state.workers[workerId]
    const perf = clamp(round1(40 + (w?.basic.ca ?? 40) * 0.5 + (rng() - 0.5) * 20), 0, 100)
    return { workerId, role, performance: perf }
  })
}
