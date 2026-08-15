import type { FilmResult } from './film'

/** 贷款 */
export interface Loan {
  id: string
  /** 本金（千元） */
  principal: number
  /** 年利率 0–1 */
  rate: number
  /** 剩余周数 */
  weeksLeft: number
}

/** 公司 */
export interface Company {
  name: string
  /** 现金（千元） */
  cash: number
  /** 声誉 0–100 */
  reputation: number
  loans: Loan[]
  /** 自有剧本 id 列表 */
  ownedScriptIds: string[]
  /** 在职员工 id 列表 */
  employeeIds: string[]
  /** 历史成片 */
  history: FilmResult[]
}

export interface FinancialReport {
  week: number
  income: number
  expense: number
  note: string
}
