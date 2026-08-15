import type { FilmType, Gender, Script } from '../types'
import { FILM_TYPES } from '../types'
import { ECONOMY } from '../config/economy'
import { SCRIPT_POOL } from '../config/scripts'
import type { Rng } from '../rng'
import { clamp, pick, randInt, round1 } from '../rng'

/**
 * 生成剧本（来源 GDD §3.1 剧本八属性）
 */
export function generateScript(
  rng: Rng,
  owner: 'market' | 'company' | 'writer',
  writerId?: string,
): Script {
  const type: FilmType = pick(rng, FILM_TYPES)
  const title = pick(rng, SCRIPT_POOL.titles[type])
  const storyPoint = randInt(rng, SCRIPT_POOL.attrRanges.storyPoint[0], SCRIPT_POOL.attrRanges.storyPoint[1])
  const artPot = randInt(rng, SCRIPT_POOL.attrRanges.artPot[0], SCRIPT_POOL.attrRanges.artPot[1])
  const marketPot = randInt(rng, SCRIPT_POOL.attrRanges.marketPot[0], SCRIPT_POOL.attrRanges.marketPot[1])
  const famePoint = randInt(rng, SCRIPT_POOL.attrRanges.famePoint[0], SCRIPT_POOL.attrRanges.famePoint[1])
  const trend = round1(randInt(rng, 0, 10) / 10)
  const scale = randInt(rng, SCRIPT_POOL.attrRanges.scale[0], SCRIPT_POOL.attrRanges.scale[1])

  const genders: Gender[] = rng() < 0.3 ? [rng() < 0.5 ? 'male' : 'female'] : ['male', 'female']
  const requirement = {
    genders,
    minAge: randInt(rng, 18, 28),
    maxAge: rng() < 0.3 ? null : randInt(rng, 35, 60),
    minExperience: randInt(rng, 0, 3),
  }

  const quality = storyPoint * 0.3 + marketPot * 0.4 + artPot * 0.3
  const price =
    owner === 'market'
      ? clamp(
          Math.round(quality * ECONOMY.scriptPricePerPoint),
          SCRIPT_POOL.attrRanges.price[0],
          SCRIPT_POOL.attrRanges.price[1],
        )
      : 0

  return {
    id: '',
    title,
    type,
    storyPoint,
    artPot,
    marketPot,
    famePoint,
    trend,
    scale,
    requirement,
    price,
    owner,
    writerId,
  }
}

/** 生成一批市场在售剧本 */
export function generateMarketScripts(rng: Rng, count: number): Script[] {
  const out: Script[] = []
  for (let i = 0; i < count; i++) out.push(generateScript(rng, 'market'))
  return out
}
