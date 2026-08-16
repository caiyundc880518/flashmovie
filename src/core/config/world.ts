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
