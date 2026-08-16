import { useGameStore } from '../store/gameStore'
import { TYPE_ZH } from '../format'
import { DataTable, type Column } from '../components/DataTable'
import type { Critic } from '../../core/types'

interface ReviewEntry {
  criticId: string
  film: string
  score: number
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
      arr.push({ criticId: r.criticId, film: h.name, score: r.score, week: h.week })
      reviewsByCritic.set(r.criticId, arr)
    }
  }

  const columns: Column<Critic>[] = [
    { key: 'name', label: '影评人', render: (c) => <span className="table-name">{c.name}</span> },
    {
      key: 'taste',
      label: '类型偏好',
      render: (c) => (c.taste === 'none' ? '无偏好' : TYPE_ZH[c.taste]),
    },
    { key: 'influence', label: '影响力', render: (c) => c.influence },
    {
      key: 'latest',
      label: '近期评分',
      render: (c) => {
        const list = (reviewsByCritic.get(c.id) ?? []).slice(-3).reverse()
        if (list.length === 0) return <span className="dim">暂无</span>
        return list
          .map((r) => `${r.film} ${r.score > 10 ? (r.score / 10).toFixed(1) : r.score.toFixed(1)}分`)
          .join(' / ')
      },
    },
  ]

  return (
    <div className="screen">
      <section className="panel">
        <h2>影评人（{critics.length}）</h2>
        <p className="dim">
          每位影评人有类型偏好与影响力：偏好类型加分（+1.0），不匹配减分（−0.5），评分 10 分制（一位小数）；
          平均口碑与观众评分共同影响公司声誉。
        </p>
        <DataTable
          columns={columns}
          rows={critics}
          rowKey={(c) => c.id}
          emptyText="暂无影评人"
        />
      </section>
    </div>
  )
}
