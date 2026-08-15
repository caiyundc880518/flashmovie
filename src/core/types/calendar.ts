/** 日历：V1 只存 年+周（1–52），月份由周推导 */
export interface Calendar {
  /** 第几年（从 1 开始） */
  year: number
  /** 第几周（1–52） */
  week: number
}

/** 由周推导月份（1–12），按月近似 4.33 周 */
export function monthOf(week: number): number {
  return Math.min(12, Math.floor(((week - 1) * 12) / 52) + 1)
}

/** 由周推导季度（1–4） */
export function quarterOf(week: number): number {
  return Math.floor((week - 1) / 13) + 1
}

export function isMonthStart(week: number): boolean {
  return monthOf(week) !== monthOf(week - 1)
}

export function isYearEnd(week: number): boolean {
  return week === 52
}

export function advanceWeek(cal: Calendar): Calendar {
  if (cal.week >= 52) {
    return { year: cal.year + 1, week: 1 }
  }
  return { year: cal.year, week: cal.week + 1 }
}
