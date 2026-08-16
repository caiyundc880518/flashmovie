/**
 * 写作学校 + 投资人 + 化学反应 配置（GDD §3.1 / §4.4 / §4.5）
 */

/** 写作学校：等级 0–5（上市后解锁 4–5 级），升级费用（万），效果 */
export const SCHOOL_CONFIG = {
  /** 各等级升级费用：升到第 i 级需要 upgradeCost[i]（万）；0 为初始 */
  upgradeCost: [0, 400, 1000, 2200, 3800, 6000],
  /** 普通上限 / 上市后上限 */
  maxLevel: 3,
  maxLevelPublic: 5,
  /** 每级签约编剧产出质量加成（×） */
  writerQualityPerLevel: 0.05,
  /** 每级「精品剧本」触发概率（每部产出 ×） */
  boutiqueChancePerLevel: 0.08,
  /** 精品剧本属性加成 */
  boutiqueBonus: 20,
} as const

/** IPO 上市（GDD §3.1 融资：上市融资，解锁大规模扩张） */
export const IPO_CONFIG = {
  /** 上市条件：最低声誉 0–100 */
  minReputation: 60,
  /** 上市条件：累计片方收入（万，V3 长线校准后定为中期目标） */
  minTotalRevenue: 16000,
  /** 估值 = 声誉 × perRep + 累计收入 × revenueRatio（万） */
  valuationPerRep: 60,
  valuationRevenueRatio: 0.6,
  /** 融资额 = 估值 × raiseRatio */
  raiseRatio: 0.35,
  /** 季度股东分红 = max(分红基数, 现金 × 比例)（万；上市后压制现金滚雪球） */
  dividendBase: 50,
  dividendRatio: 0.05,
  /** 上市后贷款额度倍数（原 ECONOMY.loanCapFactor ×3） */
  loanCapFactorAfter: 5,
  /** 上市后 IP 季度授权收入倍率 */
  ipRoyaltyMultiplier: 1.5,
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
