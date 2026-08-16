import { useGameStore } from '../store/gameStore'
import { TYPE_ZH } from '../format'
import { audienceFit, regionMarkets, type RegionMarket } from '../../core/rules/audience'
import { DataTable, type Column } from '../components/DataTable'
import type { GameState } from '../../core/types'

/** 地区市场 + 市场事件页（GDD §6 Area / Random Events） */
export function MarketScreen() {
  const state = useGameStore((s) => s.state)

  if (!state) return null
  const { world, calendar } = state

  return (
    <div className="screen">
      <section className="panel">
        <h2>地区市场</h2>
        <p className="dim">
          按地区聚合观众群体。宣发时可选择「主攻地区」集中发行——当地偏好匹配则票房放大，错配则收益下降。
        </p>
        <DataTable<RegionMarket>
          columns={regionColumns(state)}
          rows={regionMarkets(state)}
          rowKey={(r) => r.region}
          emptyText="暂无地区数据。"
        />
      </section>

      <section className="panel">
        <h2>市场事件（进行中）</h2>
        {world.activeEvents.length === 0 ? (
          <p className="dim">暂无进行中的市场事件。行业动态会不定期发生，影响票房与口碑。</p>
        ) : (
          <div className="event-list">
            {world.activeEvents.map((e) => (
              <div key={e.id} className="event-block">
                <div className="event-title">⚡ {e.title}</div>
                <div className="event-desc">{e.desc}</div>
                <div className="dim">
                  剩余 {Math.max(0, e.untilWeek - calendar.week)} 周
                  {e.boxOfficeMul ? ` · 票房 ×${e.boxOfficeMul}` : ''}
                  {e.typeBoomMul && e.type ? ` · ${TYPE_ZH[e.type]}片 ×${e.typeBoomMul}` : ''}
                  {e.vfxBonus ? ` · VFX +${Math.round(e.vfxBonus * 100)}%` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const regionColumns = (state: GameState): Column<RegionMarket>[] => [
  { key: 'region', label: '地区', render: (r) => <span className="table-name">{r.region}</span> },
  { key: 'size', label: '市场份额', render: (r) => `${Math.round(r.size * 100)}%` },
  {
    key: 'pref',
    label: '类型偏好',
    render: (r) => {
      const top = (Object.keys(r.focus) as (keyof typeof r.focus)[])
        .map((t) => ({ t, v: r.focus[t] }))
        .sort((a, b) => b.v - a.v)
      return (
        <>
          {top.slice(0, 2).map((x, i) => (
            <span key={x.t}>
              {i > 0 ? ' · ' : ''}
              <b>{TYPE_ZH[x.t]}</b> {x.v.toFixed(2)}
            </span>
          ))}
          <span className="dim"> 其余 {top.slice(2).map((x) => TYPE_ZH[x.t]).join('/')}</span>
        </>
      )
    },
  },
  {
    key: 'fit',
    label: '主流契合',
    render: (r) => {
      const fit = audienceFit(state, state.world.trend?.type ?? 'drama', r.region)
      return <span style={{ color: fit >= 1 ? 'var(--ok)' : 'var(--danger)' }}>×{fit.toFixed(2)}</span>
    },
  },
]
