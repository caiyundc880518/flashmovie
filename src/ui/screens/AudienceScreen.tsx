import { useGameStore } from '../store/gameStore'
import { TYPE_ZH } from '../format'
import { audienceFit } from '../../core/rules/audience'
import { DataTable, type Column } from '../components/DataTable'
import type { AudienceGroup } from '../../core/types'

/** 观众群体页（GDD §6 Audience Group） */
export function AudienceScreen() {
  const state = useGameStore((s) => s.state)

  if (!state) return null
  const { world } = state

  return (
    <div className="screen">
      <section className="panel">
        <h2>观众群体</h2>
        <p className="dim">
          票房按「群体规模 × 类型关注度」加权结算；容忍度低的市场更挑剔差片，偏好每季度缓慢漂移。
        </p>
        <DataTable<AudienceGroup>
          columns={audienceColumns}
          rows={world.audience}
          rowKey={(g) => g.id}
          emptyText="暂无观众群体数据。"
        />
        <div className="dim" style={{ marginTop: 10 }}>
          当前主流：{world.trend ? TYPE_ZH[world.trend.type] : '—'}（全国观众契合 ×
          {world.trend ? audienceFit(state, world.trend.type).toFixed(2) : '—'}）
        </div>
        <p className="dim" style={{ marginTop: 6 }}>
          宣发时可选「主攻地区」集中发行——详见「地区市场」页。
        </p>
      </section>
    </div>
  )
}

const audienceColumns: Column<AudienceGroup>[] = [
  { key: 'name', label: '群体', render: (g) => <span className="table-name">{g.name}</span> },
  { key: 'region', label: '地区', render: (g) => g.region },
  { key: 'size', label: '规模', render: (g) => `${Math.round(g.size * 100)}%` },
  {
    key: 'tolerance',
    label: '容忍度',
    render: (g) =>
      g.tolerance >= 0.6 ? <span className="good">宽和</span> : g.tolerance >= 0.45 ? '一般' : <span className="bad">挑剔</span>,
  },
  {
    key: 'focus',
    label: '类型偏好',
    render: (g) => {
      const top = (Object.keys(g.focus) as (keyof typeof g.focus)[])
        .map((t) => ({ t, v: g.focus[t] }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 2)
      return top.map((x, i) => (
        <span key={x.t}>
          {i > 0 ? ' · ' : ''}
          {TYPE_ZH[x.t]} {x.v.toFixed(2)}
        </span>
      ))
    },
  },
]
