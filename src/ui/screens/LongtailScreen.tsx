import { useState } from 'react'
import type { Channel } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { lowerChannelsOf } from '../../core/tick/distribution'
import { CHANNEL_INFO } from '../../core/config/channels'
import { IP_LONGTAIL_CONFIG } from '../../core/config/ip'
import { STAGE_ZH, fmtWan } from '../format'
import { Bar } from '../components/Bar'
import { MoneyText } from '../components/MoneyText'
import { Tabs } from '../components/Tabs'

/** IP 当前周周边收入估算（万/周，与结算公式一致） */
function merchPerWeek(hotness: number, level: number, merchBonus: number): number {
  return (
    hotness *
    IP_LONGTAIL_CONFIG.merchBasePerHotness *
    (1 + (level - 1) * IP_LONGTAIL_CONFIG.merchLevelK) *
    (1 + merchBonus / 100)
  )
}

/**
 * 长尾收益页：TAB「放映」= 进行中的放映 + 已下片可再发行；TAB「IP长尾」= 周边收入 + 版权交易
 */
export function LongtailScreen({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [rereleaseSel, setRereleaseSel] = useState<Record<string, Channel | ''>>({})

  if (!state) return null

  const released = state.projects.filter((p) => p.stage === 'released' && p.run)
  const active = released.filter((p) => p.run!.status === 'presale' || p.run!.status === 'running')
  const rereleasable = released.filter((p) => p.run!.status === 'idle')

  /** TAB「放映」：进行中的放映 + 已下片可再发行 */
  const screeningTab = (
    <>
      <section className="panel">
        <h2>🎬 进行中的放映（{active.length}）</h2>
        <p className="dim">每周推进自动结算当周票房/流量/收入；首轮放映下片后结算成员成长与 IP 沉淀。</p>
        {active.length === 0 && <p className="dim empty-hint">当前没有正在放映或待映的影片。</p>}
        {active.map((p) => {
          const rs = p.run!
          const run = rs.runs.find((x) => x.id === rs.currentRunId)
          return (
            <div key={p.id} className="lt-row" onClick={() => onOpenProject(p.id)}>
              <span className="table-name">{p.name}</span>
              {rs.status === 'presale' ? (
                <span className="tag">⏳ 待映 · {Math.max(0, rs.releaseWeek - state.calendar.week)} 周后 · 预售 {fmtWan(rs.presale)}</span>
              ) : (
                <span className="tag tag-gold">
                  🎬 {run ? `${CHANNEL_INFO[run.channel].label}档 · 第 ${run.weekly.length + 1} 周` : ''} · 累计{' '}
                  {fmtWan(p.result?.boxOffice ?? 0)}
                </span>
              )}
              <span className="dim">{STAGE_ZH[p.stage]} · 点击查看详情</span>
            </div>
          )
        })}
      </section>

      <section className="panel">
        <h2>📦 已下片 · 可再发行（{rereleasable.length}）</h2>
        <p className="dim">再发行渠道只能严格更低（影院→网络/DVD/免费）；不定档不预售，下周直接开映，收益按最终口碑/MP 结算。</p>
        {rereleasable.length === 0 && <p className="dim empty-hint">没有已下片且仍有更低档可再发行的影片。</p>}
        {rereleasable.map((p) => {
          const lastRun = p.run!.runs[p.run!.runs.length - 1]
          const lower = lastRun ? lowerChannelsOf(lastRun.channel) : []
          const sel = rereleaseSel[p.id] ?? ''
          return (
            <div key={p.id} className="lt-row">
              <span className="table-name" onClick={() => onOpenProject(p.id)} style={{ cursor: 'pointer' }}>
                {p.name}
              </span>
              <span className="dim">
                上一档：{CHANNEL_INFO[lastRun.channel].label} · 累计票房 {fmtWan(p.result?.boxOffice ?? 0)}
              </span>
              {lower.length > 0 && (
                <>
                  <select
                    value={sel}
                    onChange={(e) => setRereleaseSel((prev) => ({ ...prev, [p.id]: e.target.value as Channel | '' }))}
                  >
                    <option value="">选择更低档…</option>
                    {lower.map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_INFO[c].label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-primary"
                    disabled={!sel}
                    onClick={() => {
                      if (!sel) return
                      dispatch({ type: 'rerelease', projectId: p.id, channel: sel as Channel })
                      setRereleaseSel((prev) => ({ ...prev, [p.id]: '' }))
                    }}
                  >
                    再发行 ▶
                  </button>
                </>
              )}
            </div>
          )
        })}
      </section>
    </>
  )

  /** TAB「IP长尾」：周边收入 + 版权交易 */
  const ipTab = (
    <section className="panel">
      <h2>💎 IP 长尾（周边收入 + 版权交易）</h2>
      <p className="dim">
        周边收入每周按热门度入账（热门度随系列新片 MP 抬升、每周自然衰减）；版权交易把 IP 版权卖给电视剧/游戏公司，固定总额每周分期。
      </p>
      {state.company.ips.length === 0 && <p className="dim empty-hint">还没有沉淀的 IP 资产（首轮票房 + 影评双达标即可沉淀）。</p>}
      {state.company.ips.map((ip) => (
        <div key={ip.id} className="lt-ip">
          <div className="lt-ip-head">
            <b className="table-name">{ip.name}</b>
            <span className="tag tag-gold">Lv.{ip.level}</span>
            <span className="lt-ip-hot">
              热门度 <b style={{ color: 'var(--gold)' }}>{Math.round(ip.hotness ?? 0)}</b>
              <span className="dim">/ 100</span>
            </span>
            <span className="dim">
              周周边 ≈ <MoneyText value={merchPerWeek(ip.hotness ?? 0, ip.level ?? 1, ip.merchBonus ?? 0)} /> · 已累计{' '}
              {fmtWan(ip.royaltyEarned ?? 0)}
            </span>
            <span className="dim">系列 {ip.films?.length ?? 0} 部 · 累计票房 {fmtWan(ip.totalBoxOffice ?? 0)}</span>
          </div>
          <Bar label="热门度" value={ip.hotness ?? 0} color="var(--gold)" />
          <div className="lt-deals">
            {(['tv', 'game'] as const).map((kind) => {
              const deals = ip.deals ?? []
              const active = deals.find((d) => d.kind === kind && d.status === 'active')
              const doneCount = deals.filter((d) => d.kind === kind && d.status === 'done').length
              return (
                <div key={kind} className="lt-deal">
                  <span className="slot-label">{kind === 'tv' ? '📺 电视剧版权' : '🎮 游戏版权'}</span>
                  {active ? (
                    <span className="dim">
                      进行中 · 已付 <b style={{ color: 'var(--gold)' }}>{fmtWan(active.paid)}</b> / {fmtWan(active.total)} · 第{' '}
                      {active.weeksPaid}/{active.weeks} 周
                    </span>
                  ) : (
                    <span className="dim">{doneCount > 0 ? `已完成 ${doneCount} 次 · 可再签` : '未签约'}</span>
                  )}
                  <button
                    className="btn-primary"
                    disabled={!!active}
                    onClick={() => dispatch({ type: 'sellCopyright', ipId: ip.id, kind })}
                  >
                    {active ? '签约中…' : `出售${kind === 'tv' ? '电视剧' : '游戏'}版权 ▶`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )

  return (
    <div className="screen">
      <Tabs
        tabs={[
          { key: 'screening', label: '放映', content: screeningTab },
          { key: 'ip', label: 'IP长尾', content: ipTab },
        ]}
      />
    </div>
  )
}
