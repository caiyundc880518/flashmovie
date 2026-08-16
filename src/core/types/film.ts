import type { RoleId, SkillKey } from './worker'

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

/** 项目阶段状态机：preparing → shooting → editing → marketing → released */
export type ProjectStage = 'preparing' | 'shooting' | 'editing' | 'marketing' | 'released'

/** 发行渠道（GDD §3.6 五渠道） */
export type Channel = 'cinema' | 'web' | 'dvd' | 'streaming' | 'free'

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
  /** VFX 预算占全片比例 0–100 */
  vfxPercent: number
  /** 是否接受植入广告 */
  hasAd: boolean
  /** 上映前热度 0–100 */
  hype: number
  /** 宣发预算（千元） */
  marketingBudget: number
  /** 预算总额（千元） */
  budget: number
  /** 已花费（千元） */
  spent: number
  /** 剪辑取向：market 市场向 / art 艺术向 */
  editStyle: 'market' | 'art' | null
  /** 剪辑/拍摄小游戏累计 Buff（±） */
  buffs: number
  /** 随机事件累计 AP 修正（±） */
  apAdjust: number
  /** 拍摄中随机事件队列（tick 生成，UI 逐个处理） */
  pendingEvents: ProjectEvent[]
  /** 发行渠道（空 = 上映时默认影院） */
  channels: Channel[]
  /** 已签约发行商 id */
  publisherId?: string
  /** 所属 IP 资产 id（续作立项时写入，GDD §3.8） */
  ipId?: string
  /** 本片在系列中的部数（首作 1，续作 2+） */
  ipEntry?: number
  /** 主攻地区（宣发阶段选择，空 = 全国通发；GDD §6 Area） */
  targetRegion?: string
  /** 结算结果（released 后写入） */
  result?: FilmResult
  /** 进入 released 的周（用于结果记录） */
  releasedWeek?: number
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

/** 单条影评 */
export interface CriticReview {
  criticId: string
  criticName: string
  score: number
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
  /** 影评人平均分 0–100 */
  criticScore: number
  /** 逐影评人评分 */
  reviews: CriticReview[]
  boxOffice: number
  reputationGain: number
  groupPerformance: GroupPerformance[]
  /** 上映周 */
  week: number
  year: number
  /** 片方总收入（万）：渠道分账 + 发行商预付款（旧档可能缺省） */
  revenue?: number
  /** 发行渠道（旧档可能缺省） */
  channels?: Channel[]
  /** 发行商名（旧档可能缺省） */
  publisherName?: string
  /** 所属 IP 系列名（续作或新沉淀 IP，旧档可能缺省） */
  ipName?: string
  /** 本片在系列中的部数（旧档可能缺省） */
  ipEntry?: number
  /** 主攻地区（旧档可能缺省） */
  targetRegion?: string
  /** 成员成长结算明细（旧档可能缺省） */
  settlement?: WorkerSettlement[]
}
