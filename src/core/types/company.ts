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

/** 公司当前投资人（分成制） */
export interface CompanyInvestor {
  id: string
  name: string
  /** 片方收入分成比例 0–1 */
  share: number
  /** 剩余待回收金额（万），回收完即退出 */
  remainingToCollect: number
}

/** 公司 */
export interface Company {
  name: string
  /** 现金（万元） */
  cash: number
  /** 声誉 0–100 */
  reputation: number
  /** 写作学校等级 0–3 */
  schoolLevel: number
  loans: Loan[]
  /** 当前投资人（可空） */
  investor?: CompanyInvestor
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
