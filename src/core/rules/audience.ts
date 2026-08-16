import type { FilmType, GameState } from '../types'
import { FILM_TYPES } from '../types'
import { WORLD_CONFIG } from '../config/world'

/** 地区市场（由观众群体按 region 聚合，GDD §6 Area） */
export interface RegionMarket {
  region: string
  /** 市场规模占比 0–1 */
  size: number
  /** 地区内部类型偏好（按群体规模加权均值） */
  focus: Record<FilmType, number>
}

/** 按地区聚合观众群体 → 地区市场列表（按规模降序） */
export function regionMarkets(state: GameState): RegionMarket[] {
  const list = state.world.audience ?? []
  const map = new Map<string, { size: number; focus: Record<FilmType, number>; count: number }>()
  for (const g of list) {
    const cur = map.get(g.region) ?? {
      size: 0,
      focus: { comedy: 0, horror: 0, action: 0, love: 0, war: 0, drama: 0 },
      count: 0,
    }
    cur.size += g.size
    cur.count += 1
    for (const t of FILM_TYPES) {
      cur.focus[t] = (cur.focus[t] * (cur.count - 1) + g.focus[t]) / cur.count
    }
    map.set(g.region, cur)
  }
  return [...map.entries()]
    .map(([region, v]) => ({ region, size: v.size, focus: v.focus }))
    .sort((a, b) => b.size - a.size)
}

/**
 * 观众契合度（GDD §6）：按群体规模 × 类型关注度加权。
 * factor = fitMin + Σ(size × focus) × fitSpan，约 [0.8, 1.3]
 * @param targetRegion 主攻地区：只按该地区偏好结算，并叠加集中发行加成
 */
export function audienceFit(state: GameState, type: FilmType, targetRegion?: string): number {
  const list = state.world.audience
  if (!list || list.length === 0) return 1
  const cfg = WORLD_CONFIG.audience
  const targeted = targetRegion ? list.filter((g) => g.region === targetRegion) : null
  const use = targeted && targeted.length > 0 ? targeted : list
  const sizeSum = use.reduce((s, g) => s + g.size, 0)
  if (sizeSum <= 0) return 1
  const weighted = use.reduce((s, g) => s + (g.size / sizeSum) * g.focus[type], 0)
  let factor = cfg.fitMin + weighted * cfg.fitSpan
  // 主攻地区：集中发行加成与当地契合挂钩（选对加成大、错配加成小）
  if (targeted && targeted.length > 0) {
    factor += sizeSum * WORLD_CONFIG.region.targetBoost * weighted
  }
  return factor
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
