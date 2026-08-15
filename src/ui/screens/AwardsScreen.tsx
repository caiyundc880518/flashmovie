import { useGameStore } from '../store/gameStore'
import { fmtWeek } from '../format'
import { DataTable, type Column } from '../components/DataTable'
import type { AwardWinner } from '../../core/types'

const awardColumns: Column<AwardWinner>[] = [
  { key: 'cat', label: '奖项', render: (w) => <span className="award-cat">{w.category}</span> },
  {
    key: 'film',
    label: '影片',
    render: (w) => (
      <>
        《{w.filmName}》
        {w.workerName ? ` · ${w.workerName}` : ''}
      </>
    ),
  },
  { key: 'score', label: '得分', render: (w) => w.score },
  {
    key: 'ours',
    label: '',
    render: (w) => <span className={`tag ${w.ours ? 'tag-gold' : 'tag-pro'}`}>{w.ours ? '我方' : '对手'}</span>,
  },
]

export function AwardsScreen() {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  // 我方员工获奖履历（全部员工）
  const awardHistory = Object.values(state.workers)
    .flatMap((w) => w.awards.map((a) => ({ name: w.name, award: a.award, projectName: a.projectName, week: a.week })))
    .sort((a, b) => b.week - a.week)

  return (
    <div className="screen">
      <section className="panel">
        <h2>最近一届 TMA（{state.lastCeremony ? `${state.lastCeremony.year} 年` : '暂无'}）</h2>
        {state.lastCeremony ? (
          <DataTable
            columns={awardColumns}
            rows={state.lastCeremony.winners}
            rowKey={(w) => w.category}
            emptyText="本届无获奖记录"
          />
        ) : (
          <p className="dim">还没有颁奖记录。每年第 52 周跨年时会举行 TMA 颁奖典礼。</p>
        )}
      </section>

      <section className="panel">
        <h2>我方员工获奖履历（{awardHistory.length}）</h2>
        {awardHistory.length === 0 ? (
          <p className="dim">还没有员工拿过奖，冲一部高 AP 的艺术片吧。</p>
        ) : (
          <ul className="career-list">
            {awardHistory.map((a, i) => (
              <li key={i}>
                {fmtWeek(a.week)} · {a.name} 凭《{a.projectName}》获得「{a.award}」
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
