import type { Critic, GameState } from '../types'
import { FILM_TYPES } from '../types'
import { FILM_TYPE_ZH } from '../config/events'
import { WORLD_CONFIG } from '../config/world'
import type { Rng } from '../rng'
import { chance, pick, randInt } from '../rng'
import { pushNews, uid } from '../state/utils'

/**
 * 年度影评人换血（GDD §6）：每年底以 criticRetireChance 概率随机 1 位影评人退休，
 * 从名池补入新锐影评人，始终维持 5 位。退休者名字回归可用池，可再次登场。
 */
export function annualCriticRotation(state: GameState, rng: Rng): void {
  const critics = state.world.critics
  if (critics.length === 0) return
  if (!chance(rng, WORLD_CONFIG.criticRetireChance)) return

  // 随机退休 1 位
  const retireIdx = Math.floor(rng() * critics.length)
  const retiree = critics[retireIdx]
  critics.splice(retireIdx, 1)

  // 名池中未被占用的名字（退休者名字自然回到可用池）
  const usedNames = new Set(critics.map((c) => c.name))
  const namePool = WORLD_CONFIG.criticNames.filter((nm) => !usedNames.has(nm))
  const name = namePool[Math.floor(rng() * namePool.length)]

  const newcomer: Critic = {
    id: uid(state, 'crit'),
    name,
    taste: rng() < 0.6 ? pick(rng, FILM_TYPES) : ('none' as const),
    influence: randInt(
      rng,
      WORLD_CONFIG.criticInfluenceRange[0],
      WORLD_CONFIG.criticInfluenceRange[1],
    ),
  }
  critics.push(newcomer)

  pushNews(
    state,
    `【影评人动态】${retiree.name}宣布退休，新锐影评人「${newcomer.name}」入驻${
      newcomer.taste !== 'none'
        ? `，偏爱${FILM_TYPE_ZH[newcomer.taste]}片`
        : '，口味多元'
    }。`,
  )
}
