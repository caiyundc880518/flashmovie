import type { GameState } from '../types'
import { CHANNEL_CONFIG, TOTAL_CINEMAS } from '../config/channels'

/** 全国影院总家数 = 基础 5178 + 玩家自建（院线管理；所有投放/覆盖率计算以此为准） */
export function totalCinemas(state: GameState): number {
  return TOTAL_CINEMAS + Math.max(0, Math.round(state.company.ownCinemas ?? 0))
}

/** 影院渠道满覆盖票房上限：自建影院越多，全国铺满时放大越高 */
export function cinemaMaxMul(state: GameState): number {
  const own = Math.max(0, Math.round(state.company.ownCinemas ?? 0))
  return CHANNEL_CONFIG.cinemaMaxMul + own * CHANNEL_CONFIG.cinemaMaxMulPerCinema
}

/** 建造 count 座影院的总造价（万） */
export function cinemaBuildCost(count: number): number {
  return Math.max(0, Math.round(count)) * CHANNEL_CONFIG.cinemaBuildCost
}

/** 自建影院总数（供 UI 展示） */
export function ownCinemas(state: GameState): number {
  return Math.max(0, Math.round(state.company.ownCinemas ?? 0))
}
