/**
 * 预算占比配置（GDD §3.3 预算分配扩展）
 * 立项第三步设定四项"着重预算占比"（剧情/VFX/表演/剪辑），总和不得超过 100%，
 * 剩余部分为常规制作。占比越高，对应成片分项结算加成越多：
 * - 剧情 → scores.story 加成
 * - VFX  → VFX 分加成（沿用原 vfxPercent 语义）
 * - 表演 → scores.acting 加成
 * - 剪辑 → scores.edit 加成
 * 加成公式：bonus = 占比/100 × maxBonus。
 */
export interface BudgetAlloc {
  /** 着重剧情预算占比 0–100 */
  story: number
  /** 着重 VFX 预算占比 0–100（原 vfxPercent） */
  vfx: number
  /** 着重表演预算占比 0–100 */
  acting: number
  /** 着重剪辑预算占比 0–100 */
  edit: number
}

export const BUDGET_CONFIG = {
  /** 单项占比上限 */
  maxAlloc: 100,
  /** 四项总和上限 */
  totalCap: 100,
  /** 100% 占比时对应分项的最大加成（线性插值） */
  maxBonus: 15,
  /** 非 VFX 三项的预算成本系数（总成本 = 基础 × (1 + 总占比/100 × factor)） */
  allocCostFactor: 0.5,
} as const

/** 均衡分配：四项各 25% */
export const BALANCED_ALLOC: BudgetAlloc = { story: 25, vfx: 25, acting: 25, edit: 25 }

/** 预算占比 → 分项加成 */
export function allocBonus(percent: number): number {
  return (percent / 100) * BUDGET_CONFIG.maxBonus
}

/** 四项总和 */
export function allocTotal(a: BudgetAlloc): number {
  return a.story + a.vfx + a.acting + a.edit
}
