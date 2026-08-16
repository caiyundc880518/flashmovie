import type { FilmType, GameState } from '../types'
import { WORLD_CONFIG } from '../config/world'

/**
 * 观众契合度（GDD §6）：按群体规模 × 类型关注度加权。
 * factor = fitMin + Σ(size × focus) × fitSpan，约 [0.8, 1.3]
 */
export function audienceFit(state: GameState, type: FilmType): number {
  const list = state.world.audience
  if (!list || list.length === 0) return 1
  const cfg = WORLD_CONFIG.audience
  const weighted = list.reduce((s, g) => s + g.size * g.focus[type], 0)
  return cfg.fitMin + weighted * cfg.fitSpan
}

/** 观众平均容忍度（按规模加权，0–1） */
export function avgTolerance(state: GameState): number {
  const list = state.world.audience
  if (!list || list.length === 0) return 0.5
  const total = list.reduce((s, g) => s + g.size, 0)
  if (total <= 0) return 0.5
  return list.reduce((s, g) => s + g.size * g.tolerance, 0) / total
}

/** 低口碑片的观众容忍度惩罚：criticScore < 60 时按(60-score)/10 × 系数 × (1-容忍度) 扣声誉 */
export function tolerancePenalty(state: GameState, criticScore: number): number {
  if (criticScore >= 60) return 0
  const cfg = WORLD_CONFIG.audience
  const tolerance = avgTolerance(state)
  return Math.round(((60 - criticScore) / 10) * cfg.tolerancePenaltyPer10 * (1 - tolerance))
}
