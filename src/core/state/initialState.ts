import type { GameState } from '../types'
import { FILM_TYPES } from '../types'
import { ECONOMY } from '../config/economy'
import { SCRIPT_POOL } from '../config/scripts'
import { SAVE_VERSION } from '../save/schema'
import type { Rng } from '../rng'
import { createRng, pick, randInt } from '../rng'
import { generateMarketScripts } from '../generators/scriptGen'
import { generateCandidates } from '../generators/workerGen'
import {
  generateAudienceGroups,
  generateCompetitors,
  generateCritics,
  generateInvestors,
  generatePublishers,
} from '../generators/worldGen'

/** 创建新档（种子可复现；公司名自定义，默认星光影业） */
export function createInitialState(seed?: number, companyName = '星光影业'): GameState {
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

  const competitors = generateCompetitors(rng, (p) => `${p}${(counter++).toString(36)}`)
  const critics = generateCritics(rng, (p) => `${p}${(counter++).toString(36)}`)
  const audience = generateAudienceGroups(rng, (p) => `${p}${(counter++).toString(36)}`)
  const publishers = generatePublishers(rng, (p) => `${p}${(counter++).toString(36)}`)
  const investors = generateInvestors(rng, (p) => `${p}${(counter++).toString(36)}`)

  const state: GameState = {
    version: SAVE_VERSION,
    seed: s,
    idCounter: counter,
    calendar: { year: 1, week: 1 },
    company: {
      name: companyName,
      cash: ECONOMY.startingCash,
      reputation: ECONOMY.startingReputation,
      schoolLevel: 0,
      loans: [],
      ownedScriptIds: [],
      employeeIds: [],
      history: [],
      ips: [],
      tech: {},
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
      audience,
      activeEvents: [],
      publishers,
      investors,
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
    scriptDrafts: [],
    cheats: { noCaDecay: false },
  }
  return state
}
