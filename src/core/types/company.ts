import type { FilmResult } from './film'
import type { IpAsset } from './ip'

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

/** 上市公司状态（IPO，GDD §3.1） */
export interface PublicCompany {
  /** 上市周/年 */
  week: number
  year: number
  /** IPO 融资额（万） */
  raised: number
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
  /** 自建影院数（院线管理；全国影院总数 = 5178 + 此值） */
  ownCinemas: number
  loans: Loan[]
  /** 当前投资人（可空） */
  investor?: CompanyInvestor
  /** 自有剧本 id 列表 */
  ownedScriptIds: string[]
  /** 在职员工 id 列表 */
  employeeIds: string[]
  /** 历史成片 */
  history: FilmResult[]
  /** IP 资产（GDD §3.8，系列化经营） */
  ips: IpAsset[]
  /** 科技研发进度：科技线 id → 累计进度（等级 = floor(进度/100)，上限见配置） */
  tech: Record<string, number>
  /** 上市状态（IPO 后写入） */
  public?: PublicCompany
}

export interface FinancialReport {
  week: number
  income: number
  expense: number
  note: string
}
