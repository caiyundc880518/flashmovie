import { useState } from 'react'
import type { Worker } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { ROLE_ZH, moodColor } from '../format'
import { ECONOMY } from '../../core/config/economy'
import { RECRUIT_POOLS, type RecruitPoolConfig } from '../../core/config/recruit'
import { TEN_PULL_DISCOUNT } from '../../core/config/writers'
import { WorkerDetail } from '../components/WorkerDetail'
import { Modal } from '../components/Modal'
import { MoneyText } from '../components/MoneyText'

interface GachaState {
  pool: RecruitPoolConfig
  drawn: Worker[]
}

export function RecruitScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gacha, setGacha] = useState<GachaState | null>(null)
  const [flipped, setFlipped] = useState<boolean[]>([])

  if (!state) return null
  const candidates = state.world.candidates
  const selected = selectedId ? candidates.find((c) => c.id === selectedId) : null

  /** 花钱抽人：1 抽或 10 连（9 折），抽到的候选人进入弹窗与下方卡片 */
  const refresh = (pool: RecruitPoolConfig, count: 1 | 10) => {
    const total = Math.round(pool.cost * count * (count === 10 ? TEN_PULL_DISCOUNT : 1))
    if (state.company.cash < total) return
    dispatch({ type: 'refreshCandidates', pool: pool.id, count })
    const latest = useGameStore.getState().state
    const drawn = latest?.world.candidates ?? []
    setGacha({ pool, drawn })
    setFlipped(drawn.map(() => false))
  }

  const flip = (idx: number) => setFlipped((f) => f.map((v, j) => (j === idx ? true : v)))
  const flipAll = () => {
    if (!gacha) return
    gacha.drawn.forEach((_, i) => {
      window.setTimeout(() => {
        setFlipped((f) => f.map((v, j) => (j === i ? true : v)))
      }, i * 380)
    })
  }

  return (
    <div className="screen">
      <section className="panel">
        <h2>招聘抽卡</h2>
        <p className="dim">
          按单个演员价格抽人：1 抽 / 10 连（9 折）。档位决定人才质量——流水市场量大便宜但多生手，专业学院贵但底子扎实。
        </p>
        <div className="gacha-options">
          {RECRUIT_POOLS.map((pool) => {
            const p1 = pool.cost
            const p10 = Math.round(pool.cost * 10 * TEN_PULL_DISCOUNT)
            const can1 = state.company.cash >= p1
            const can10 = state.company.cash >= p10
            return (
              <div key={pool.id} className={`gacha-option gacha-theme-${pool.id}`}>
                <div className="gacha-option-head">
                  <span className="slot-title">{pool.label}</span>
                  <span className="tag tag-required">{pool.cost} 万/人</span>
                </div>
                <p className="dim">{pool.desc}</p>
                <div className="attr-line">
                  高 CA 概率 {Math.round(pool.highCaChance * 100)}% · 高 PA 概率{' '}
                  {Math.round(pool.highPaChance * 100)}%
                </div>
                <div className="btn-row">
                  <button className="btn-primary" disabled={!can1} onClick={() => refresh(pool, 1)}>
                    抽 1 人（{p1} 万）
                  </button>
                  <button disabled={!can10} onClick={() => refresh(pool, 10)}>
                    10 连抽（{p10} 万 · 9 折）
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h2>招聘市场（{candidates.length}）</h2>
        <p className="dim">
          点击卡片查看详情；雇佣需支付签约费（{ECONOMY.hireWorkerSignFee} 万/人），之后按周支付薪水。
        </p>
        {candidates.length > 0 && (
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button
              className="btn-primary"
              disabled={state.company.cash < ECONOMY.hireWorkerSignFee * candidates.length}
              onClick={() =>
                dispatch({
                  type: 'hireCandidates',
                  candidateIds: candidates.map((w) => w.id),
                })
              }
            >
              一键雇佣全部（{candidates.length} 人 · {ECONOMY.hireWorkerSignFee * candidates.length} 万）
            </button>
          </div>
        )}
        {candidates.length === 0 ? (
          <p className="dim empty-hint">暂无候选人，花钱刷新或等待市场刷新。</p>
        ) : (
          <div className="worker-grid">
            {candidates.map((w) => (
              <div
                key={w.id}
                className="worker-card clickable"
                onClick={() => setSelectedId(w.id)}
              >
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
                  Fame {Math.round(w.basic.fame)} · 心情{' '}
                  <span style={{ color: moodColor(w.active.mood) }}>{Math.round(w.active.mood)}</span>{' '}
                  · {w.gender === 'male' ? '男' : '女'} {w.age}岁
                </div>
                <div className="worker-footer">
                  <span className="dim">
                    周薪 <MoneyText value={w.salary} />
                  </span>
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'hireWorker', candidateId: w.id })
                    }}
                  >
                    雇佣
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 抽卡弹窗：卡背 → 逐张翻开 */}
      {gacha && (
        <Modal title={`🎴 ${gacha.pool.label} · 抽卡结果`} wide onClose={() => setGacha(null)}>
          <p className="dim">
            {gacha.pool.desc}——点击卡片逐张翻开，翻完后可在下方卡片雇佣。
          </p>
          <div className="gacha-grid">
            {gacha.drawn.map((w, i) => {
              const isFlipped = flipped[i]
              const epic = w.basic.pa >= 85 || w.basic.ca >= 80
              const rare = w.basic.ca >= 70
              const cls = epic ? 'gacha-epic' : rare ? 'gacha-rare' : ''
              return (
                <div
                  key={w.id}
                  className={`gacha-card gacha-theme-${gacha.pool.id} ${cls}${isFlipped ? ' gacha-flipped' : ''}`}
                  onClick={() => flip(i)}
                >
                  <div className="gacha-card-inner">
                    <div className="gacha-face gacha-back">
                      <span className="gacha-star">🎬</span>
                      <span>{gacha.pool.label}</span>
                      <span className="dim">点击翻开</span>
                    </div>
                    <div className="gacha-face gacha-front">
                      <span className="table-name">{w.name}</span>
                      <span className="tag">{ROLE_ZH[w.role]}</span>
                      <span className="dim">
                        {w.gender === 'male' ? '男' : '女'} · {w.age}岁
                      </span>
                      <span className="ca-big">{w.basic.ca}</span>
                      <span className="dim">
                        PA {w.basic.pa} · Fame {Math.round(w.basic.fame)} · 心情 {Math.round(w.active.mood)}
                      </span>
                      {epic ? (
                        <span className="tag tag-gold gacha-badge">✦ 顶尖</span>
                      ) : rare ? (
                        <span className="tag tag-pro gacha-badge">熟手</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn-primary" onClick={flipAll} disabled={flipped.every(Boolean)}>
              全部翻开
            </button>
            <button
              className="btn-primary"
              disabled={state.company.cash < ECONOMY.hireWorkerSignFee * gacha.drawn.length}
              onClick={() => {
                dispatch({
                  type: 'hireCandidates',
                  candidateIds: gacha.drawn.map((w) => w.id),
                })
                setGacha(null)
              }}
            >
              一键雇佣全部（{gacha.drawn.length} 人 ·{' '}
              {ECONOMY.hireWorkerSignFee * gacha.drawn.length} 万）
            </button>
            <button onClick={() => setGacha(null)}>完成</button>
          </div>
        </Modal>
      )}

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
              <button
                className="btn-primary"
                onClick={() => {
                  dispatch({ type: 'hireWorker', candidateId: selected.id })
                  setSelectedId(null)
                }}
              >
                雇佣
              </button>
            }
          />
        </Modal>
      )}
    </div>
  )
}
