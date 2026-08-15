import type { FilmType } from '../types'

/** 拍摄/剪辑小游戏配置（GDD §3.3 / §3.4 Buff Mini Game） */
export const TIMING_CONFIG = {
  /** 每局轮数 */
  rounds: 3,
  /** 判定阈值：标记距目标中心 < perfectZone 完美，< goodZone 好，否则失误 */
  perfectZone: 0.08,
  goodZone: 0.2,
  /** 标记移动速度（整条宽度/秒） */
  speed: 1.1,
  /** 各判定对应的成片 Buff（±） */
  shotBuff: { perfect: 3, good: 1, miss: -1 },
  editBuff: { perfect: 3, good: 2, miss: -1 },
} as const

/** VFX 系统（GDD §3.3 VFX Setting）：技能分级特效 + 类型加成 */
export const VFX_CONFIG = {
  /** 特效等级：按技术员 VFX 技能分级，决定 VFX 分上限 */
  tiers: [
    { minSkill: 0, label: '基础特效', max: 15 },
    { minSkill: 50, label: '标准特效', max: 20 },
    { minSkill: 75, label: '顶级特效', max: 26 },
  ],
  /** 类型加成：动作/战争特效吃香，文戏类型加成弱 */
  typeFactor: {
    action: 1.2,
    war: 1.2,
    comedy: 0.85,
    horror: 0.9,
    love: 0.85,
    drama: 0.9,
  } satisfies Record<FilmType, number>,
} as const
