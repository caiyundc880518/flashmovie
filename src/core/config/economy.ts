/**
 * 经济配置（货币单位：万元）
 */
export const ECONOMY = {
  moneyUnit: '万元',
  /** 新公司起始资金 */
  startingCash: 1000,
  /** 起始声誉 */
  startingReputation: 10,
  /** 每周固定办公成本 */
  weeklyOfficeCost: 5,

  /** 剧本市场：价格 = 属性加权分 × 单价 */
  scriptPricePerPoint: 1.5,
  /** 出售自有剧本：价格 = marketPot × 单价（防死局保底） */
  scriptSellPerMarketPot: 2,
  /** 出售剧本保底价 */
  scriptSellFloor: 20,

  /** 员工薪资：周薪 = 角色基数 + 技能 × 技能薪资系数 */
  salaryPerSkillPoint: 0.05,

  /** 贷款：年利率、期限（周）、额度 = cash × 倍数 */
  loanRate: 0.08,
  loanWeeks: 104,
  loanCapFactor: 3,
  /** 每月还款 = 本金/期限 + 本金×利率/年周数 */
  weeksPerYear: 52,

  /** 制作成本：每场次基础成本（万） */
  costPerStage: 12,
  /** VFX：预算加成 = vfx占比/100 × vfxCostFactor × 特效档位成本系数 */
  vfxCostFactor: 0.5,
  /** 筹备预热：每投入多少万 → MP +1（无上限，投得越多加成越多） */
  warmupPerMp: 50,
  /** 签约编剧签约费 / 雇佣员工签约费（万） */
  hireWriterSignFee: 50,
  hireWorkerSignFee: 20,

  /** 影院分账（片方所得比例，自发行） */
  cinemaShare: 0.45,
  /**
   * 票房基准 = 场次数 × boxOfficeBasePerStage（万）。
   * 目标平衡（V3 长线校准）：中型片（scale 8）总成本约 600–900 万，
   * 良好决策的片 gross 1500–2500 万、渠道分账后净赚 30%–80%；
   * 明星团队 + 全加成叠满上限约 5000–7000 万，避免现金滚雪球失控。
   */
  boxOfficeBasePerStage: 110,
  /** 票房修正系数范围 */
  boxOfficeFactor: {
    /** mp 0–100 → 0.4–2.0 */
    mpMin: 0.4,
    mpSpan: 1.6,
    /** hype 0–100 → 1–1.7 */
    hypeSpan: 0.7,
    /** trend 契合 0–1 → 1–1.3 */
    trendSpan: 0.3,
    /** 声誉 0–100 → 1–1.5 */
    reputationSpan: 0.5,
  },
} as const
