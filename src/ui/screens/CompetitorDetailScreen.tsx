import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { competitorSummary } from '../../core/rules/competitorView'
import { PERSONALITY_DESC, PERSONALITY_ZH, ROLE_ZH, TYPE_ZH, fmtWan } from '../format'
import { Tabs } from '../components/Tabs'
import { Modal } from '../components/Modal'
import { WorkerDetail } from '../components/WorkerDetail'
import { PoachAction } from '../components/PoachAction'
import { MoneyText } from '../components/MoneyText'

/** 竞对详情页：基本信息 / 员工（含挖角）/ 电影项目 三 TAB */
export function CompetitorDetailScreen({
  competitorId,
  onBack,
}: {
  competitorId: string
  onBack: () => void
}) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!state) return null
  const c = state.world.competitors.find((x) => x.id === competitorId)
  if (!c) {
    return (
      <div className="screen">
        <p className="dim">未找到该竞对影业。</p>
        <button onClick={onBack}>← 返回</button>
      </div>
    )
  }
  const sum = competitorSummary(state, c)
  const selected = selectedId ? state.workers[selectedId] : null

  const infoTab = (
    <section className="panel">
      <div className="comp-info">
        <div className="comp-info-line">
          <span className="slot-label">性格</span>
          <span className="tag tag-gold">{PERSONALITY_ZH[c.personality]}</span>
          <span className="dim">{PERSONALITY_DESC[c.personality]}</span>
        </div>
        <div className="comp-info-grid">
          <div className="comp-info-cell">
            <b>{Math.round(c.reputation)}</b>
            <span>声誉</span>
          </div>
          <div className="comp-info-cell">
            <b className="gold">{fmtWan(c.cash)}</b>
            <span>资金</span>
          </div>
          <div className="comp-info-cell">
            <b>{sum.films}</b>
            <span>出片</span>
          </div>
          <div className="comp-info-cell">
            <b className="gold">{fmtWan(sum.totalBoxOffice)}</b>
            <span>累计票房</span>
          </div>
          <div className="comp-info-cell">
            <b>{fmtWan(sum.avgBoxOffice)}</b>
            <span>平均票房</span>
          </div>
          <div className="comp-info-cell">
            <b>{c.ips.length}</b>
            <span>沉淀 IP</span>
          </div>
          <div className="comp-info-cell">
            <b>{c.team.length}</b>
            <span>员工</span>
          </div>
          <div className="comp-info-cell">
            <b>{c.nextReleaseIn > 0 ? `${c.nextReleaseIn} 周` : '本周'}</b>
            <span>下次上映</span>
          </div>
        </div>
        {sum.best && (
          <div className="comp-info-line">
            <span className="slot-label">最佳影片</span>
            <b className="table-name">{sum.best.name}</b>
            <span className="dim">
              {sum.best.year}年第{sum.best.week}周 · AP {sum.best.ap} · MP {sum.best.mp} · 票房{' '}
              {fmtWan(sum.best.boxOffice)}
            </span>
          </div>
        )}
        <h3>沉淀 IP（{c.ips.length}）</h3>
        {c.ips.length === 0 ? (
          <p className="dim">还没有沉淀 IP（高票房片会沉淀）。</p>
        ) : (
          <div className="comp-ips">
            {c.ips.map((ip) => (
              <div key={ip.id} className="comp-ip">
                <b className="table-name">
                  {ip.name}
                  {ip.films > 1 ? <span className="tag tag-gold">系列 ×{ip.films}</span> : null}
                </b>
                <span className="dim">
                  {TYPE_ZH[ip.type]} · 累计票房 {fmtWan(ip.totalBoxOffice)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )

  const staffTab = (
    <section className="panel">
      <h2>👥 员工（{c.team.length}）</h2>
      <p className="dim">点击员工查看属性/履历/奖项，也可直接从详情弹窗挖角。</p>
      {c.team.length === 0 ? (
        <p className="dim empty-hint">该对手暂时没有员工。</p>
      ) : (
        <div className="worker-grid">
          {c.team.map((wid) => {
            const w = state.workers[wid]
            if (!w) return null
            return (
              <div key={wid} className="worker-card clickable" onClick={() => setSelectedId(wid)}>
                <div className="worker-head">
                  <div className="avatar">{w.name[0]}</div>
                  <div>
                    <div className="worker-name">{w.name}</div>
                    <div className="worker-role">{ROLE_ZH[w.role]}</div>
                  </div>
                </div>
                <div>
                  {w.basic.ca < 50 ? (
                    <span className="tag tag-rookie">潜力新人</span>
                  ) : (
                    <span className="tag tag-pro">经验丰富</span>
                  )}
                </div>
                <div className="worker-stats">
                  <div className="worker-stat">
                    <b>{w.basic.pa}</b>
                    <span>PA 潜力</span>
                  </div>
                  <div className="worker-stat">
                    <b className="gold">{w.basic.ca}</b>
                    <span>CA 咖位</span>
                  </div>
                </div>
                <div className="worker-sub">
                  Fame {Math.round(w.basic.fame)} · {w.gender === 'male' ? '男' : '女'} {w.age}岁
                </div>
                <div className="worker-footer">
                  <span className="dim">
                    周薪 <MoneyText value={w.salary} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )

  const filmsTab = (
    <section className="panel">
      <h2>🎬 电影项目（{sum.films}）</h2>
      <p className="dim">最近 {sum.films} 部影片（按上映时间倒序）。</p>
      {sum.films === 0 ? (
        <p className="dim empty-hint">该对手还没有上映过影片。</p>
      ) : (
        <div className="comp-film-grid">
          {[...c.history].reverse().map((f, i) => (
            <div key={i} className="comp-film-card">
              <div className="comp-film-head">
                <span className="table-name">{f.name}</span>
                {f.type && <span className="tag">{TYPE_ZH[f.type]}</span>}
              </div>
              <div className="comp-film-meta dim">
                {f.year}年第{f.week}周上映 · AP {f.ap} · MP {f.mp}
              </div>
              <div className="comp-film-scores dim">
                影评 {f.criticScore?.toFixed(1) ?? '—'} · 观众 {f.audienceScore?.toFixed(1) ?? '—'}
              </div>
              <div className="comp-film-box gold">
                <b>{fmtWan(f.boxOffice)}</b>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div className="screen">
      <div className="page-head">
        <button className="btn" onClick={onBack}>
          ← 返回
        </button>
        <h2>
          🏢 {c.name} <span className="dim">（{PERSONALITY_ZH[c.personality]}）</span>
        </h2>
      </div>
      <Tabs
        tabs={[
          { key: 'info', label: '基本信息', content: infoTab },
          { key: 'staff', label: `员工（${c.team.length}）`, content: staffTab },
          { key: 'films', label: `电影项目（${sum.films}）`, content: filmsTab },
        ]}
      />

      {selected && (
        <Modal
          title={
            <>
              {selected.name} <span className="dim">{ROLE_ZH[selected.role]}</span>
            </>
          }
          wide
          onClose={() => setSelectedId(null)}
        >
          <WorkerDetail
            worker={selected}
            actions={
              <div className="poach-modal-action">
                <span className="dim">挖角该员工：</span>
                <PoachAction
                  state={state}
                  competitor={c}
                  worker={selected}
                  dispatch={dispatch}
                  onDone={() => setSelectedId(null)}
                />
              </div>
            }
          />
        </Modal>
      )}
    </div>
  )
}
