import { useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { allTimeFilms, weeklyFilms, type FilmEntry } from '../../core/rules/leaderboard'
import { weeklyCompanyBoxOffice } from '../../core/rules/competitorView'
import { fmtWan, fmtWeek } from '../format'
import { Tabs } from '../components/Tabs'
import { RollingNumber } from '../components/RollingNumber'

/** 排名变动：数据签名变化时基于上次快照计算 delta 并缓存（StrictMode 双渲染安全） */
function useRankDeltas(
  tabKey: string,
  rows: Array<{ key: string; rank: number }>,
): Array<number | null> {
  const ref = useRef<Record<string, { sig: string; deltas: Array<number | null>; ranks: Record<string, number> }>>({})
  const sig = rows.map((r) => `${r.key}:${r.rank}`).join('|')
  const prev = ref.current[tabKey]
  if (!prev || prev.sig !== sig) {
    const ranks: Record<string, number> = {}
    for (const r of rows) ranks[r.key] = r.rank
    const deltas = rows.map((r) => {
      if (!prev) return null
      const p = prev.ranks[r.key]
      return p === undefined ? null : r.rank - p
    })
    ref.current[tabKey] = { sig, deltas, ranks }
    return deltas
  }
  return prev.deltas
}

/** 排名变动标记：▲上升 / ▼下降 / — 持平，null=新上榜 */
function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="rt-delta rt-new">新</span>
  if (d === 0) return <span className="rt-delta">—</span>
  if (d < 0) return <span className="rt-delta rt-up">▲{-d}</span>
  return <span className="rt-delta rt-down">▼{d}</span>
}

function RankTable({
  rows,
  deltas,
  companyName,
  empty,
}: {
  rows: FilmEntry[]
  deltas: Array<number | null>
  companyName: string
  empty: string
}) {
  if (rows.length === 0) return <p className="dim empty-hint">{empty}</p>
  return (
    <div className="rt-list">
      {rows.map((e, i) => (
        <div key={`${e.owner}|${e.name}`} className={`rt-row${i < 3 ? ' rt-top' : ''}`}>
          <span className={`rank-num rt-rank-${i + 1}`}>{i + 1}</span>
          <Delta d={deltas[i]} />
          <span className="table-name rt-name">{e.name}</span>
          <span className={`dim rt-owner${e.owner === companyName ? ' rt-ours' : ''}`}>{e.owner}</span>
          <span className="rt-num">
            <RollingNumber value={e.boxOffice} format={(n) => fmtWan(n)} />
          </span>
          <span className="dim rt-week">
            {e.year}年第{e.week}周
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * 实时票房页：全场（玩家 + NPC 全部影片）每周/总票房排行。
 * 数字用滚动效果、排名变动用 ▲▼ 标记；NPC 片按其上映周一次性计入。
 */
export function RealTimeBoxOfficeScreen() {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const weekly = weeklyFilms(state)
  const all = allTimeFilms(state)
  const weekTotal = weekly.reduce((s, e) => s + e.boxOffice, 0)
  const companies = weeklyCompanyBoxOffice(state)
  const ours = companies.find((e) => e.ours)?.boxOffice ?? 0
  const rivalTotal = companies.filter((e) => !e.ours).reduce((s, e) => s + e.boxOffice, 0)

  const weekRows = weekly.map((e, i) => ({ key: `${e.owner}|${e.name}`, rank: i + 1 }))
  const allRows = all.map((e, i) => ({ key: `${e.owner}|${e.name}`, rank: i + 1 }))
  const weekDeltas = useRankDeltas('week', weekRows)
  const allDeltas = useRankDeltas('all', allRows)

  return (
    <div className="screen">
      <section className="panel">
        <h2>🎬 实时票房（第 {state.calendar.week} 周）</h2>
        <p className="dim">覆盖玩家与全部竞争对手的影片；推进一周后数字滚动、排名变动实时刷新。</p>
        <div className="boxoffice-total rt-total">
          <span className="boxoffice-total-label">全场本周总票房</span>
          <span className="boxoffice-total-num">
            <RollingNumber value={weekTotal} duration={900} format={(n) => fmtWan(n)} />
          </span>
          <span className="rt-compare">
            我司 <RollingNumber value={ours} duration={900} format={(n) => fmtWan(n)} /> · 对手合计{' '}
            <RollingNumber value={rivalTotal} duration={900} format={(n) => fmtWan(n)} />
          </span>
        </div>
        <Tabs
          tabs={[
            {
              key: 'week',
              label: `每周排行（${fmtWeek(state.calendar.week)}）`,
              content: (
                <RankTable
                  rows={weekly}
                  deltas={weekDeltas}
                  companyName={state.company.name}
                  empty="本周暂无影片结算。"
                />
              ),
            },
            {
              key: 'all',
              label: '总票房排行（前10）',
              content: (
                <RankTable
                  rows={all}
                  deltas={allDeltas}
                  companyName={state.company.name}
                  empty="暂无历史票房记录。"
                />
              ),
            },
          ]}
        />
      </section>
    </div>
  )
}
