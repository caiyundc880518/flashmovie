import { useGameStore } from '../store/gameStore'
import { Tabs } from '../components/Tabs'
import type { AwardWinner } from '../../core/types'

export function AwardsScreen() {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  // 我方员工获奖履历：按年份分组（第1年、第2年……，随年份无限增长）
  const byYear = new Map<number, Array<{ name: string; award: string; projectName: string }>>()
  for (const w of Object.values(state.workers)) {
    for (const a of w.awards) {
      const list = byYear.get(a.year) ?? []
      list.push({ name: w.name, award: a.award, projectName: a.projectName })
      byYear.set(a.year, list)
    }
  }
  const years = [...byYear.keys()].sort((a, b) => a - b)
  const total = [...byYear.values()].reduce((n, l) => n + l.length, 0)

  const historyTabs = years.map((y) => ({
    key: `year-${y}`,
    label: `第${y}年`,
    content: (
      <ul className="career-list">
        {byYear.get(y)!.map((a, i) => (
          <li key={i}>
            {a.name} 凭《{a.projectName}》获得「{a.award}」
          </li>
        ))}
      </ul>
    ),
  }))

  const winners: AwardWinner[] = state.lastCeremony?.winners ?? []

  return (
    <div className="screen">
      <section className="panel">
        <h2>最近一届 TMA（{state.lastCeremony ? `${state.lastCeremony.year} 年` : '暂无'}）</h2>
        {state.lastCeremony ? (
          <div className="award-grid">
            {winners.map((w) => (
              <div key={w.category} className="award-card">
                <div className="award-card-top">
                  <span className="award-card-icon">🏆</span>
                  <span className="award-card-cat">{w.category}</span>
                  <span className={`tag ${w.ours ? 'tag-gold' : 'tag-pro'}`}>
                    {w.ours ? '我方' : '对手'}
                  </span>
                </div>
                <div className="award-card-film">《{w.filmName}》</div>
                {w.workerName && <div className="award-card-worker">{w.workerName}</div>}
                <div className="award-card-score">得分 {w.score}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="dim">还没有颁奖记录。每年第 52 周跨年时会举行 TMA 颁奖典礼。</p>
        )}
      </section>

      <section className="panel">
        <h2>我方员工获奖履历（{total}）</h2>
        {total === 0 ? (
          <p className="dim">还没有员工拿过奖，冲一部高 AP 的艺术片吧。</p>
        ) : (
          <Tabs tabs={historyTabs} scrollable />
        )}
      </section>
    </div>
  )
}
