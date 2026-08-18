import type { FilmType, Gender } from './worker'
import type { WriterPoolId } from '../config/writers'

/** 编剧抽卡委托：创作中的剧本，到期进公司剧本库 */
export interface ScriptDraft {
  id: string
  /** 委托档位（决定产出质量与等待周数） */
  tier: WriterPoolId
  /** 剩余周数 */
  weeksLeft: number
}

/** 剧本对演员的要求 */
export interface ScriptRequirement {
  genders: Gender[]
  /** 最小年龄 */
  minAge: number
  /** 最大年龄，null 表示不限 */
  maxAge: number | null
  /** 最低演出经验（按 career 条数计），0 表示无要求 */
  minExperience: number
}

/** 剧本 */
export interface Script {
  id: string
  title: string
  type: FilmType
  /** 故事强度：制作难度 */
  storyPoint: number
  /** 艺术潜力（TMA 机会） */
  artPot: number
  /** 市场潜力（最终销售） */
  marketPot: number
  /** 知名度：越高越多人主动联系 */
  famePoint: number
  /** 潮流契合度 0–1 */
  trend: number
  /** 规模：需要的场次数（Stage 数） */
  scale: number
  /** 剧情简介（简单介绍，展示用；旧档可能缺省） */
  desc?: string
  requirement: ScriptRequirement
  /** 购买价格（千元），自有/自产为 0 */
  price: number
  /** 所有权：company=自有，market=市场上在售，writer=编剧持有待售 */
  owner: 'company' | 'market' | 'writer'
  /** 编剧产出时记录产出者（可选） */
  writerId?: string
}

/** 剧本来源 */
export type ScriptSource = 'market' | 'writer' | 'school'
