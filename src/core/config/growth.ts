import type { RoleId } from '../types'

/**
 * 员工成长配置（GDD §4.4 / §7.4）
 */
export const GROWTH = {
  /** 每个项目基准经验 */
  experiencePerProject: 100,
  /** 职位经验权重 */
  roleExperienceWeight: {
    producer: 0.8,
    director: 1.2,
    writer: 1.0,
    actor: 1.0,
    shooter: 0.9,
    editor: 0.9,
    technician: 0.8,
    market: 0.9,
    assistant: 0.6,
  } satisfies Record<RoleId, number>,
  /** 经验 → 技能点基础转换率 */
  learnBase: 0.5,
  /** 每点 Gift 的转换加成 */
  giftBonus: 0.01,
  /** 每点 Intelligence 的转换加成 */
  intelBonus: 0.005,
  /** 连续空闲多少周后开始衰减 */
  decayAfterWeeks: 8,
  /** 技能每周衰减比例（长期闲置才会明显退化） */
  decayPerWeek: 0.004,
  /** Fame 每周衰减比例 */
  fameDecayPerWeek: 0.002,
  /** 升级所需累计经验阈值（V2 起用） */
  levelThreshold: 200,
} as const
