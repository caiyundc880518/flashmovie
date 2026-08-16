import type { Channel, CriticReview, FilmProject, FilmResult, FilmScores, FilmType, GameState, RoleId } from '../types'
import { SCORE_WEIGHTS } from '../config/weights'
import { ECONOMY } from '../config/economy'
import { CHANNEL_INFO } from '../config/channels'
import { WORLD_CONFIG } from '../config/world'
import { CHEMISTRY } from '../config/company'
import { IP_CONFIG } from '../config/ip'
import { VFX_CONFIG } from '../config/minigame'
import { chemistryScoreFactor, goldenCombos } from './chemistry'
import { techBonuses } from './tech'
import { audienceFit, tolerancePenalty } from './audience'
import { eventBoxOfficeFactor, eventVfxBonus } from './events'
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

  // 科技树加成：渲染引擎抬升上限、动作捕捉增强类型系数、特效合成整体加成（GDD §5）
  const tech = techBonuses(state)
  // 市场事件加成：技术突破提升 VFX 分（GDD §6 Random Events）
  const eventVfx = eventVfxBonus(state)
  const vfxSkill = state.workers[project.team.technicianId ?? '']?.skills.vfx ?? 40
  const tier = vfxTier(vfxSkill)
  const vfxCap = tier.max + tech.render
  const vfx = clamp(
    (project.vfxPercent / 100) *
      (vfxSkill / 100) *
      vfxCap *
      vfxTypeFactor(script.type, tech.mocap) *
      (1 + tech.comp + eventVfx) *
      variance(),
    0,
    vfxCap,
  )
  const specific = clamp(
    5 +
      project.buffs * 0.5 +
      project.apAdjust * 0.3 +
      (goldenCombos(state, project).length > 0 ? CHEMISTRY.goldenSpecificBonus : 0),
    0,
    SCORE_WEIGHTS.specificMax,
  )

  const base = BASE_KEYS.reduce((s, k) => s + SCORE_WEIGHTS.base[k] * scores[k], 0)
  // 化学反应：团队相性影响成片（AP/MP ×0.9–1.1）
  const chemFactor = chemistryScoreFactor(state, project)
  void base

  // AP / MP（0–100）
  const apRaw =
    scores.story * SCORE_WEIGHTS.ap.story +
    script.artPot * SCORE_WEIGHTS.ap.artPot +
    scores.directing * SCORE_WEIGHTS.ap.directing +
    scores.shooting * SCORE_WEIGHTS.ap.shooting
  const ap = clamp(
    (project.hasAd ? apRaw - ECONOMY.adDealApPenalty : apRaw) * chemFactor,
    0,
    100,
  )
  const mp = clamp(
    (script.marketPot * SCORE_WEIGHTS.mp.marketPot +
      actorSkill * SCORE_WEIGHTS.mp.acting +
      project.hype * SCORE_WEIGHTS.mp.hype) *
      chemFactor,
    0,
    100,
  )

  const { boxOffice, reputationGain } = computeBoxOfficeAndGain(state, project, ap, mp, rng)
  const reviews = computeCriticReviews(state, project, ap, rng)
  const criticScore =
    reviews.length > 0
      ? Math.round(reviews.reduce((a, r) => a + r.score, 0) / reviews.length)
      : Math.round(ap)
  // 影评口碑影响声誉（±6 封顶）；观众容忍度惩罚低口碑片（GDD §6）
  const finalRepGain = clamp(
    reputationGain + Math.round((criticScore - 50) / 15) - tolerancePenalty(state, criticScore),
    -3,
    6,
  )

  const groupPerformance = buildGroupPerformance(state, project, rng)

  return {
    name: project.name,
    scores,
    vfx: round1(vfx),
    specific: round1(specific),
    ap: round1(ap),
    mp: round1(mp),
    criticScore,
    reviews,
    boxOffice: round1(boxOffice),
    reputationGain: finalRepGain,
    groupPerformance,
    week: state.calendar.week,
    year: state.calendar.year,
  }
}

