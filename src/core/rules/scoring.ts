import type { CriticReview, FilmProject, FilmResult, FilmScores, FilmType, GameState, RoleId } from '../types'
import { SCORE_WEIGHTS } from '../config/weights'
import { ECONOMY } from '../config/economy'
import { CHANNEL_CONFIG, TOTAL_CINEMAS } from '../config/channels'
import { WORLD_CONFIG } from '../config/world'
import { CHEMISTRY } from '../config/company'
import { IP_CONFIG } from '../config/ip'
import { VFX_CONFIG } from '../config/minigame'
import { AD_CONFIG } from '../config/ads'
import { allocBonus } from '../config/budget'
import { chemistryScoreFactor, goldenCombos } from './chemistry'
import { techBonuses } from './tech'
import { audienceFit, tolerancePenalty } from './audience'
import { eventBoxOfficeFactor, eventVfxBonus } from './events'
import { generateReviewText } from '../config/reviews'
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

  // 预算占比加成（GDD §3.3）：着重剧情/表演/剪辑按占比线性加成对应分项
  const alloc = project.budgetAlloc ?? { story: 0, vfx: 0, acting: 0, edit: 0 }
  scores.story = clamp(scores.story + allocBonus(alloc.story), 0, 100)
  scores.acting = clamp(scores.acting + allocBonus(alloc.acting), 0, 100)
  scores.edit = clamp(scores.edit + allocBonus(alloc.edit), 0, 100)

  // 科技树加成：渲染引擎抬升上限、动作捕捉增强类型系数、特效合成整体加成（GDD §5）
  const tech = techBonuses(state)
  // 市场事件加成：技术突破提升 VFX 分（GDD §6 Random Events）
  const eventVfx = eventVfxBonus(state)
  const vfxSkill = state.workers[project.team.technicianId ?? '']?.skills.vfx ?? 40
  const tier = vfxTierAt(vfxSkill, project.vfxLevel ?? 0)
  const vfxCap = tier.max + tech.render
  const vfx = clamp(
    (alloc.vfx / 100) *
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
  // 植入广告伤口碑：每家广告商 AP −apPenaltyPerAd（GDD §3.3 植入广告扩展）
  const adCount = project.adSponsorIds?.length ?? 0
  // 拍摄/剪辑小游戏加成（完美越多越高，直接加 AP/MP）
  const gameBonus = (project.shotGameBonus ?? 0) + (project.editGameBonus ?? 0)
  // 筹备预热：每 warmupPerMp 万投入 → MP +1（无上限）
  const warmupMp = Math.floor((project.warmup ?? 0) / ECONOMY.warmupPerMp)
  const ap = clamp(
    (apRaw - adCount * AD_CONFIG.apPenaltyPerAd) * chemFactor + gameBonus,
    0,
    100,
  )
  const mp = clamp(
    (script.marketPot * SCORE_WEIGHTS.mp.marketPot +
      actorSkill * SCORE_WEIGHTS.mp.acting +
      project.hype * SCORE_WEIGHTS.mp.hype) *
      chemFactor +
      warmupMp +
      gameBonus,
    0,
    100,
  )

  const { boxOffice, reputationGain } = computeBoxOfficeAndGain(state, project, ap, mp, rng)
  const reviews = computeCriticReviews(state, project, ap, rng)
  const criticScore =
    reviews.length > 0
      ? round1(reviews.reduce((a, r) => a + r.score, 0) / reviews.length)
      : round1(ap / 10)
  // 观众评分（10 分制一位小数，附观众总评）
  const audience = computeAudienceScore(state, project, ap, mp, rng)
  // 影评口碑影响声誉（10 分制 (score-5)×0.7，约 ±3.5）；观众容忍度惩罚低口碑片（GDD §6）
  // 观众口碑小幅影响声誉（±1）
  const finalRepGain = clamp(
    reputationGain +
      Math.round((criticScore - 5) * 0.7) -
      tolerancePenalty(state, criticScore) +
      (audience.score >= 7 ? 1 : audience.score <= 3.5 ? -1 : 0),
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
    audienceScore: audience.score,
    audienceText: audience.text,
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

/** 特效档位：按 VFX 技能取最高可解锁档（vfxTierAt 的上限） */
export function vfxTier(vfxSkill: number): { minSkill: number; label: string; max: number; costMul: number } {
  return vfxTierAt(vfxSkill, availableVfxTiers(vfxSkill).length - 1)
}

/** 指定档位下标下的特效档（越界 clamp 到合法区间） */
export function vfxTierAt(
  vfxSkill: number,
  level: number,
): { minSkill: number; label: string; max: number; costMul: number } {
  const tiers = VFX_CONFIG.tiers
  const idx = clamp(Math.floor(level), 0, availableVfxTiers(vfxSkill).length - 1)
  return tiers[idx]
}

/** 技能可解锁的特效档位列表（按 minSkill 过滤） */
export function availableVfxTiers(vfxSkill: number): { minSkill: number; label: string; max: number; costMul: number }[] {
  return VFX_CONFIG.tiers.filter((t) => vfxSkill >= t.minSkill)
}

/** 类型特效加成系数；mocap 为动作捕捉科技增量（动作/战争类在基础 ×1.2 上叠加） */
export function vfxTypeFactor(type: FilmType, mocap = 0): number {
  const base = VFX_CONFIG.typeFactor[type]
  if ((type === 'action' || type === 'war') && mocap > 0) {
    return base * (1 + mocap)
  }
  return base
}

/**
 * 渠道结算（单选渠道，GDD §3.6 四渠道；流媒体与发行商已取消）
 * 返回 { boxOffice: 最终票房（万，由渠道驱动）, revenue: 片方分账收入（万）, channelCost: 投放成本（万）, 渠道指标 }
 * 渠道对票房的权重：影院 > 网络 > DVD > 免费
 * - 影院：覆盖影院数 → 观影人次 → 票房放大（全国铺满可达数倍增幅）；观影人次 = 票房 ÷ 平均票价
 * - 网络：播放时长越长票房越高（平台数与时长共同加成）
 * - DVD：卖出张数 × 单价即票房（单价越高总票房越高，单价越低张数越多）
 * - 免费：播放量 × 广告单价即票房（广告收入）
 */
export function channelRevenue(
  project: FilmProject,
  gross: number,
  totalCinemas?: number,
): {
  boxOffice: number
  revenue: number
  channelCost: number
  /** 影院：观影人次（万人次） */
  admissions?: number
  /** DVD：卖出张数（万张） */
  dvdUnits?: number
  /** 免费：播放量（万次） */
  freeViews?: number
} {
  const ch = project.channel ?? 'cinema'
  const cfg = CHANNEL_CONFIG

  switch (ch) {
    case 'cinema': {
      // 全国影院总数 = 基础 5178 + 玩家自建（院线管理），投放上限与覆盖率分母随之变化
      const total = totalCinemas ?? TOTAL_CINEMAS
      const count = Math.min(project.cinemaCount || cfg.cinemaDefaultCount, total)
      const cover = Math.min(1, count / total)
      // 自建影院提升满覆盖票房上限（默认 ×4，每座 +cinemaMaxMulPerCinema）
      const maxMul = cfg.cinemaMaxMul + Math.max(0, total - TOTAL_CINEMAS) * cfg.cinemaMaxMulPerCinema
      // 影院权重最高：覆盖越广票房放大越多（0.8 → 4.0 倍）
      const mul = cfg.cinemaBaseMul + cover * (maxMul - cfg.cinemaBaseMul)
      const boxOffice = gross * mul
      const admissions = boxOffice / cfg.cinemaAvgTicket
      const revenue = boxOffice * ECONOMY.cinemaShare
      const channelCost = count * cfg.cinemaCostPerUnit
      return { boxOffice, revenue, channelCost, admissions }
    }
    case 'web': {
      const platforms = project.webPlatforms?.length > 0 ? project.webPlatforms.length : 1
      const weeks = project.webWeeks || cfg.webDefaultWeeks
      // 网络：播放时长是主要驱动，平台数小幅加成
      const weeksEff = Math.min(weeks, cfg.webWeeksCap + 1)
      const mul =
        cfg.webBaseMul *
        (1 + (platforms - 1) * cfg.webBonusPerPlatform) *
        (1 + (weeksEff - 1) * cfg.webBonusPerWeek)
      const boxOffice = gross * mul
      const revenue = boxOffice * cfg.webShare
      const channelCost = platforms * cfg.webCostPerPlatform + weeks * cfg.webCostPerWeek
      return { boxOffice, revenue, channelCost }
    }
    case 'dvd': {
      const price = project.dvdPrice || cfg.dvdRefPrice
      // DVD：卖出的钱就是票房；单价越高总票房越高（高价走质），低于网络权重
      const mul = cfg.dvdBaseMul * Math.pow(price / cfg.dvdRefPrice, cfg.dvdPricePower)
      const boxOffice = gross * mul
      const dvdUnits = Math.max(0, boxOffice / price)
      const revenue = boxOffice * cfg.dvdShare
      const channelCost = cfg.dvdSetupCost
      return { boxOffice, revenue, channelCost, dvdUnits }
    }
    case 'free': {
      const price = project.freeAdPrice || 30
      // 免费：广告收入就是票房；播放量 × 广告单价（权重最低）
      const views = gross * cfg.freeViewFactor * (1 + (project.hype ?? 0) * cfg.freeViewHypePer)
      const boxOffice = views * price
      const revenue = boxOffice * cfg.freeShare
      return { boxOffice, revenue, channelCost: 0, freeViews: views }
    }
  }
}

/** 逐影评人评分（10 分制一位小数 + 文字评语）：以 AP/10 为基础，按类型偏好加减分 + 小幅波动 */
export function computeCriticReviews(
  state: GameState,
  project: FilmProject,
  ap: number,
  rng: Rng,
): CriticReview[] {
  const script = state.scripts[project.scriptId]
  return state.world.critics.map((c) => {
    let s = ap / 10
    if (c.taste === 'none') {
      // 无偏好
    } else if (c.taste === script.type) {
      s += WORLD_CONFIG.tasteBonus
    } else {
      s -= WORLD_CONFIG.tasteMismatchPenalty
    }
    s += (rng() - 0.5) * 1.0
    const score = clamp(Math.round(s * 10) / 10, 0, 10)
    return {
      criticId: c.id,
      criticName: c.name,
      score,
      text: generateReviewText(rng, score, script.type),
    }
  })
}

/** 影评人平均分（10 分制，兼容旧调用） */
export function computeCriticScore(
  state: GameState,
  project: FilmProject,
  ap: number,
  rng: Rng,
): number {
  const reviews = computeCriticReviews(state, project, ap, rng)
  if (reviews.length === 0) return round1(ap / 10)
  return round1(reviews.reduce((a, r) => a + r.score, 0) / reviews.length)
}

/**
 * 观众评分（10 分制一位小数，附观众总评）：
 * 观众更看重市场分（MP）与类型契合，宣发热度小幅加成。
 */
export function computeAudienceScore(
  state: GameState,
  project: FilmProject,
  ap: number,
  mp: number,
  rng: Rng,
): { score: number; text: string } {
  const script = state.scripts[project.scriptId]
  const base = (mp * 0.7 + ap * 0.3) / 10
  const fit = audienceFit(state, script.type, project.targetRegion)
  const fitAdjust = (fit - 1) * 5 // 契合 ×0.8–1.3 → ±1.5
  const hypeAdjust = ((project.hype - 50) / 50) * 0.5 // 宣发 ±0.5
  const score = clamp(Math.round((base + fitAdjust + hypeAdjust + (rng() - 0.5) * 0.6) * 10) / 10, 0, 10)
  return { score, text: generateReviewText(rng, score, script.type, true) }
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
