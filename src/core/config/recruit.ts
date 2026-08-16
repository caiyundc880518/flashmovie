/**
 * 招聘市场卡池（抽卡式，GDD §4.4）
 * 三档：流水市场（廉价、CA 低、低几率高 PA）
 *      职业市场（适中、CA 对半、几乎不出高 PA）
 *      专业学院（昂贵、高 CA 几率高、高 PA 几率中等）
 * 计价：单个演员价格（万），支持 1 抽 / 10 连（9 折）。
 */
export type RecruitPoolId = 'flow' | 'pro' | 'academy'

export interface RecruitPoolConfig {
  id: RecruitPoolId
  /** 档位名 */
  label: string
  /** 一句话说明（弹窗/按钮展示） */
  desc: string
  /** 单个演员价格（万） */
  cost: number
  /** 高 CA（抽取时命中此档 → CA 落在 caHigh 区间）概率 */
  highCaChance: number
  /** 高 PA（PA 落在 paHigh 区间）概率 */
  highPaChance: number
  /** 低 CA 区间（生手） */
  caLow: [number, number]
  /** 高 CA 区间（熟手） */
  caHigh: [number, number]
  /** 普通 PA 区间 */
  paLow: [number, number]
  /** 高 PA 区间（璞玉/顶尖潜质） */
  paHigh: [number, number]
}

export const RECRUIT_POOLS: RecruitPoolConfig[] = [
  {
    id: 'flow',
    label: '流水市场',
    desc: '成本最低；大多生涩，偶有璞玉（高 PA）。',
    cost: 6,
    highCaChance: 0.15,
    highPaChance: 0.12,
    caLow: [15, 45],
    caHigh: [55, 80],
    paLow: [40, 80],
    paHigh: [80, 95],
  },
  {
    id: 'pro',
    label: '职业市场',
    desc: '成本适中，熟手生手对半开；几乎淘不到顶尖潜质。',
    cost: 30,
    highCaChance: 0.5,
    highPaChance: 0.03,
    caLow: [25, 50],
    caHigh: [60, 88],
    paLow: [45, 75],
    paHigh: [85, 95],
  },
  {
    id: 'academy',
    label: '专业学院',
    desc: '费用高昂；毕业生底子扎实，顶尖潜质不罕见。',
    cost: 150,
    highCaChance: 0.75,
    highPaChance: 0.35,
    caLow: [35, 55],
    caHigh: [65, 92],
    paLow: [55, 80],
    paHigh: [85, 96],
  },
]

export const RECRUIT_POOL_MAP: Record<RecruitPoolId, RecruitPoolConfig> = {
  flow: RECRUIT_POOLS[0],
  pro: RECRUIT_POOLS[1],
  academy: RECRUIT_POOLS[2],
}
