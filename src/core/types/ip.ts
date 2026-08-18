import type { FilmType } from './worker'

/** 版权交易合同（电视剧/游戏改编权，固定总额每周分期） */
export interface CopyrightDeal {
  id: string
  kind: 'tv' | 'game'
  /** 合同总额（万，签约时按 IP 价值锁定） */
  total: number
  /** 已付（万） */
  paid: number
  /** 合同期（周：电视剧 12 / 游戏 20） */
  weeks: number
  weeksPaid: number
  status: 'active' | 'done'
  startWeek: number
  startYear: number
}

/**
 * IP 资产（GDD §3.8 售后与 IP）
 * 高票房 + 高口碑的影片沉淀为 IP；续作获得票房加成与投资溢价，
 * 每周按热门度结算周边收入；可签电视剧/游戏版权交易合同（每周分期）。
 */
export interface IpAsset {
  id: string
  /** 系列名（首作片名） */
  name: string
  /** 系列类型（续作须同类型） */
  type: FilmType
  /** 系列当前第几部（首作 = 1） */
  entry: number
  /** 首作上映周/年 */
  originWeek: number
  originYear: number
  /** 系列累计票房（万） */
  totalBoxOffice: number
  /** 系列最高单部票房（万） */
  bestBoxOffice: number
  /** 系列最佳影评均分 0–100 */
  bestCriticScore: number
  /** IP 等级 1–5（按累计票房档位） */
  level: number
  /** 每季度（13 周）衍生授权收入（万）——已废弃，不再结算（迁移后由热门度周边替代） */
  royaltyPerQuarter: number
  /** 续作票房加成（×，1 + level × 每级加成） */
  sequelBonus: number
  /** 周边收入加成 %（由高知名度广告商累计，放大热门度周边收入） */
  merchBonus: number
  /** 周边/衍生累计收入（万） */
  royaltyEarned: number
  /** 构成系列的项目 id（首作 + 续作） */
  films: string[]
  /** IP 热门度 0~100（新片抬升 + 每周衰减；驱动周边收入；旧档迁移补 level×20） */
  hotness?: number
  /** 版权交易合同（旧档缺省） */
  deals?: CopyrightDeal[]
}
