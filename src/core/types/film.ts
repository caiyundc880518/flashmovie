import type { RoleId, SkillKey } from './worker'
import type { BudgetAlloc } from '../config/budget'

/** 剧组职位分配（V1 最小集：导演/演员/摄影/剪辑/市场 必配，制片/编剧可选，技术/助理暂缓） */
export interface TeamAssignments {
  producerId?: string
  directorId?: string
  writerId?: string
  actorIds: string[]
  shooterId?: string
  editorId?: string
  technicianId?: string
  marketId?: string
  assistantId?: string
}

/** 项目阶段状态机：preparing(筹备) → shooting(拍摄) → editing(剪辑) → marketing(宣发) → released(上映完成) */
export type ProjectStage = 'preparing' | 'shooting' | 'editing' | 'marketing' | 'released'

/** 小游戏单轮判定（perfect 完美 / good 不错 / miss 失误） */
export type TimingQuality = 'perfect' | 'good' | 'miss'

/** 发行渠道（GDD §3.6 四渠道：影院/网络/DVD/免费；流媒体已取消） */
export type Channel = 'cinema' | 'web' | 'dvd' | 'free'

/** 发行放映生命周期状态：待映攒预售 / 放映中 / 已下片可再发行 / 彻底完结 */
export type FilmRunStatus = 'presale' | 'running' | 'idle' | 'finished'

/** 单段放映的渠道配置快照（首轮来自定档时的宣发配置，再发行来自再发行面板） */
export interface RunChannelConfig {
  cinemaCount: number
  webPlatforms: string[]
  webWeeks: number
  dvdPrice: number
  freeAdPrice: number
}

/** 单周票房记录 */
export interface WeeklyBoxOffice {
  week: number
  year: number
  /** 当周票房（万） */
  boxOffice: number
  /** 当周片方分账（万） */
  revenue: number
  /** 影院：观影人次（万人次） */
  admissions?: number
  /** 网络/免费：播放量（万次） */
  traffic?: number
  /** DVD：销量（万张） */
  units?: number
  /** 当周结算用的动态 MP（0~100） */
  mp: number
  /** 当周结算用的动态观众口碑（0~10） */
  audience: number
}

/** 单段放映（首轮或每段再发行），每周动态结算 */
export interface FilmRun {
  id: string
  channel: Channel
  isFirst: boolean
  config: RunChannelConfig
  /** 本段预计总票房（万，中性反馈下整段 ≈ 此值；首轮=base×倍数，再发行×长尾系数） */
  expectedTotal: number
  startWeek: number
  startYear: number
  endWeek?: number
  endYear?: number
  status: 'running' | 'ended'
  /** 该段每周票房记录 */
  weekly: WeeklyBoxOffice[]
  /** 渠道投放成本（开映当周一次性扣，万） */
  channelCost: number
}

/** 发行/长尾状态（仅 released 项目） */
export interface FilmRunState {
  status: FilmRunStatus
  currentRunId: string | null
  runs: FilmRun[]
  /** 定档的正式变现周/年 */
  releaseWeek: number
  releaseYear: number
  /** 首轮预售累计（万，加成首周票房） */
  presale: number
  /** 首轮是否已下片（一次性结算只做一次） */
  firstRunEnded: boolean
  /** 影片基础票房潜力（无渠道 gross，定档时计算，供各段 expectedTotal） */
  basePotential: number
}

/** 电影项目 */
export interface FilmProject {
  id: string
  name: string
  scriptId: string
  stage: ProjectStage
  team: TeamAssignments
  /** 总场次数（由剧本 scale 决定） */
  totalStages: number
  /** 已拍摄场次数 */
  shotStages: number
  /** 预算占比分配（剧情/VFX/表演/剪辑，总和 ≤ 100） */
  budgetAlloc: BudgetAlloc
  /** 特效档位下标（VFX_CONFIG.tiers，受技术员技能限制） */
  vfxLevel: number
  /** 已签约植入广告商 id 列表（结算时逐家校验要求） */
  adSponsorIds: string[]
  /** 上映前热度 0–100 */
  hype: number
  /** 筹备阶段预热成本投入（万）：投得越多对 MP 加成越多，无上限 */
  warmup: number
  /** 预算总额（万） */
  budget: number
  /** 已花费（万） */
  spent: number
  /** 剪辑取向：market 市场向 / art 艺术向 */
  editStyle: 'market' | 'art' | null
  /** 剪辑/拍摄小游戏累计 Buff（±） */
  buffs: number
  /** 拍摄小游戏累计 AP/MP 加成（每次结算后累加，完美越多越高） */
  shotGameBonus: number
  /** 拍摄中是否有待玩的小游戏（被动触发，必须完成才能继续推进） */
  pendingShotGame: boolean
  /** 剪辑小游戏是否已完成（必须完成才能推进） */
  editGameDone: boolean
  /** 剪辑小游戏 AP/MP 加成 */
  editGameBonus: number
  /** 随机事件累计 AP 修正（±） */
  apAdjust: number
  /** 拍摄中随机事件队列（tick 生成，UI 逐个处理） */
  pendingEvents: ProjectEvent[]
  /** 发行渠道（单选；未选择 = 尚未配置宣发） */
  channel: Channel | null
  /** 影院：投放影院数（游戏内总 5178 家） */
  cinemaCount: number
  /** 网络：投放平台列表 */
  webPlatforms: string[]
  /** 网络：投放时长（周） */
  webWeeks: number
  /** DVD：单价（元/张） */
  dvdPrice: number
  /** 免费：广告单价（元/千次播放） */
  freeAdPrice: number
  /** 所属 IP 资产 id（续作立项时写入，GDD §3.8） */
  ipId?: string
  /** 本片在系列中的部数（首作 1，续作 2+） */
  ipEntry?: number
  /** 主攻地区（宣发阶段选择，空 = 全国通发；GDD §6 Area） */
  targetRegion?: string
  /** 结算结果（released 后写入；语义为"累计快照"，boxOffice/revenue/渠道指标为全渠道累计值） */
  result?: FilmResult
  /** 进入 released 的周（用于结果记录） */
  releasedWeek?: number
  /** 发行/长尾状态（仅 released 项目；旧档迁移为 finished） */
  run?: FilmRunState
  /** 动态 MP（首轮每周更新，0~100） */
  currentMp?: number
  /** 动态观众口碑（首轮每周更新，0~10） */
  currentAudience?: number
  /** 首轮下片时锁定的最终 MP（成员成长/再发行用） */
  finalMp?: number
  /** 首轮下片时锁定的最终观众口碑 */
  finalAudience?: number
}

