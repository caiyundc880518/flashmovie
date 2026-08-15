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

  /** 影评人数量范围 */
  criticCount: [3, 5] as const,
  /** 影评人名池 */
  criticNames: ['陆离', '闻人语', '白墨', '顾影', '程述', '苏晚', '秋山', '裴砚'],
  /** 影评人影响力范围 */
  criticInfluenceRange: [40, 90] as const,
  /** 类型偏好加分 / 不匹配减分 */
  tasteBonus: 10,
  tasteMismatchPenalty: 5,
} as const
