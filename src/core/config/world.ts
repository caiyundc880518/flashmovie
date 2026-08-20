/**
 * 世界模拟配置（GDD §6：竞争对手 / 影评人 / 市场）
 */
export const WORLD_CONFIG = {
  /** 竞争对手数量范围 */
  competitorCount: [2, 5] as const,
  /** 影业名池 */
  competitorNames: [
    '远东影业',
    '银河制片',
    '天际娱乐',
    '星辰传媒',
    '曙光电影',
    '锐影集团',
    '蓝鲸影视',
    '万象影业',
    '云顶影视',
    '晨曦光影',
  ],
  /** 对手上映间隔（周）范围 */
  competitorReleaseWeeks: [5, 10] as const,
  /** 对手初始声誉范围 */
  competitorBaseReputation: [30, 70] as const,
  /** 对手首部影片延迟（周） */
  competitorFirstReleaseDelay: [3, 8] as const,

  /** NPC AI（阶段 1：性格系统；阶段 2/3 的决策与经营参数陆续接入） */
  competitor: {
    /** 性格权重（加权随机分配） */
    personalityWeights: {
      quality: 0.22,
      volume: 0.18,
      specialist: 0.22,
      sniper: 0.15,
      balanced: 0.23,
    } as const,
    /** 初始资金池（万；玩家起始现金 1000 万为参照） */
    startCash: [600, 1600] as const,
    /** 出片间隔倍率（相对 base 5–10 周；快发型多产、品质型少而精；平均值≈1 避免整体档期变挤） */
    intervalMul: {
      quality: 1.35,
      volume: 0.7,
      specialist: 1.05,
      sniper: 1.1,
      balanced: 1.0,
    } as const,
    /** 制片投入/品质投入倍率（阶段 2 决策用） */
    investMul: {
      quality: 1.5,
      volume: 0.55,
      specialist: 1.0,
      sniper: 0.9,
      balanced: 1.0,
    } as const,
    /** 专精型锁定的类型数量范围 */
    specialistHomeTypes: [1, 2] as const,
    /** NPC 长线经营（阶段 3：资金池 / IP 沉淀 / 续作 / 破产） */
    economy: {
      /** 片方分账比例（NPC 票房收入） */
      share: 0.5,
      /** 制片成本基准（万，× 性格投入倍率 × 声誉系数） */
      costBase: 700,
      /** 每周运营成本 = 基准 + 声誉 × 系数（万） */
      weeklyOverheadBase: 4,
      weeklyOverheadPerRep: 0.08,
      /** 拮据线：cash < 此值 → 品质投入降档 */
      poorThreshold: 200,
      /** 降档倍率 */
      downshiftMul: 0.7,
      /** 破产暂停：cash < 0 → 注资救急 + 歇业期（周） */
      bailoutRange: [300, 500] as const,
      pauseWeeks: [8, 12] as const,
      /** IP 沉淀票房阈值（万） */
      ipThreshold: 1500,
      /** 续作概率（按性格：专精/品质最恋旧，快发最不恋旧） */
      sequelChance: {
        quality: 0.5,
        volume: 0.15,
        specialist: 0.55,
        sniper: 0.2,
        balanced: 0.3,
      } as const,
      /** 续作品质加成（每多一部 +4 ap/mp） */
      sequelQualityBonus: 4,
      /** 续作票房乘数 = 1 + 已出部数 × 系数 */
      sequelBoxOfficePerFilm: 0.08,
    } as const,
    /** NPC 行业新闻（阶段 4.5：把 NPC 经营行为写进报纸，玩家有的新闻 NPC 也有） */
    news: {
      /** 开画口碑：影评 ≥ 此值 → 头条级「影评人盛赞」 */
      praiseCritic: 8,
      /** 开画口碑：影评 < 此值 → 「影评人差评如潮」 */
      slamCritic: 4.5,
      /** 扑街判定：票房 < ipThreshold × 此比例 → 「遭冷遇」 */
      flopRatio: 0.5,
      /** 系列 IP 累计票房里程碑（万）：跨过即上报行业新闻 */
      milestoneThreshold: 5000,
      /** 团队人数低于此值时允许补员（被挖空后慢慢重建） */
      teamMin: 3,
      /** 团队不足时每周补员概率 */
      refillChance: 0.25,
    } as const,
    /** NPC 挖角（阶段 4：双向挖团队） */
    poach: {
      /** 每周触发概率 */
      chance: 0.12,
      /** NPC 开出签字费 = 员工周薪 × mul/10（2.5–4 倍周薪） */
      offerMul: [25, 40] as const,
      /** 玩家挖角成功率：基础 + offer 超出 4 倍周薪每万 + 系数 + 声誉差 × 系数 */
      baseSuccess: 0.35,
      successPerOfferOver: 0.001,
      successPerRepDiff: 0.003,
      maxSuccess: 0.9,
      minSuccess: 0.05,
      /** 目标筛选：名气或最高技能达到阈值才值得挖 */
      targetFameMin: 25,
      targetSkillMin: 60,
    } as const,
  },

  /** 档期竞争惩罚：同周/近周上映的对手片数 × 惩罚系数，上限 maxPenalty */
  competition: {
    penaltyPerFilm: 0.06,
    maxPenalty: 0.35,
    /** 档期重叠窗口（周）：本周与上一周上映的对手片都算竞争 */
    overlapWeeks: 1,
  },

  /** 影评人数量（固定 5 位） */
  criticCount: [5, 5] as const,
  /** 影评人名池 */
  criticNames: ['陆离', '闻人语', '白墨', '顾影', '程述', '苏晚', '秋山', '裴砚'],
  /** 影评人影响力范围 */
  criticInfluenceRange: [40, 90] as const,
  /** 年度换血概率：每年底随机 0–1 位退休并补入新锐（保持 5 位） */
  criticRetireChance: 0.6,
  /** 类型偏好加分 / 不匹配减分（10 分制） */
  tasteBonus: 1.0,
  tasteMismatchPenalty: 0.5,

  /** 观众群体（GDD §6 Audience Group） */
  audience: {
    /** 群体定义：名称 / 地区 / 主导类型（覆盖 6 类型） */
    groups: [
      { name: '都市青年', region: '华东', mainType: 'comedy' },
      { name: '家庭观众', region: '华北', mainType: 'drama' },
      { name: '动作影迷', region: '华南', mainType: 'action' },
      { name: '文艺影迷', region: '西南', mainType: 'love' },
      { name: '硬核影迷', region: '东北', mainType: 'war' },
      { name: '惊悚爱好者', region: '海外', mainType: 'horror' },
    ],
    /** focus：主导类型 / 次偏好 / 其他 */
    mainFocusRange: [0.75, 0.95] as const,
    subFocusRange: [0.5, 0.7] as const,
    otherFocusRange: [0.2, 0.4] as const,
    /** 次偏好类型数量 1–2 */
    subFocusCount: [1, 2] as const,
    /** 规模权重范围（归一化为占比） */
    sizeWeightRange: [5, 15] as const,
    /** 容忍度范围 0–1 */
    toleranceRange: [0.3, 0.8] as const,
    /** 每季度 focus 漂移幅度（±） */
    drift: 0.08,
    /** 票房观众契合：factor = fitMin + Σ(size×focus) × fitSpan */
    fitMin: 0.8,
    fitSpan: 0.5,
    /** 低口碑（影评 < 6.0，10 分制）容忍度惩罚系数 */
    tolerancePenaltyPer10: 0.5,
  } as const,

  /** 地区市场（GDD §6 Area：由观众群体按地区聚合） */
  region: {
    /** 主攻地区的集中发行加成：factor ×= 1 + 该地区规模占比 × targetBoost */
    targetBoost: 0.5,
  } as const,

  /** 行业/公司随机事件（GDD §6 Random Events）：每周触发概率 */
  eventChance: 0.12,
} as const
