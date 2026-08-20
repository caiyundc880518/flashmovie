import type { Competitor, CompetitorFilm, GameState } from '../types'

/** 竞对公司聚合统计（竞对影业列表 / 详情页展示用） */
export interface CompetitorSummary {
  competitor: Competitor
  films: number
  totalBoxOffice: number
  avgBoxOffice: number
  best: CompetitorFilm | undefined
}

/** 竞对公司聚合统计（出片数 / 累计票房 / 平均票房 / 最佳影片） */
export function competitorSummary(_state: GameState, c: Competitor): CompetitorSummary {
  const films = c.history.length
  const totalBoxOffice = c.history.reduce((s, f) => s + f.boxOffice, 0)
  return {
    competitor: c,
    films,
    totalBoxOffice,
    avgBoxOffice: films > 0 ? Math.round(totalBoxOffice / films) : 0,
    best: films > 0 ? [...c.history].sort((a, b) => b.boxOffice - a.boxOffice)[0] : undefined,
  }
}

/** 本周公司票房条目（我司 + 各家 NPC；NPC 按其上映周一次性计入） */
export interface CompanyWeekEntry {
  name: string
  boxOffice: number
  ours: boolean
}

/** 本周公司票房对比：我司每周结算累计 + 各家 NPC 本周上映片票房 */
export function weeklyCompanyBoxOffice(state: GameState): CompanyWeekEntry[] {
  const cal = state.calendar
  const out: CompanyWeekEntry[] = []
  let ours = 0
  for (const p of state.projects) {
    if (p.stage !== 'released' || !p.run) continue
    for (const run of p.run.runs) {
      for (const w of run.weekly) {
        if (w.year === cal.year && w.week === cal.week) ours += w.boxOffice
      }
    }
  }
  if (ours > 0) out.push({ name: state.company.name, boxOffice: ours, ours: true })
  for (const c of state.world.competitors) {
    const week = c.history.reduce(
      (s, f) => (f.year === cal.year && f.week === cal.week ? s + f.boxOffice : s),
      0,
    )
    if (week > 0) out.push({ name: c.name, boxOffice: week, ours: false })
  }
  return out.sort((a, b) => b.boxOffice - a.boxOffice)
}

/** 竞对公司本周票房（用于实时票房页我司 vs NPC 对比） */
export function competitorWeekBoxOffice(state: GameState, c: Competitor): number {
  const cal = state.calendar
  return c.history.reduce(
    (s, f) => (f.year === cal.year && f.week === cal.week ? s + f.boxOffice : s),
    0,
  )
}
