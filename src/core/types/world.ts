import type { FilmType, Worker } from './worker'
import type { Script } from './script'
import type { Company } from './company'
import type { FilmProject } from './film'
import type { Calendar } from './calendar'
import type { YearAwards } from './awards'

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

/** 竞争对手的一部影片 */
export interface CompetitorFilm {
  week: number
  year: number
  name: string
  ap: number
  mp: number
  boxOffice: number
}

/** AI 竞争对手影业 */
export interface Competitor {
  id: string
  name: string
  /** 声誉 0–100 */
  reputation: number
  /** 距下次上映周数 */
  nextReleaseIn: number
  history: CompetitorFilm[]
}

/** 影评人 */
export interface Critic {
  id: string
  name: string
  /** 类型偏好：匹配时加分；none 表示无偏好 */
  taste: FilmType | 'none'
  /** 影响力 0–100（影响口碑传播） */
  influence: number
}

/** 发行商（Publish Contract：预付款 + 后端分成） */
export interface Publisher {
  id: string
  name: string
  /** 声誉 0–100 */
  reputation: number
  /** 后端分成比例 0–1 */
  shareRate: number
  /** 预付款 = prepayBase + reputation × prepayPerRep（万） */
  prepayBase: number
  prepayPerRep: number
}

/** 投资人（融资来源：出资 + 分成） */
export interface Investor {
  id: string
  name: string
  /** 出资 = investmentBase + 声誉 × investmentPerRep（万） */
  investmentBase: number
  investmentPerRep: number
  /** 片方收入分成比例 0–1 */
  share: number
}

/** 世界状态（剧本市场 / 招聘市场 / 新闻 / 趋势 / 对手 / 影评人 / 发行商 / 投资人） */
export interface World {
  /** 剧本市场在售剧本 */
  marketScripts: Script[]
  /** 每周刷新剧本市场的倒计时（周） */
  marketRefreshIn: number
  /** 可招募候选人 */
  candidates: Worker[]
  trend: Trend | null
  news: NewsItem[]
  /** AI 竞争对手 */
  competitors: Competitor[]
  /** 影评人 */
  critics: Critic[]
  /** 发行商 */
  publishers: Publisher[]
  /** 投资人（可签约其一） */
  investors: Investor[]
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
  /** 最近一届 TMA 颁奖结果（跨年时生成） */
  lastCeremony?: YearAwards
}
