import { useState } from 'react'
import type { Worker } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { ROLE_ZH } from '../format'
import { RECRUIT_POOLS, type RecruitPoolConfig } from '../../core/config/recruit'
import { DataTable, type Column } from '../components/DataTable'
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

  /** 花钱刷新：dispatch 后立即读取最新候选人，进入抽卡弹窗 */
  const refresh = (pool: RecruitPoolConfig) => {
    if (state.company.cash < pool.cost) return
    dispatch({ type: 'refreshCandidates', pool: pool.id })
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

  const columns: Column<Worker>[] = [
    { key: 'name', label: '姓名', render: (w) => <span className="table-name">{w.name}</span> },
    { key: 'role', label: '职位', render: (w) => ROLE_ZH[w.role] },
    {
      key: 'tier',
      label: '类型',
      render: (w) =>
        w.basic.ca < 50 ? (
          <span className="tag tag-rookie">潜力新人</span>
        ) : (
          <span className="tag tag-pro">经验丰富</span>
        ),
    },
    { key: 'gender', label: '性别', render: (w) => (w.gender === 'male' ? '男' : '女') },
    { key: 'age', label: '年龄', render: (w) => w.age },
    { key: 'pa', label: 'PA', render: (w) => w.basic.pa },
    { key: 'ca', label: 'CA', render: (w) => <span className="ca-cell">{w.basic.ca}</span> },
    { key: 'fame', label: 'Fame', render: (w) => Math.round(w.basic.fame) },
    { key: 'salary', label: '周薪', render: (w) => <MoneyText value={w.salary} /> },
    {
      key: 'act',
      label: '',
      className: 'td-act',
      render: (w) => (
        <button
          className="btn-primary"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'hireWorker', candidateId: w.id })
          }}
        >
          雇佣
        </button>
      ),
    },
  ]

  return (
    <div className="screen">
      <section className="panel">
        <h2>刷新招聘市场（抽卡）</h2>
        <p className="dim">
          花现金立刻刷新候选人名单，新候选人直接进入下方表格。档位决定人数与人才质量——流水市场量大便宜但多生手，专业学院名额少但底子扎实。
        </p>
        <div className="gacha-options">
          {RECRUIT_POOLS.map((pool) => {
            const affordable = state.company.cash >= pool.cost
            return (
              <div key={pool.id} className={`gacha-option gacha-theme-${pool.id}`}>
                <div className="gacha-option-head">
                  <span className="slot-title">{pool.label}</span>
                  <span className="tag tag-required">{pool.cost} 万/次</span>
                </div>
                <p className="dim">{pool.desc}</p>
                <div className="attr-line">
                  人数 {pool.count[0]}–{pool.count[1]} 人
                </div>
                <div className="attr-line">
                  高 CA 概率 {Math.round(pool.highCaChance * 100)}% · 高 PA 概率{' '}
                  {Math.round(pool.highPaChance * 100)}%
                </div>
                <button className="btn-primary" disabled={!affordable} onClick={() => refresh(pool)}>
                  {affordable ? `🎴 刷新（${pool.cost} 万）` : '现金不足'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h2>招聘市场（{candidates.length}）</h2>
        <p className="dim">
          点击行查看详情；雇佣需支付签约费，之后按周支付薪水。潜力新人便宜但成长空间大。
        </p>
        <DataTable
          columns={columns}
          rows={candidates}
          rowKey={(w) => w.id}
          onRowClick={(w) => setSelectedId(w.id)}
          emptyText="暂无候选人，花钱刷新或等待市场刷新。"
        />
      </section>

      {/* 抽卡弹窗：卡背 → 逐张翻开 */}
      {gacha && (
        <Modal title={`🎴 ${gacha.pool.label} · 刷新结果`} wide onClose={() => setGacha(null)}>
          <p className="dim">
            {gacha.pool.desc}——点击卡片逐张翻开，翻完后可在下方表格雇佣。
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
