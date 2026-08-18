import type { Channel } from '../types'

/**
 * 发行渠道（GDD §3.6 四渠道）
 * 宣发阶段单选一种渠道；流媒体已取消、发行商已取消。
 * 各渠道收入在 release 时按渠道参数结算：
 * - 影院：投放影院数 × 单价 → 覆盖票房（游戏内影院共 TOTAL_CINEMAS 家）
 * - 网络：选平台 + 投放时长 → 平台加成 × 时长加成
 * - DVD：设定单价 → 按卖出张数 × 单价
 * - 免费：设定广告单价 → 播放量 × 广告单价
 */
export const CHANNEL_INFO: Record<Channel, { label: string; desc: string }> = {
  cinema: {
    label: '影院',
    desc: '填写投放影院数：影院数越多覆盖越广、观影人次越高，票房增幅越大（全国 5178 家铺满可放大数倍），是权重最高的渠道。',
  },
  web: {
    label: '网络',
    desc: '选择投放的网络平台（可多选）并填写投放时长：播放时长越长票房越高，平台数与时长都会推高收入。',
  },
  dvd: {
    label: 'DVD',
    desc: '设定 DVD 单价，上映结算按卖出张数 × 单价计为票房：单价越低卖得越多，单价越高单张利润越大。',
  },
  free: {
    label: '免费',
    desc: '设定广告单价，影片免费观看：播放量 × 广告单价即广告收入（即票房），是权重最低的渠道。',
  },
}

export const CHANNEL_ORDER: Channel[] = ['cinema', 'web', 'dvd', 'free']

/** 游戏内影院总家数 */
export const TOTAL_CINEMAS = 5178

/** 常见网络电影平台 */
export const WEB_PLATFORMS = ['腾讯视频', '爱奇艺', '优酷', '芒果TV', '哔哩哔哩', '搜狐视频'] as const

export const CHANNEL_CONFIG = {
  /** 影院：每家投放单价（万） */
  cinemaCostPerUnit: 0.2,
  /** 影院：未配置渠道时的兜底影院数（旧档迁移用） */
  cinemaDefaultCount: 50,
  /** 影院：极小规模上映的票房系数（基础，保证小规模上映仍有基本票房） */
  cinemaBaseMul: 0.9,
  /** 影院：全国铺满时的票房系数上限（影院数 → 覆盖率线性抬升，满覆盖 ×4，权重最高） */
  cinemaMaxMul: 4.0,
  /** 影院：平均票价（元），用于换算观影人次 */
  cinemaAvgTicket: 40,

  /** 网络：单平台投放成本（万/周） */
  webCostPerPlatform: 40,
  /** 网络：单周投放成本（万） */
  webCostPerWeek: 15,
  /** 网络：每多一个平台收入加成（×，基础 1） */
  webBonusPerPlatform: 0.06,
  /** 网络：每多投一周票房加成（×，播放时长是主要驱动） */
  webBonusPerWeek: 0.1,
  /** 网络：时长加成的生效上限（周，避免无脑拉满） */
  webWeeksCap: 11,
  /** 网络：基础票房 = 基础票房 × 此系数 */
  webBaseMul: 0.7,
  /** 网络：平台分账后片方所得比例 */
  webShare: 0.6,
  /** 网络：默认投放时长（周） */
  webDefaultWeeks: 4,

  /** DVD：定价范围（元/张） */
  dvdPriceRange: [10, 99] as const,
  /** DVD：基准票房系数（参考单价时的片方所得，权重低于网络） */
  dvdBaseMul: 0.45,
  /** DVD：参考单价（元/张） */
  dvdRefPrice: 20,
  /** DVD：单价弹性 0–1：单价越高总票房越高（高价走质）；单价越低卖出张数越多 */
  dvdPricePower: 0.3,
  /** DVD：制作成本（万，一次性） */
  dvdSetupCost: 30,
  /** DVD：渠道费后片方所得比例 */
  dvdShare: 0.85,

  /** 免费：广告单价范围（元/千次播放） */
  freeAdPriceRange: [10, 80] as const,
  /** 免费：播放量（万次）= 基础票房 × 播放系数 × (1 + 热度加成)；广告收入 = 播放量 × 单价 */
  freeViewFactor: 0.01,
  /** 免费：热度对播放量的加成（每点热度 +此比例） */
  freeViewHypePer: 0.01,
  /** 免费：广告收入直接归片方 */
  freeShare: 1,
} as const

/**
 * 发行商配置（历史数据：世界仍生成发行商列表以兼容旧档，宣发机制已取消）
 */
export const PUBLISHER_CONFIG = {
  /** 数量范围 */
  count: [2, 4] as const,
  /** 发行商名池 */
  names: ['环球发行', '时代影业发行部', '星光院线发行', '大都会传媒', '远东发行', '天穹影发'],
  /** 后端分成比例范围 0–1 */
  shareRateRange: [0.15, 0.35] as const,
  /** 预付款基数范围（万） */
  prepayBaseRange: [120, 250] as const,
  /** 预付款 = prepayBase + 声誉 × prepayPerRep */
  prepayPerRep: 2,
} as const
