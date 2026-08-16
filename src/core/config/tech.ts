/**
 * 科技树（VFX Tech，GDD §5 公司管理）
 * 4 条科技线 × 3 级，投入资金 + 技术员技能加速研发。
 * 等级由累计研发进度推导：level = floor(progress / 100)，上限 maxLevel。
 */
export const TECH_CONFIG = {
  /** 每次研发投入金额（万） */
  investCost: 120,
  /** 每次投入的基础进度 */
  progressPerInvest: 12,
  /** 技术员 VFX 技能对进度的效率加成：efficiency = 1 + avgSkill/100 × 系数 */
  techSkillEfficiency: 0.6,
  /** 每级所需进度 */
  progressPerLevel: 100,
} as const

export interface TechLine {
  id: string
  name: string
  icon: string
  /** 一句话说明 */
  desc: string
  maxLevel: number
  /** 每级数值（values[level-1]） */
  values: number[]
  /** 每级效果文案（传入当前等级 1–3） */
  effectText: (level: number) => string
}

/** 研发进度 → 等级（0–maxLevel） */
export function techLevel(tech: Record<string, number>, id: string, maxLevel: number): number {
  return Math.min(maxLevel, Math.floor((tech[id] ?? 0) / TECH_CONFIG.progressPerLevel))
}

export const TECH_LINES: TechLine[] = [
  {
    id: 'render',
    name: '渲染引擎',
    icon: '🖥️',
    desc: '自研渲染管线，突破视觉上限。',
    maxLevel: 3,
    values: [4, 8, 13],
    effectText: (lv) => `VFX 分上限 +${[4, 8, 13][lv - 1] ?? 0}`,
  },
  {
    id: 'studio',
    name: '虚拟制片',
    icon: '🎛️',
    desc: '虚拟棚拍降低特效制作成本。',
    maxLevel: 3,
    values: [0.1, 0.2, 0.3],
    effectText: (lv) => `VFX 预算成本 −${[10, 20, 30][lv - 1] ?? 0}%`,
  },
  {
    id: 'mocap',
    name: '动作捕捉',
    icon: '🦾',
    desc: '动作/战争大场面特效更震撼。',
    maxLevel: 3,
    values: [0.05, 0.1, 0.15],
    effectText: (lv) => {
      const factor = 1.2 * (1 + ([0, 0.05, 0.1, 0.15][lv] ?? 0))
      return `动作/战争类型特效 ×${factor.toFixed(2)}（基础 ×1.20）`
    },
  },
  {
    id: 'comp',
    name: '特效合成',
    icon: '✨',
    desc: '后期合成技术整体提升成片特效分。',
    maxLevel: 3,
    values: [0.06, 0.12, 0.2],
    effectText: (lv) => `VFX 分整体 +${[6, 12, 20][lv - 1] ?? 0}%`,
  },
]

export const TECH_LINE_MAP: Record<string, TechLine> = Object.fromEntries(
  TECH_LINES.map((l) => [l.id, l]),
)
