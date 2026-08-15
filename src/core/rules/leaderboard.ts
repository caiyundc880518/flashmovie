import type { GameState } from '../types'
import { monthOf } from '../types/calendar'
import { ECONOMY } from '../config/economy'

/** 榜单影片条目 */
export interface FilmEntry {
  name: string
  /** 出品方（我司 或 竞争对手名） */
  owner: string
  boxOffice: number
  week: number
  year: number
}

/** 榜单公司条目（收入） */
export interface CompanyEntry {
  name: string
  revenue: number
}

/** 我方影片片方收入（兼容旧档缺省 revenue） */
function ourFilmRevenue(h: GameState['company']['history'][number]): number {
  return h.revenue ?? h.boxOffice * ECONOMY.cinemaShare
}

/** 全部影片条目（我方 + 对手） */
export function allFilmEntries(state: GameState): FilmEntry[] {
  const ours: FilmEntry[] = state.company.history.map((h) => ({
    name: h.name,
    owner: state.company.name,
    boxOffice: h.boxOffice,
    week: h.week,
    year: h.year,
  }))
  const theirs: FilmEntry[] = state.world.competitors.flatMap((c) =>
    c.history.map((f) => ({
      name: f.name,
      owner: c.name,
      boxOffice: f.boxOffice,
      week: f.week,
      year: f.year,
    })),
  )
  return [...ours, ...theirs]
}

const byBoxOfficeDesc = (a: FilmEntry, b: FilmEntry) => b.boxOffice - a.boxOffice

/** 本周票房榜（前 10） */
export function weeklyFilms(state: GameState): FilmEntry[] {
  return allFilmEntries(state)
    .filter((e) => e.year === state.calendar.year && e.week === state.calendar.week)
    .sort(byBoxOfficeDesc)
    .slice(0, 10)
}

/** 本月票房榜（前 10） */
export function monthlyFilms(state: GameState): FilmEntry[] {
  const m = monthOf(state.calendar.week)
  return allFilmEntries(state)
    .filter((e) => e.year === state.calendar.year && monthOf(e.week) === m)
    .sort(byBoxOfficeDesc)
    .slice(0, 10)
}

/** 总票房榜（前 10） */
export function allTimeFilms(state: GameState): FilmEntry[] {
  return allFilmEntries(state).sort(byBoxOfficeDesc).slice(0, 10)
}

/** 本月公司收入排行（我方真实收入，对手按影院分账估算） */
export function monthlyCompanies(state: GameState): CompanyEntry[] {
  const m = monthOf(state.calendar.week)
  const inMonth = (week: number, year: number) =>
    year === state.calendar.year && monthOf(week) === m
  const ours = state.company.history
    .filter((h) => inMonth(h.week, h.year))
    .reduce((s, h) => s + ourFilmRevenue(h), 0)
  const competitors = state.world.competitors.map((c) => ({
    name: c.name,
    revenue: c.history
      .filter((f) => inMonth(f.week, f.year))
      .reduce((s, f) => s + f.boxOffice * ECONOMY.cinemaShare, 0),
  }))
  return [{ name: state.company.name, revenue: ours }, ...competitors]
    .filter((e) => e.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

/** 本年公司收入排行 */
export function yearlyCompanies(state: GameState): CompanyEntry[] {
  const inYear = (_week: number, year: number) => year === state.calendar.year
  const ours = state.company.history
    .filter((h) => inYear(h.week, h.year))
    .reduce((s, h) => s + ourFilmRevenue(h), 0)
  const competitors = state.world.competitors.map((c) => ({
    name: c.name,
    revenue: c.history
      .filter((f) => inYear(f.week, f.year))
      .reduce((s, f) => s + f.boxOffice * ECONOMY.cinemaShare, 0),
  }))
  return [{ name: state.company.name, revenue: ours }, ...competitors]
    .filter((e) => e.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
}
