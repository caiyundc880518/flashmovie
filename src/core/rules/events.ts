import type { FilmType, GameState } from '../types'

/** 进行中市场事件的全局票房乘数（boom/slump 全局 × 类型热潮按类型） */
export function eventBoxOfficeFactor(state: GameState, type: FilmType): number {
  let f = 1
  for (const e of state.world.activeEvents) {
    if (e.boxOfficeMul) f *= e.boxOfficeMul
    if (e.type === type && e.typeBoomMul) f *= e.typeBoomMul
  }
  return f
}

/** 进行中市场事件的 VFX 分加成比例（技术突破） */
export function eventVfxBonus(state: GameState): number {
  return state.world.activeEvents.reduce((s, e) => s + (e.vfxBonus ?? 0), 0)
}
