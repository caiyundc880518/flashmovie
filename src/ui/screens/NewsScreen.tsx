import { useGameStore } from '../store/gameStore'
import { fmtWeek } from '../format'

export function NewsScreen() {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const news = [...state.world.news].reverse()

  return (
    <div className="screen">
      <section className="panel">
        <h2>新闻（{state.world.news.length}）</h2>
        {news.length === 0 && <p className="dim">暂无新闻。</p>}
        <ul className="news-list news-list-full">
          {news.map((n) => (
            <li key={n.id}>
              <span className="news-week">{fmtWeek(n.week)}</span>
              <span className="news-text">{n.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
