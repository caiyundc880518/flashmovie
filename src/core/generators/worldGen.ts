import type { AudienceGroup, Competitor, CompetitorPersonality, Critic, Investor, Publisher } from '../types'
import { FILM_TYPES, type FilmType } from '../types'
import { WORLD_CONFIG } from '../config/world'
import { PUBLISHER_CONFIG } from '../config/channels'
import { INVESTOR_CONFIG } from '../config/company'
import type { Rng } from '../rng'
import { clamp, pick, randInt, round1 } from '../rng'

/** 按权重随机抽一个性格 */
export function pickPersonality(rng: Rng): CompetitorPersonality {
  const weights = WORLD_CONFIG.competitor.personalityWeights
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  let roll = rng() * total
  for (const [k, w] of Object.entries(weights)) {
    roll -= w
    if (roll <= 0) return k as CompetitorPersonality
  }
  return 'balanced'
}

/** 专精型：随机锁定 1–2 个类型 */
function pickHomeTypes(rng: Rng): FilmType[] {
  const count = randInt(rng, WORLD_CONFIG.competitor.specialistHomeTypes[0], WORLD_CONFIG.competitor.specialistHomeTypes[1])
  const pool = [...FILM_TYPES]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

/**
 * 生成 AI 竞争对手（2–5 家，带性格差异化）。
 * rng 只用于原有字段（数量/名字/声誉/首映延迟，保持既有随机序列不变）；
 * aiRng 用于新增 AI 字段（性格/专精类型/资金），避免扰动世界生成的确定性序列。
 */
export function generateCompetitors(
  rng: Rng,
  uid: (prefix: string) => string,
  aiRng: Rng,
): Competitor[] {
  const namePool = [...WORLD_CONFIG.competitorNames]
  const cfg = WORLD_CONFIG.competitor
  return Array.from(
    { length: randInt(rng, WORLD_CONFIG.competitorCount[0], WORLD_CONFIG.competitorCount[1]) },
    () => {
      const personality = pickPersonality(aiRng)
      // 名字从池中取出不重复（与影评人生成一致）
      const idx = Math.floor(rng() * namePool.length)
      const name = namePool.splice(idx, 1)[0]
      return {
        id: uid('comp'),
        name,
        reputation: randInt(
          rng,
          WORLD_CONFIG.competitorBaseReputation[0],
          WORLD_CONFIG.competitorBaseReputation[1],
        ),
        nextReleaseIn: randInt(
          rng,
          WORLD_CONFIG.competitorFirstReleaseDelay[0],
          WORLD_CONFIG.competitorFirstReleaseDelay[1],
        ),
        history: [],
        personality,
        homeTypes: personality === 'specialist' ? pickHomeTypes(aiRng) : undefined,
        cash: randInt(aiRng, cfg.startCash[0], cfg.startCash[1]),
        team: [],
        ips: [],
      }
    },
  )
}

/** 生成影评人（固定 5 位，名字不重复） */
export function generateCritics(rng: Rng, uid: (prefix: string) => string): Critic[] {
  const namePool = [...WORLD_CONFIG.criticNames]
  return Array.from({ length: WORLD_CONFIG.criticCount[0] }, () => {
    const idx = Math.floor(rng() * namePool.length)
    const name = namePool.splice(idx, 1)[0]
    return {
      id: uid('crit'),
      name,
      taste: rng() < 0.6 ? pick(rng, FILM_TYPES) : ('none' as const),
      influence: randInt(
        rng,
        WORLD_CONFIG.criticInfluenceRange[0],
        WORLD_CONFIG.criticInfluenceRange[1],
      ),
    }
  })
}

/** 生成发行商（2–4 家） */
export function generatePublishers(rng: Rng, uid: (prefix: string) => string): Publisher[] {
  const namePool = [...PUBLISHER_CONFIG.names]
  return Array.from(
    { length: randInt(rng, PUBLISHER_CONFIG.count[0], PUBLISHER_CONFIG.count[1]) },
    () => ({
      id: uid('pub'),
      name: pick(rng, namePool),
      reputation: randInt(rng, 30, 80),
      shareRate: round1(randInt(rng, PUBLISHER_CONFIG.shareRateRange[0] * 100, PUBLISHER_CONFIG.shareRateRange[1] * 100) / 100),
      prepayBase: randInt(rng, PUBLISHER_CONFIG.prepayBaseRange[0], PUBLISHER_CONFIG.prepayBaseRange[1]),
      prepayPerRep: PUBLISHER_CONFIG.prepayPerRep,
    }),
  )
}

/** 生成投资人（2–4 家） */
export function generateInvestors(rng: Rng, uid: (prefix: string) => string): Investor[] {
  const namePool = [...INVESTOR_CONFIG.names]
  return Array.from(
    { length: randInt(rng, INVESTOR_CONFIG.count[0], INVESTOR_CONFIG.count[1]) },
    () => ({
      id: uid('inv'),
      name: pick(rng, namePool),
      investmentBase: randInt(
        rng,
        INVESTOR_CONFIG.investmentBaseRange[0],
        INVESTOR_CONFIG.investmentBaseRange[1],
      ),
      investmentPerRep: INVESTOR_CONFIG.investmentPerRep,
      share: round1(randInt(rng, INVESTOR_CONFIG.shareRange[0] * 100, INVESTOR_CONFIG.shareRange[1] * 100) / 100),
    }),
  )
}

/** 生成观众群体（GDD §6）：6 组覆盖 6 类型，规模归一化为占比 */
export function generateAudienceGroups(rng: Rng, uid: (prefix: string) => string): AudienceGroup[] {
  const cfg = WORLD_CONFIG.audience
  // 先生成规模权重，再归一化
  const weights = cfg.groups.map(() => randInt(rng, cfg.sizeWeightRange[0], cfg.sizeWeightRange[1]))
  const total = weights.reduce((s, w) => s + w, 0)

  return cfg.groups.map((g, i) => {
    const focus = {} as Record<FilmType, number>
    // 洗牌挑次偏好类型
    const others = FILM_TYPES.filter((t) => t !== g.mainType)
    const subCount = randInt(rng, cfg.subFocusCount[0], cfg.subFocusCount[1])
    for (let j = others.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1))
      ;[others[j], others[k]] = [others[k], others[j]]
    }
    const subs = new Set(others.slice(0, subCount))
    const range = (lo: number, hi: number) => round1(lo + rng() * (hi - lo))
    for (const t of FILM_TYPES) {
      if (t === g.mainType) focus[t] = range(cfg.mainFocusRange[0], cfg.mainFocusRange[1])
      else if (subs.has(t)) focus[t] = range(cfg.subFocusRange[0], cfg.subFocusRange[1])
      else focus[t] = range(cfg.otherFocusRange[0], cfg.otherFocusRange[1])
    }
    return {
      id: uid('aud'),
      name: g.name,
      region: g.region,
      size: round1(weights[i] / total),
      tolerance: round1(range(cfg.toleranceRange[0], cfg.toleranceRange[1])),
      focus,
    }
  })
}

/** 类型焦点上限/下限（漂移用） */
export function clampFocus(v: number): number {
  return clamp(v, 0.05, 0.95)
}
