import { useGameStore } from '../store/gameStore'
import { TYPE_ZH, fmtScore10, scoreColor10 } from '../format'

interface ReviewEntry {
  film: string
  score: number
  text?: string
  week: number
}

export function CriticsScreen() {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const { critics } = state.world

  // 从历史成片中收集每位影评人的评分记录
  const reviewsByCritic = new Map<string, ReviewEntry[]>()
  for (const h of state.company.history) {
    for (const r of h.reviews ?? []) {
      const arr = reviewsByCritic.get(r.criticId) ?? []
      arr.push({ film: h.name, score: r.score, text: r.text, week: h.week })
      reviewsByCritic.set(r.criticId, arr)
    }
  }

  return (
    <div className="screen">
      <section className="panel">
        <h2>影评人（{critics.length}）</h2>
        <p className="dim">
          每位影评人有类型偏好与影响力：偏好类型加分（+1.0），不匹配减分（−0.5），评分 10 分制（一位小数）；
          平均口碑与观众评分共同影响公司声誉。
        </p>
        <div className="critic-grid">
          {critics.map((c) => {
            const list = (reviewsByCritic.get(c.id) ?? []).slice(-3).reverse()
            return (
              <div key={c.id} className="critic-card">
                <div className="critic-card-head">
                  <span className="table-name">{c.name}</span>
                  <span className="tag">{c.taste === 'none' ? '无偏好' : TYPE_ZH[c.taste]}</span>
                </div>
                <div className="attr-line">影响力 {c.influence}</div>
                <div className="critic-card-reviews">
                  {list.length === 0 ? (
                    <span className="dim">暂无评分记录</span>
                  ) : (
                    list.map((r, i) => (
                      <div key={i} className="critic-card-review">
                        <span className="dim">{r.film}</span>
                        <b style={{ color: scoreColor10(r.score) }}>{fmtScore10(r.score)}</b>
                        <span className="critic-quote">「{r.text ?? '—'}」</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