/** 档期竞争惩罚：本周与上一周上映的对手片数 × 系数（上限 maxPenalty） */
export function competitionPenalty(state: GameState, week: number): number {
  const overlapStart = week - WORLD_CONFIG.competition.overlapWeeks
  let count = 0
  for (const c of state.world.competitors) {
    for (const f of c.history) {
      if (f.year === state.calendar.year && f.week >= overlapStart && f.week <= week) {
        count += 1
      }
    }
  }
  return Math.min(
    WORLD_CONFIG.competition.maxPenalty,
    count * WORLD_CONFIG.competition.penaltyPerFilm,
  )
}

/** 特效等级：按 VFX 技能取最高档 */
export function vfxTier(vfxSkill: number): { minSkill: number; label: string; max: number } {
  const valid = VFX_CONFIG.tiers.filter((t) => vfxSkill >= t.minSkill)
  return valid[valid.length - 1]
}

/** 类型特效加成系数；mocap 为动作捕捉科技增量（动作/战争类在基础 ×1.2 上叠加） */
export function vfxTypeFactor(type: FilmType, mocap = 0): number {
  const base = VFX_CONFIG.typeFactor[type]
  if ((type === 'action' || type === 'war') && mocap > 0) {
    return base * (1 + mocap)
  }
  return base
}

/** 渠道分账收入：票房 × Σ(所选渠道 factor)；未选渠道时默认仅影院 */
export function channelRevenue(project: FilmProject, boxOffice: number): number {
  const channels: Channel[] = project.channels.length > 0 ? project.channels : ['cinema']
  return channels.reduce((s, ch) => s + boxOffice * CHANNEL_INFO[ch].factor, 0)
}

/** 逐影评人评分：以 AP 为基础，按类型偏好加减分 + 小幅波动 */
export function computeCriticReviews(
  state: GameState,
  project: FilmProject,
  ap: number,
  rng: Rng,
): CriticReview[] {
  const script = state.scripts[project.scriptId]
  return state.world.critics.map((c) => {
    let s = ap
    if (c.taste === 'none') {
      // 无偏好
    } else if (c.taste === script.type) {
      s += WORLD_CONFIG.tasteBonus
    } else {
      s -= WORLD_CONFIG.tasteMismatchPenalty
    }
    s += (rng() - 0.5) * 10
    return { criticId: c.id, criticName: c.name, score: Math.round(clamp(s, 0, 100)) }
  })
}

/** 影评人平均分（兼容旧调用） */
export function computeCriticScore(
  state: GameState,
  project: FilmProject,
  ap: number,
  rng: Rng,
): number {
  const reviews = computeCriticReviews(state, project, ap, rng)
  if (reviews.length === 0) return Math.round(ap)
  return Math.round(reviews.reduce((a, r) => a + r.score, 0) / reviews.length)
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
  // 观众群体契合：类型偏好结构加成；主攻地区按当地偏好 + 集中发行加成（GDD §6）
  const audienceFactor = audienceFit(state, script.type, project.targetRegion)
  const repFactor = 1 + (state.company.reputation / 100) * f.reputationSpan
  // 续作基础观众加成（GDD §3.8）：IP 等级越高，系列观众基础越厚
  let ipFactor = 1
  if (project.ipId) {
    const ip = state.company.ips.find((x) => x.id === project.ipId)
    if (ip) ipFactor = 1 + ip.level * IP_CONFIG.sequelBonusPerLevel
  }
  const compFactor = 1 - competitionPenalty(state, state.calendar.week)
  // 市场事件：行业景气/寒潮/类型热潮（GDD §6 Random Events）
  const eventFactor = eventBoxOfficeFactor(state, script.type)
  const random = 1 + (rng() - 0.5) * 2 * SCORE_WEIGHTS.variance

  const boxOffice =
    base *
    mpFactor *
    hypeFactor *
    trendFactor *
    audienceFactor *
    repFactor *
    compFactor *
    ipFactor *
    eventFactor *
    random
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
