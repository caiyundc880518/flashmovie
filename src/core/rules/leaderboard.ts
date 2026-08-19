import type { GameState } from '../types'
import { monthOf } from '../types/calendar'
import { ECONOMY } from '../config/economy'

/**
 * 票房排行（周结算模型）：
 * 票房已改为每周动态结算，排行同样按「每部影片的每周结算数据」聚合——
 * 本周榜 = 本周结算票房；本月榜 = 本月每周结算累计；总榜 = 全部周结算实时累计（含再发行）。
 * 旧档（无 run 的已完结影片）整部按其上映周一次性计入。
 */

/** 榜单影片条目 */
export interface FilmEntry {
  name: string
  /** 出品方（我司 或 竞争对手名） */
  owner: string
  boxOffice: number
  /** 上映周（该片最早一次结算所在周） */
  week: number
  year: number
}

/** 榜单公司条目（收入） */
export interface CompanyEntry {
  name: string
  revenue: number
}

/** 单周结算记录（影片 × 周 粒度） */
interface FilmSettlement {
  name: string
  owner: string
  week: number
  year: number
  boxOffice: number
  revenue: number
}

/** 我方影片的每周结算（来自放映 run 的 weekly；旧档无 run 时整部按其上映周计入） */
function ourSettlements(state: GameState): FilmSettlement[] {
  const out: FilmSettlement[] = []
  for (const p of state.projects) {
    if (p.stage !== 'released') continue
    const rs = p.run
    if (rs && rs.runs.length > 0) {
      for (const run of rs.runs) {
        for (const w of run.weekly) {
          out.push({
            name: p.name,
            owner: state.company.name,
            week: w.week,
            year: w.year,
            boxOffice: w.boxOffice,
            revenue: w.revenue,
          })
        }
      }
    } else if (p.result) {
      // 旧档已完结影片（无周记录）：整部按其上映周一次性计入
      const r = p.result
      out.push({
        name: p.name,
        owner: state.company.name,
        week: r.week,
        year: r.year,
        boxOffice: r.boxOffice,
        revenue: r.revenue ?? r.boxOffice * ECONOMY.cinemaShare,
      })
    }
  }
  return out
}

/** 对手影片结算（对手模型为上映周一次性入账整部票房） */
function competitorSettlements(state: GameState): FilmSettlement[] {
  return state.world.competitors.flatMap((c) =>
    c.history.map((f) => ({
      name: f.name,
      owner: c.name,
      week: f.week,
      year: f.year,
      boxOffice: f.boxOffice,
      revenue: f.boxOffice * ECONOMY.cinemaShare,
    })),
  )
}

function allSettlements(state: GameState): FilmSettlement[] {
  return [...ourSettlements(state), ...competitorSettlements(state)]
}

const byBoxOfficeDesc = (a: FilmEntry, b: FilmEntry) => b.boxOffice - a.boxOffice

const inWeek =
  (cal: GameState['calendar']) =>
  (e: FilmSettlement): boolean =>
    e.year === cal.year && e.week === cal.week

const inMonth =
  (cal: GameState['calendar']) =>
  (e: FilmSettlement): boolean =>
    e.year === cal.year && monthOf(e.week) === monthOf(cal.week)

const inYear =
  (cal: GameState['calendar']) =>
  (e: FilmSettlement): boolean =>
    e.year === cal.year

/** 按影片聚合某区间的每周票房（上映周 = 该片在区间内最早结算周） */
function aggregateFilms(settlements: FilmSettlement[], keep: (e: FilmSettlement) => boolean): FilmEntry[] {
  const by = new Map<string, FilmEntry>()
  for (const e of settlements) {
    if (!keep(e)) continue
    const k = `${e.owner}|${e.name}`
    const cur = by.get(k)
    if (!cur) {
      by.set(k, { name: e.name, owner: e.owner, boxOffice: e.boxOffice, week: e.week, year: e.year })
    } else {
      cur.boxOffice += e.boxOffice
      if (e.year < cur.year || (e.year === cur.year && e.week < cur.week)) {
        cur.week = e.week
        cur.year = e.year
      }
    }
  }
  return [...by.values()].sort(byBoxOfficeDesc).slice(0, 10)
}

/** 按公司聚合某区间的每周分账收入 */
function aggregateCompanies(
  settlements: FilmSettlement[],
  keep: (e: FilmSettlement) => boolean,
): CompanyEntry[] {
  const by = new Map<string, number>()
  for (const e of settlements) {
    if (!keep(e)) continue
    by.set(e.owner, (by.get(e.owner) ?? 0) + e.revenue)
  }
  return [...by.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .filter((e) => e.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

/** 本周票房榜（前 10）：本周每周结算的票房 */
export function weeklyFilms(state: GameState): FilmEntry[] {
  return aggregateFilms(allSettlements(state), inWeek(state.calendar))
}

/** 本月票房榜（前 10）：本月每周结算累计 */
export function monthlyFilms(state: GameState): FilmEntry[] {
  return aggregateFilms(allSettlements(state), inMonth(state.calendar))
}

/** 总票房榜（前 10）：全部周结算实时累计（含再发行） */
export function allTimeFilms(state: GameState): FilmEntry[] {
  return aggregateFilms(allSettlements(state), () => true)
}

/** 本月公司收入排行：本月每周分账累计 */
export function monthlyCompanies(state: GameState): CompanyEntry[] {
  return aggregateCompanies(allSettlements(state), inMonth(state.calendar))
}

/** 本年公司收入排行：本年每周分账累计 */
export function yearlyCompanies(state: GameState): CompanyEntry[] {
  return aggregateCompanies(allSettlements(state), inYear(state.calendar))
}
