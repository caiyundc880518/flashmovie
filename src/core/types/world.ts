import type { FilmType, Worker } from './worker'
import type { Script } from './script'
import type { Company } from './company'
import type { FilmProject } from './film'
import type { Calendar } from './calendar'

/** 新闻 */
export interface NewsItem {
  id: string
  week: number
  text: string
  /** 影响：hype 全体加成 / 类型加成 */
  kind: 'hype' | 'type'
  value: number
  type?: FilmType
}

/** 当前潮流趋势 */
export interface Trend {
  type: FilmType
  /** 该趋势持续到第几周 */
  untilWeek: number
}

/** 世界状态（V1 精简：剧本市场 / 招聘市场 / 新闻 / 趋势） */
export interface World {
  /** 剧本市场在售剧本 */
  marketScripts: Script[]
  /** 每周刷新剧本市场的倒计时（周） */
  marketRefreshIn: number
  /** 可招募候选人 */
  candidates: Worker[]
  trend: Trend | null
  news: NewsItem[]
}

export interface GameState {
  version: number
  /** 随机种子（用于可复现随机） */
  seed: number
  /** 单调递增 id 计数器（保证全状态 id 唯一） */
  idCounter: number
  /** 游戏内日历 */
  calendar: Calendar
  company: Company
  world: World
  /** 员工表 id → Worker（含在职与外聘候选人） */
  workers: Record<string, Worker>
  /** 剧本表 id → Script（含市场在售与公司自有） */
  scripts: Record<string, Script>
  /** 项目列表 */
  projects: FilmProject[]
  /** 编剧排队中的剧本产出（writerId → 剩余周数） */
  writerQueues: Record<string, number>
}
