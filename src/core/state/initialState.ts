import type { GameState } from '../types'
import { FILM_TYPES } from '../types'
import { ECONOMY } from '../config/economy'
import { SCRIPT_POOL } from '../config/scripts'
import { WORLD_CONFIG } from '../config/world'
import { SAVE_VERSION } from '../save/schema'
import type { Rng } from '../rng'
import { createRng, pick, randInt } from '../rng'
import { generateMarketScripts } from '../generators/scriptGen'
import { generateCandidates } from '../generators/workerGen'

/** 创建新档（种子可复现） */
export function createInitialState(seed?: number): GameState {
  const s = seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
  const rng: Rng = createRng(s)
  let counter = 1

  const marketScripts = generateMarketScripts(
    rng,
    randInt(rng, SCRIPT_POOL.marketScriptCount[0], SCRIPT_POOL.marketScriptCount[1]),
  ).map((sc) => ({ ...sc, id: `scr${(counter++).toString(36)}` }))
  const candidates = generateCandidates(rng, randInt(rng, 4, 6)).map((w) => ({
    ...w,
    id: `wrk${(counter++).toString(36)}`,
  }))

  // AI 竞争对手（2–5 家）
  const namePool = [...WORLD_CONFIG.competitorNames]
  const competitors = Array.from(
    { length: randInt(rng, WORLD_CONFIG.competitorCount[0], WORLD_CONFIG.competitorCount[1]) },
    () => ({
      id: `comp${(counter++).toString(36)}`,
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

  // 影评人（3–5 位）
  const criticNamePool = [...WORLD_CONFIG.criticNames]
  const critics = Array.from(
    { length: randInt(rng, WORLD_CONFIG.criticCount[0], WORLD_CONFIG.criticCount[1]) },
    () => ({
      id: `crit${(counter++).toString(36)}`,
      name: pick(rng, criticNamePool),
      taste: rng() < 0.6 ? pick(rng, FILM_TYPES) : ('none' as const),
      influence: randInt(
        rng,
        WORLD_CONFIG.criticInfluenceRange[0],
        WORLD_CONFIG.criticInfluenceRange[1],
      ),
    }),
  )

  const state: GameState = {
    version: SAVE_VERSION,
    seed: s,
    idCounter: counter,
    calendar: { year: 1, week: 1 },
    company: {
      name: '星光影业',
      cash: ECONOMY.startingCash,
      reputation: ECONOMY.startingReputation,
      loans: [],
      ownedScriptIds: [],
      employeeIds: [],
      history: [],
    },
    world: {
      marketScripts,
      marketRefreshIn: randInt(
        rng,
        SCRIPT_POOL.marketRefreshWeeks[0],
        SCRIPT_POOL.marketRefreshWeeks[1],
      ),
      candidates,
      trend: { type: pick(rng, FILM_TYPES), untilWeek: randInt(rng, 26, 52) },
      competitors,
      critics,
      news: [
        {
          id: 'news0',
          week: 1,
          text: '欢迎来到星光影业！签下你的第一批员工，从第一部电影开始帝国之旅。',
          kind: 'hype',
          value: 0,
        },
      ],
    },
    workers: {},
    scripts: {},
    projects: [],
    writerQueues: {},
  }
  return state
}
