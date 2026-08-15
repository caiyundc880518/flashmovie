/**
 * 写作学校 + 投资人 + 化学反应 配置（GDD §3.1 / §4.4 / §4.5）
 */

/** 写作学校：等级 0–3，升级费用（万），效果 */
export const SCHOOL_CONFIG = {
  /** 各等级升级费用：升到第 i 级需要 upgradeCost[i]（万）；0 为初始 */
  upgradeCost: [0, 400, 1000, 2200],
  /** 每级签约编剧产出质量加成（×） */
  writerQualityPerLevel: 0.05,
  /** 每级「精品剧本」触发概率（每部产出 ×） */
  boutiqueChancePerLevel: 0.08,
  /** 精品剧本属性加成 */
  boutiqueBonus: 20,
} as const

/** 投资人 */
export const INVESTOR_CONFIG = {
  /** 数量范围 */
  count: [2, 4] as const,
  /** 投资人名池 */
  names: ['唐氏资本', '金桥投资', '星辉基金', '万象风投', '晨曦资本', '远望基金'],
  /** 出资基数范围（万） */
  investmentBaseRange: [800, 1500] as const,
  /** 出资 = investmentBase + 公司声誉 × investmentPerRep */
  investmentPerRep: 15,
  /** 分成比例范围 0–1 */
  shareRange: [0.2, 0.4] as const,
  /** 待回收金额 = 出资 × repayMultiplier */
  repayMultiplier: 1.2,
} as const

/** 化学反应（GDD §4.5） */
export const CHEMISTRY = {
  /** 相性相似度用的属性（精神×3 + 身体×1） */
  attrs: ['dedication', 'adaptability', 'versatility', 'charisma'] as const,
  /** 每次共同合作经验 +分（上限） */
  collabPer: 4,
  collabCap: 16,
  /** 黄金组合：共同合作次数 ≥ 且相性 ≥ 阈值 */
  goldenComboTimes: 3,
  goldenThreshold: 70,
  /** 团队化学 0–100 → 成片基础分 ×（1 ± scoreEffect/2），±10% */
  scoreEffect: 0.2,
  /** 团队化学对拍摄速度的影响（±10%） */
  speedEffect: 0.1,
  /** 黄金组合成片加成（加到 Specific） */
  goldenSpecificBonus: 2,
} as const

/** TMA 颁奖典礼（GDD §6 / §3.7） */
export const TMA_CONFIG = {
  /** 奖项顺序 */
  categories: ['最佳影片', '最佳导演', '最佳演员', '最佳摄影', '最佳剪辑', '最佳特效'] as const,
  /** 我方获最佳影片：声誉 + */
  pictureBonus: 3,
  /** 我方获个人奖项：声誉 + */
  winnerRepBonus: 1,
  /** 得奖员工 Fame + */
  workerFameGain: 10,
} as const
