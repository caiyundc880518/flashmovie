/** 成片评分权重（GDD §7.2 示例） */
export const SCORE_WEIGHTS = {
  /** 六项基础分权重（合计 1.0） */
  base: {
    story: 0.3,
    directing: 0.2,
    acting: 0.2,
    shooting: 0.15,
    edit: 0.1,
    music: 0.05,
  },
  /** VFX 分上限（加到基础分上） */
  vfxMax: 15,
  /** Specific 特色加成上限 */
  specificMax: 10,
  /** 小游戏/随机事件 Buff 幅度（±） */
  buffRange: [-8, 8],
  /** AP 艺术向加权（合计 1.0） */
  ap: {
    story: 0.35,
    artPot: 0.25,
    directing: 0.25,
    shooting: 0.15,
  },
  /** MP 市场向加权（合计 1.0） */
  mp: {
    marketPot: 0.4,
    acting: 0.3,
    hype: 0.3,
  },
  /** 随机波动上限（±10%） */
  variance: 0.1,
} as const
