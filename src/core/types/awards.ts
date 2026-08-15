/** TMA 奖项类型（GDD §6 Award Ceremony） */
export type AwardCategory =
  | '最佳影片'
  | '最佳导演'
  | '最佳演员'
  | '最佳摄影'
  | '最佳剪辑'
  | '最佳特效'

/** 单奖项得主 */
export interface AwardWinner {
  category: string
  filmName: string
  /** 个人奖项的得主员工（最佳影片无） */
  workerId?: string
  workerName?: string
  /** 评选得分 */
  score: number
  /** 是否我方 */
  ours: boolean
}

/** 一届颁奖典礼结果 */
export interface YearAwards {
  /** 评选的年度（上一年） */
  year: number
  winners: AwardWinner[]
}
