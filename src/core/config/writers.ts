/**
 * 签约编剧三档卡池（抽卡式委托创作，GDD §3.1）
 * 一般：产出快、质量普通、拍摄简单，小几率爆 MP 超级爆款
 * 专业：产出中等、质量中等、拍摄一般，小几率爆 AP 超高（奖向）
 * 金牌：产出慢、质量上等、拍摄有难度，保奖向，小几率爆 MP 超级爆款
 * 单位：价格/周 万元
 */
export type WriterPoolId = 'common' | 'pro' | 'gold'

export interface WriterPoolConfig {
  id: WriterPoolId
  /** 档位名 */
  label: string
  /** 一句话说明（卡片/弹窗展示） */
  desc: string
  /** 单本委托价格（万） */
  price: number
  /** 委托创作等待周数范围 */
  produceWeeks: [number, number]
  /** 故事强度范围（制作难度） */
  storyRange: [number, number]
  /** 艺术潜力范围（TMA 机会） */
  artRange: [number, number]
  /** 市场潜力范围（票房） */
  marketRange: [number, number]
  /** 规模（拍摄场次）范围：越大拍摄越久越贵 */
  scaleRange: [number, number]
  /** 小几率爆款概率 */
  boomChance: number
  /** 爆款方向：mp = 市场潜力爆表（票房爆款）；ap = 艺术潜力爆表（拿奖向） */
  boomType: 'mp' | 'ap'
}

export const WRITER_POOLS: WriterPoolConfig[] = [
  {
    id: 'common',
    label: '一般编剧',
    desc: '产出快（2–3 周）、质量普通、拍摄简单；小几率爆出 MP 超级高的爆款。',
    price: 8,
    produceWeeks: [2, 3],
    storyRange: [35, 65],
    artRange: [20, 55],
    marketRange: [20, 55],
    scaleRange: [3, 6],
    boomChance: 0.07,
    boomType: 'mp',
  },
  {
    id: 'pro',
    label: '专业编剧',
    desc: '产出中等（3–5 周）、质量中等、拍摄一般；保本向，极小几率爆出 AP 超高的奖片。',
    price: 25,
    produceWeeks: [3, 5],
    storyRange: [50, 80],
    artRange: [45, 75],
    marketRange: [40, 70],
    scaleRange: [5, 9],
    boomChance: 0.04,
    boomType: 'ap',
  },
  {
    id: 'gold',
    label: '金牌编剧',
    desc: '产出慢（5–8 周）、质量必属上等、拍摄有难度；保拿奖的编剧，小几率爆出 MP 超级高的商业片。',
    price: 70,
    produceWeeks: [5, 8],
    storyRange: [70, 95],
    artRange: [65, 95],
    marketRange: [55, 85],
    scaleRange: [8, 12],
    boomChance: 0.06,
    boomType: 'mp',
  },
]

export const WRITER_POOL_MAP: Record<WriterPoolId, WriterPoolConfig> = {
  common: WRITER_POOLS[0],
  pro: WRITER_POOLS[1],
  gold: WRITER_POOLS[2],
}

/** 10 连抽折扣（× 0.9，省 1 抽的钱） */
export const TEN_PULL_DISCOUNT = 0.9

/** 爆款保底属性（抽中爆款时该属性落在该区间） */
export const BOOM_RANGE = [92, 100] as const
