import type { GameState } from '../types'
import { TECH_CONFIG, TECH_LINES, techLevel } from '../config/tech'

/** 各科技线的当前等级加成汇总 */
export interface TechBonuses {
  /** 渲染引擎：VFX 分上限叠加点数 */
  render: number
  /** 虚拟制片：VFX 预算成本降低比例 0–1 */
  studio: number
  /** 动作捕捉：动作/战争类型特效系数增量（加到基础 1.2 上） */
  mocap: number
  /** 特效合成：VFX 分整体加成比例 0–1 */
  comp: number
}

/** 按科技 id 取当前等级（便捷封装） */
export function techLevelOf(state: GameState, id: string): number {
  const line = TECH_LINES.find((l) => l.id === id)
  if (!line) return 0
  return techLevel(state.company.tech, id, line.maxLevel)
}

/** 汇总当前全部科技加成 */
export function techBonuses(state: GameState): TechBonuses {
  const lv = (id: string) => techLevelOf(state, id)
  const value = (id: string) => {
    const line = TECH_LINES.find((l) => l.id === id)
    const level = lv(id)
    if (!line || level <= 0) return 0
    return line.values[level - 1] ?? 0
  }
  return {
    render: value('render'),
    studio: value('studio'),
    mocap: value('mocap'),
    comp: value('comp'),
  }
}

/** 当前级研发进度（0–100，用于 UI 进度条） */
export function techProgressInLevel(
  tech: Record<string, number>,
  id: string,
): number {
  return (tech[id] ?? 0) % TECH_CONFIG.progressPerLevel
}
