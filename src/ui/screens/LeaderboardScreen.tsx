import { useGameStore } from '../store/gameStore'
import {
  allTimeFilms,
  monthlyCompanies,
  monthlyFilms,
  weeklyFilms,
  yearlyCompanies,
} from '../../core/rules/leaderboard'
import type { CompanyEntry, FilmEntry } from '../../core/rules/leaderboard'
import { fmtWan, fmtWeek } from '../format'
import { DataTable, type Column } from '../components/DataTable'
import { Tabs } from '../components/Tabs'

const filmColumns: Column<FilmEntry>[] = [
  {
    key: 'rank',
    label: '#',
    render: (_e, i) => <span className="rank-num">{i + 1}</span>,
  },
  { key: 'name', label: '影片', render: (e) => <span className="table-name">{e.name}</span> },
  { key: 'owner', label: '出品方', render: (e) => e.owner },
  { key: 'box', label: '票房', render: (e) => fmtWan(e.boxOffice) },
  { key: 'week', label: '上映周', render: (e) => `${e.year}年第${e.week}周` },
]

const companyColumns: Column<CompanyEntry>[] = [
  {
    key: 'rank',
    label: '#',
    render: (_e, i) => <span className="rank-num">{i + 1}</span>,
  },
  { key: 'name', label: '公司', render: (e) => <span className="table-name">{e.name}</span> },
  { key: 'revenue', label: '收入', render: (e) => fmtWan(e.revenue) },
]

function filmTable(rows: FilmEntry[], empty: string) {
  return rows.length === 0 ? (
    <p className="dim">{empty}</p>
  ) : (
    <DataTable columns={filmColumns} rows={rows} rowKey={(e) => `${e.owner}-${e.name}-${e.week}`} />
  )
}

function companyTable(rows: CompanyEntry[], empty: string) {
  return rows.length === 0 ? (
    <p className="dim">{empty}</p>
  ) : (
    <DataTable columns={companyColumns} rows={rows} rowKey={(e) => e.name} />
  )
}

export function LeaderboardScreen() {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  return (
    <div className="screen">
      <section className="panel">
        <h2>票房排行</h2>
        <Tabs
          tabs={[
            {
              key: 'week',
              label: `本周（${fmtWeek(state.calendar.week)}）`,
              content: filmTable(weeklyFilms(state), '本周暂无影片上映。'),
            },
            {
              key: 'month',
              label: '本月',
              content: filmTable(monthlyFilms(state), '本月暂无影片上映。'),
            },
            {
              key: 'all',
              label: '总榜（前10）',
              content: filmTable(allTimeFilms(state), '暂无历史票房记录。'),
            },
          ]}
        />
      </section>

      <section className="panel">
        <h2>公司收入排行</h2>
        <Tabs
          tabs={[
            {
              key: 'month',
              label: '本月',
              content: companyTable(monthlyCompanies(state), '本月暂无收入记录。'),
            },
            {
              key: 'year',
              label: '本年',
              content: companyTable(yearlyCompanies(state), '本年暂无收入记录。'),
            },
          ]}
        />
      </section>
    </div>
  )
}
