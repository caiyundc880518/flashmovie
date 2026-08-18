/**
 * 植入广告商配置（GDD §3.3 植入广告扩展）
 * 立项时可选多家广告商（上限 maxSponsors）；上映结算时逐家校验赞助要求：
 * 影评人平均分 ≥ minCriticScore 且 团队演员最高 Fame ≥ requiredFame，达标才到账赞助费。
 * 知名度（popularity）高的广告商自带周边收入加成（merchBonus），
 * 结算后累计到所属 IP 的周边收入加成（cap merchBonusCap）。
 */
export interface AdSponsor {
  id: string
  /** 品牌名 */
  name: string
  /** 行业 */
  industry: string
  /** 知名度 0–100 */
  popularity: number
  /** 赞助费（万，达标到账） */
  sponsorFee: number
  /** 最低影评人平均分要求（10 分制，0 = 无要求） */
  minCriticScore: number
  /** 必须出演演员的最低 Fame 要求（0 = 无要求） */
  requiredFame: number
  /** 周边收入加成 %（知名度高的才有，累计到所属 IP） */
  merchBonus: number
}

export const AD_CONFIG = {
  /** 一部影片最多可选的广告商数量 */
  maxSponsors: 3,
  /** 每家广告商的 AP 惩罚（植入伤口碑） */
  apPenaltyPerAd: 5,
  /** IP 周边收入加成上限 % */
  merchBonusCap: 100,
} as const

export const AD_SPONSORS: AdSponsor[] = [
  {
    id: 'ad_tea',
    name: '茶语奶茶',
    industry: '饮品',
    popularity: 25,
    sponsorFee: 40,
    minCriticScore: 5.0,
    requiredFame: 0,
    merchBonus: 0,
  },
  {
    id: 'ad_soda',
    name: '冰爽汽水',
    industry: '饮料',
    popularity: 35,
    sponsorFee: 60,
    minCriticScore: 5.5,
    requiredFame: 0,
    merchBonus: 2,
  },
  {
    id: 'ad_phone',
    name: '星辰手机',
    industry: '数码',
    popularity: 50,
    sponsorFee: 90,
    minCriticScore: 6.0,
    requiredFame: 40,
    merchBonus: 5,
  },
  {
    id: 'ad_car',
    name: '飞驰汽车',
    industry: '汽车',
    popularity: 65,
    sponsorFee: 130,
    minCriticScore: 6.5,
    requiredFame: 50,
    merchBonus: 10,
  },
  {
    id: 'ad_watch',
    name: '瑞格腕表',
    industry: '钟表',
    popularity: 75,
    sponsorFee: 170,
    minCriticScore: 7.0,
    requiredFame: 60,
    merchBonus: 15,
  },
  {
    id: 'ad_bank',
    name: '恒信银行',
    industry: '金融',
    popularity: 85,
    sponsorFee: 220,
    minCriticScore: 7.5,
    requiredFame: 70,
    merchBonus: 22,
  },
  {
    id: 'ad_luxury',
    name: '皇家珠宝',
    industry: '奢侈品',
    popularity: 95,
    sponsorFee: 300,
    minCriticScore: 8.0,
    requiredFame: 80,
    merchBonus: 30,
  },
]

export const AD_SPONSOR_MAP: Record<string, AdSponsor> = Object.fromEntries(
  AD_SPONSORS.map((a) => [a.id, a]),
)
