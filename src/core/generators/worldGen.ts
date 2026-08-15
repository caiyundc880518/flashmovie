import type { Competitor, Critic, Investor, Publisher } from '../types'
import { FILM_TYPES } from '../types'
import { WORLD_CONFIG } from '../config/world'
import { PUBLISHER_CONFIG } from '../config/channels'
import { INVESTOR_CONFIG } from '../config/company'
import type { Rng } from '../rng'
import { pick, randInt, round1 } from '../rng'

/** 生成 AI 竞争对手（2–5 家） */
export function generateCompetitors(rng: Rng, uid: (prefix: string) => string): Competitor[] {
  const namePool = [...WORLD_CONFIG.competitorNames]
  return Array.from(
    { length: randInt(rng, WORLD_CONFIG.competitorCount[0], WORLD_CONFIG.competitorCount[1]) },
    () => ({
      id: uid('comp'),
      name: pick(rng, namePool),
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
    }),
  )
}

/** 生成影评人（3–5 位） */
export function generateCritics(rng: Rng, uid: (prefix: string) => string): Critic[] {
  const namePool = [...WORLD_CONFIG.criticNames]
  return Array.from(
    { length: randInt(rng, WORLD_CONFIG.criticCount[0], WORLD_CONFIG.criticCount[1]) },
    () => ({
      id: uid('crit'),
      name: pick(rng, namePool),
      taste: rng() < 0.6 ? pick(rng, FILM_TYPES) : ('none' as const),
      influence: randInt(
        rng,
        WORLD_CONFIG.criticInfluenceRange[0],
        WORLD_CONFIG.criticInfluenceRange[1],
      ),
    }),
  )
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
