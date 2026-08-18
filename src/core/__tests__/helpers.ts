import { reduce } from '../state/reducer'
import type { GameState } from '../types'

/**
 * 测试辅助：定档上映（weeks 提前周数）并推进到首轮下片（一次性结算完成）。
 * 返回推进后的状态；若 60 周内未下片则强制返回（避免死循环）。
 */
export function releaseAndFinish(s: GameState, projectId: string, weeks = 0): GameState {
  let st = reduce(s, { type: 'release', projectId, weeks })
  for (let i = 0; i < 60; i++) {
    st = reduce(st, { type: 'advanceWeek' })
    const p = st.projects.find((x) => x.id === projectId)
    if (p?.run?.firstRunEnded) break
  }
  return st
}

/** 推进 N 周 */
export function advanceN(s: GameState, n: number): GameState {
  let st = s
  for (let i = 0; i < n; i++) st = reduce(st, { type: 'advanceWeek' })
  return st
}
