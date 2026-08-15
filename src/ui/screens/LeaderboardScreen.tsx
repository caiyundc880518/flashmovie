import { useGameStore } from '../store/gameStore'
import { allTimeFilms, monthlyCompanies, monthlyFilms, weeklyFilms, yearlyCompanies } from '../../core/rules/leaderboard'
import type { CompanyEntry, FilmEntry } from '../../core/rules/leaderboard'
import { fmtWan, fmtWeek } from '../format'
import { DataTable, type Column } from '../components/DataTable'

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

export function LeaderboardScreen() {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const weekly = weeklyFilms(state)
  const monthly = monthlyFilms(state)
  const allTime = allTimeFilms(state)
  const mCompanies = monthlyCompanies(state)
  const yCompanies = yearlyCompanies(state)

  return (
    <div className="screen">
      <section className="panel">
        <h2>票房排行 · 本周（{fmtWeek(state.calendar.week)}）</h2>
        {weekly.length === 0 ? (
          <p className="dim">本周暂无影片上映。</p>
        ) : (
          <DataTable columns={filmColumns} rows={weekly} rowKey={(e) => `${e.owner}-${e.name}-${e.week}`} />
        )}
      </section>

      <section className="panel">
        <h2>票房排行 · 本月</h2>
        {monthly.length === 0 ? (
          <p className="dim">本月暂无影片上映。</p>
        ) : (
          <DataTable columns={filmColumns} rows={monthly} rowKey={(e) => `${e.owner}-${e.name}-${e.week}`} />
        )}
      </section>

      <section className="panel">
        <h2>票房排行 · 总榜（前 10）</h2>
        {allTime.length === 0 ? (
          <p className="dim">暂无历史票房记录。</p>
        ) : (
          <DataTable columns={filmColumns} rows={allTime} rowKey={(e) => `${e.owner}-${e.name}-${e.week}`} />
        )}
      </section>

      <section className="panel">
        <h2>公司收入排行 · 本月</h2>
        {mCompanies.length === 0 ? (
          <p className="dim">本月暂无收入记录。</p>
        ) : (
          <DataTable columns={companyColumns} rows={mCompanies} rowKey={(e) => e.name} />
        )}
      </section>

      <section className="panel">
        <h2>公司收入排行 · 本年</h2>
        {yCompanies.length === 0 ? (
          <p className="dim">本年暂无收入记录。</p>
        ) : (
          <DataTable columns={companyColumns} rows={yCompanies} rowKey={(e) => e.name} />
        )}
      </section>
    </div>
  )
}
