import type { FilmType } from './worker'

/**
 * IP 资产（GDD §3.8 售后与 IP）
 * 高票房 + 高口碑的影片沉淀为 IP；续作获得票房加成与投资溢价，
 * 每季度按等级结算衍生授权收入（周边/画廊/授权）。
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
  /** 每季度（13 周）衍生授权收入（万） */
  royaltyPerQuarter: number
  /** 续作票房加成（×，1 + level × 每级加成） */
  sequelBonus: number
  /** 周边收入加成 %（由高知名度广告商累计，提升季度授权收入） */
  merchBonus: number
  /** 衍生授权累计收入（万） */
  royaltyEarned: number
  /** 构成系列的项目 id（首作 + 续作） */
  films: string[]
}
