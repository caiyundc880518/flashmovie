import { useGameStore } from '../store/gameStore'
import { competitorSummary } from '../../core/rules/competitorView'
import { PERSONALITY_ZH, fmtWan } from '../format'

/** 竞对影业列表：点击进竞对详情页（基本信息 / 员工 / 电影项目） */
export function CompetitorsScreen({
  onOpenCompetitor,
}: {
  onOpenCompetitor: (id: string) => void
}) {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const list = state.world.competitors.map((c) => competitorSummary(state, c))

  return (
    <div className="screen">
      <section className="panel">
        <h2>🏢 竞对影业（{list.length}）</h2>
        <p className="dim">
          查看竞争对手的经营状况、团队与影片；他们的员工也可以在招聘页挖角，小心他们反过来挖你的人。
        </p>
        <div className="comp-grid">
          {list.map((s) => (
            <div
              key={s.competitor.id}
              className="comp-card clickable"
              onClick={() => onOpenCompetitor(s.competitor.id)}
            >
              <div className="comp-card-head">
                <b className="table-name">{s.competitor.name}</b>
                <span className="tag tag-gold">{PERSONALITY_ZH[s.competitor.personality]}</span>
              </div>
              <div className="comp-stats">
                <div className="comp-stat">
                  <b>{Math.round(s.competitor.reputation)}</b>
                  <span>声誉</span>
                </div>
                <div className="comp-stat">
                  <b className="gold">{fmtWan(s.totalBoxOffice)}</b>
                  <span>累计票房</span>
                </div>
                <div className="comp-stat">
                  <b>{s.films}</b>
                  <span>出片</span>
                </div>
                <div className="comp-stat">
                  <b>{s.competitor.ips.length}</b>
                  <span>IP</span>
                </div>
              </div>
              <div className="comp-sub dim">
                资金 {fmtWan(s.competitor.cash)} · 团队 {s.competitor.team.length} 人 ·{' '}
                {s.competitor.nextReleaseIn > 0
                  ? `${s.competitor.nextReleaseIn} 周后上映`
                  : '本周上映'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
