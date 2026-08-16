/** 电影类型（V1 六类） */
export type FilmType = 'comedy' | 'horror' | 'action' | 'love' | 'war' | 'drama'

export const FILM_TYPES: readonly FilmType[] = ['comedy', 'horror', 'action', 'love', 'war', 'drama']

/** 9 种职位 */
export type RoleId =
  | 'producer'
  | 'director'
  | 'writer'
  | 'actor'
  | 'shooter'
  | 'editor'
  | 'technician'
  | 'market'
  | 'assistant'

export const ROLE_IDS: readonly RoleId[] = [
  'producer',
  'director',
  'writer',
  'actor',
  'shooter',
  'editor',
  'technician',
  'market',
  'assistant',
]

/** 8 项职业技能 */
export type SkillKey = 'act' | 'direct' | 'shoot' | 'edit' | 'market' | 'technical' | 'advertise' | 'vfx'

export const SKILL_KEYS: readonly SkillKey[] = [
  'act',
  'direct',
  'shoot',
  'edit',
  'market',
  'technical',
  'advertise',
  'vfx',
]

export type SkillMap = Record<SkillKey, number>

export type Gender = 'male' | 'female'

/** 精神属性 */
export interface MentalAttrs {
  intelligence: number
  focus: number
  gift: number
  dedication: number
  leader: number
  adaptability: number
  versatility: number
}

/** 身体属性 */
export interface PhysicalAttrs {
  strong: number
  agility: number
  initiative: number
  disease: number
  charisma: number
  sexy: number
}

/** 活跃属性 */
export interface ActiveAttrs {
  mood: number
  volume: number
}

/** 基础属性 */
export interface BasicAttrs {
  /** 潜力上限（0–100） */
  pa: number
  /** 当前综合能力（0–100） */
  ca: number
  /** 知名度（0–100） */
  fame: number
  /** 热度（0–100） */
  hype: number
  /** 主类型：与剧本/角色类型匹配 */
  mainType: FilmType | 'none'
  height: number
  weight: number
}

export interface CareerEntry {
  week: number
  projectName: string
  role: RoleId
  /** 本片个人成绩 0–100 */
  performance: number
  /** 本片 CA 涨跌（整数，可负；旧档可能缺省） */
  caGain?: number
}

export interface AwardEntry {
  week: number
  award: string
  projectName: string
}

/** 员工 */
export interface Worker {
  id: string
  name: string
  role: RoleId
  gender: Gender
  age: number
  basic: BasicAttrs
  mental: MentalAttrs
  physical: PhysicalAttrs
  active: ActiveAttrs
  skills: SkillMap
  /** 周薪（千元） */
  salary: number
  /** 当前所在项目 id，无则 null */
  currentProjectId: string | null
  /** 连续未工作周数（用于衰减） */
  idleWeeks: number
  career: CareerEntry[]
  awards: AwardEntry[]
  /** 累计经验（成长用） */
  experience: number
}