/** 项目内随机事件（2–3 选 1） */
export interface ProjectEvent {
  id: string
  kind: 'actor' | 'director' | 'vfx' | 'chemistry' | 'news' | 'trend'
  title: string
  desc: string
  options: ProjectEventOption[]
}

export interface ProjectEventOption {
  label: string
  /** 金钱变化（千元，可负） */
  cash?: number
  /** 士气/效率变化 0–100 */
  morale?: number
  /** 成片分项 Buff（±） */
  buff?: number
  /** 热度变化 */
  hype?: number
  /** 口碑/AP 变化 */
  ap?: number
}

/** 成片六项基础分 */
export interface FilmScores {
  story: number
  music: number
  edit: number
  acting: number
  shooting: number
  directing: number
}

/** 成员工作成绩单 */
export interface GroupPerformance {
  workerId: string
  role: RoleId
  /** 本片个人成绩 0–100 */
  performance: number
}

/** 上映结算：单名成员在本片的属性变化明细（GDD §7.4） */
export interface WorkerSettlement {
  workerId: string
  /** 参与角色（所填槽位） */
  role: RoleId
  /** 表现评分 0–100 */
  performance: number
  /** CA 涨跌（整数，可负） */
  caGain: number
  /** 经验获取 */
  expGain: number
  /** 技能变化（仅记录发生变化的项，delta 可负） */
  skillChanges: { key: SkillKey; delta: number }[]
  /** Fame 涨跌 */
  fameGain: number
  /** 心情涨跌 */
  moodGain: number
}

/** 单条影评（score 为 10 分制，一位小数；text 为对应文字评语） */
export interface CriticReview {
  criticId: string
  criticName: string
  score: number
  /** 评分对应的文字评语（旧档可能缺省） */
  text?: string
}

/** 单条广告赞助结算明细 */
export interface AdSettlement {
  id: string
  name: string
  fee: number
  /** 是否满足要求（影评均分 + 演员 Fame）到账 */
  met: boolean
}

/** 单条获奖记录（TMA，跨届累计；个人奖带获奖者，最佳影片无个人得主） */
export interface FilmAward {
  /** 奖项类别（最佳影片/最佳导演/最佳演员/最佳摄影/最佳剪辑/最佳特效） */
  category: string
  /** 获奖者姓名（个人奖）；最佳影片缺省 */
  workerName?: string
  /** 获奖年份（TMA 评选年度） */
  year: number
}

/** 电影结算结果 */
export interface FilmResult {
  /** 片名（展示用） */
  name: string
  scores: FilmScores
  vfx: number
  specific: number
  ap: number
  mp: number
  /** 影评人平均分（10 分制一位小数；旧档可能为 0–100） */
  criticScore: number
  /** 逐影评人评分（10 分制 + 文字评语） */
  reviews: CriticReview[]
  /** 观众评分（10 分制一位小数，旧档可能缺省） */
  audienceScore?: number
  /** 观众总评（旧档可能缺省） */
  audienceText?: string
  boxOffice: number
  reputationGain: number
  groupPerformance: GroupPerformance[]
  /** 上映周 */
  week: number
  year: number
  /** 片方总收入（万）：渠道分账（旧档可能缺省） */
  revenue?: number
  /** 发行渠道（旧档为数组；新档用 channel 单选） */
  channels?: Channel[]
  /** 发行渠道（单选，新档记录） */
  channel?: Channel
  /** 影院：投放影院数（万） */
  admissions?: number
  /** DVD：卖出张数（万张） */
  dvdUnits?: number
  /** 免费：播放量（万次） */
  freeViews?: number
  /** 发行商名（旧档可能缺省；发行商机制已取消） */
  publisherName?: string
  /** 所属 IP 系列名（续作或新沉淀 IP，旧档可能缺省） */
  ipName?: string
  /** 本片在系列中的部数（旧档可能缺省） */
  ipEntry?: number
  /** 主攻地区（旧档可能缺省） */
  targetRegion?: string
  /** 广告赞助结算明细（旧档可能缺省） */
  adSettlement?: AdSettlement[]
  /** 广告赞助实际到账合计（万，旧档可能缺省） */
  adIncome?: number
  /** 累计获奖数（TMA 各届累加，旧档可能缺省） */
  awardCount?: number
  /** 获奖名单（TMA 各届累计，旧档可能缺省） */
  awards?: FilmAward[]
  /** 成员成长结算明细（旧档可能缺省） */
  settlement?: WorkerSettlement[]
}
