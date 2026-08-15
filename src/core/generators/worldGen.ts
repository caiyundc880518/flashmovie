import type { Competitor, Critic } from '../types'
import { FILM_TYPES } from '../types'
import { WORLD_CONFIG } from '../config/world'
import type { Rng } from '../rng'
import { pick, randInt } from '../rng'

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
