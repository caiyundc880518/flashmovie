import type { FilmType } from '../types'

/**
 * 剧本池与生成参数（V1 预置标题 + 属性范围）
 */
export const SCRIPT_POOL = {
  /** 各类型剧本标题池 */
  titles: {
    comedy: ['爆笑相亲记', '乌龙侦探社', '老板别闹', '误入婚礼', '全家总动员'],
    horror: ['午夜回廊', '废弃医院', '镜中人', '第七层', '纸人'],
    action: ['追风行动', '铁血街头', '代号猎鹰', '极限营救', '暗战'],
    love: ['盛夏告白', '雨巷情书', '重逢咖啡馆', '心动信号', '时光慢递'],
    war: ['长津湖畔', '无声战线', '城破之夜', '烽火家书', '钢铁洪流'],
    drama: ['故乡的河', '无名之辈', '雪落无声', '深夜食堂', '候鸟'],
  } satisfies Record<FilmType, string[]>,

  /** 属性生成范围 */
  attrRanges: {
    /** 故事强度：制作难度 */
    storyPoint: [30, 90],
    /** 艺术潜力 */
    artPot: [20, 95],
    /** 市场潜力 */
    marketPot: [20, 95],
    /** 知名度点 */
    famePoint: [0, 80],
    /** 潮流契合度 0–1 */
    trend: [0, 1],
    /** 规模：场次数 */
    scale: [4, 12],
    /** 价格区间（万） */
    price: [20, 150],
  },

  /** 签约编剧：产出剧本所需周数范围 */
  writerProduceWeeks: [3, 6],
  /** 剧本市场刷新间隔（周）范围 */
  marketRefreshWeeks: [2, 4],
  /** 每次刷新在售数量范围 */
  marketScriptCount: [3, 5],
} as const
