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
  costPerStage: 10,
  /** VFX：预算加成 = vfxPercent/100 × vfxCostFactor */
  vfxCostFactor: 0.5,
  /** 植入广告：一次性收入（万），代价 AP-10 */
  adDealIncome: 80,
  adDealApPenalty: 10,
  /** 签约编剧签约费 / 雇佣员工签约费（万） */
  hireWriterSignFee: 50,
  hireWorkerSignFee: 20,

  /** 宣发：每点 Hype 成本（万） */
  costPerHypePoint: 2,
  /** 宣发预算上限（万/片） */
  marketingBudgetCap: 500,

  /** 影院分账（片方所得比例，自发行） */
  cinemaShare: 0.45,
  /**
   * 票房基准 = 场次数 × boxOfficeBasePerStage（万）。
   * 目标平衡：中型电影总成本约 500–800 万（预算+薪酬+宣发），
   * 平均票房分账后应让"决策达标"的片盈利 30%–100%。
   */
  boxOfficeBasePerStage: 150,
  /** 票房修正系数范围 */
  boxOfficeFactor: {
    /** mp 0–100 → 0.4–2.0 */
    mpMin: 0.4,
    mpSpan: 1.6,
    /** hype 0–100 → 1–2 */
    hypeSpan: 1.0,
    /** trend 契合 0–1 → 1–1.3 */
    trendSpan: 0.3,
    /** 声誉 0–100 → 1–1.5 */
    reputationSpan: 0.5,
  },
} as const
