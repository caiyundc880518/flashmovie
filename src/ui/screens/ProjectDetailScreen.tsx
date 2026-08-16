import { useState } from 'react'
import type {
  Channel,
  CriticReview,
  FilmProject,
  GameState,
  ProjectEvent,
  WorkerSettlement,
} from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { createRng } from '../../core/rng'
import { computeFilmResult, vfxTier, vfxTypeFactor } from '../../core/rules/scoring'
import { goldenCombos, teamChemistry } from '../../core/rules/chemistry'
import { audienceFit, regionMarkets } from '../../core/rules/audience'
import { ECONOMY } from '../../core/config/economy'
import { CHANNEL_INFO, CHANNEL_ORDER } from '../../core/config/channels'
import { ROLE_ZH, SKILL_ZH, STAGE_ZH, TYPE_ZH, fmtWan, signedDelta } from '../format'
import { PosterCard } from '../components/PosterCard'
import { Bar } from '../components/Bar'
import { MoneyText } from '../components/MoneyText'
import { Modal } from '../components/Modal'
import { DataTable, type Column } from '../components/DataTable'
import { TimingMinigame } from '../components/TimingMinigame'

/** 剪辑/宣发阶段的成片预测（用固定种子 rng 给出确定性估算） */
function estimate(state: GameState, p: FilmProject) {
  return computeFilmResult(state, p, createRng(0))
}

function EventBlock({
  ev,
  projectId,
  onResolve,
}: {
  ev: ProjectEvent
  projectId: string
  onResolve: (projectId: string, eventId: string, optionIndex: number) => void
}) {
  return (
    <div className="event-block">
      <div className="event-title">⚡ {ev.title}</div>
      <div className="event-desc">{ev.desc}</div>
      <div className="btn-row">
        {ev.options.map((o, i) => (
          <button key={i} onClick={() => onResolve(projectId, ev.id, i)}>
            {o.label}
            {o.cash ? `（${fmtWan(o.cash)})` : ''}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ProjectDetailScreen({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [budgetInput, setBudgetInput] = useState('100')
  const [pubSel, setPubSel] = useState('')
  const [shotGame, setShotGame] = useState(false)
  const [editGame, setEditGame] = useState(false)
  const [settlement, setSettlement] = useState<WorkerSettlement[] | null>(null)

  if (!state) return null
  const p = state.projects.find((x) => x.id === projectId)
  if (!p) return null
  const script = state.scripts[p.scriptId]

  const preview = p.stage === 'editing' || p.stage === 'marketing' ? estimate(state, p) : null

  return (
    <div className="screen">
      <div className="panel">
        <button className="btn-ghost" onClick={onBack}>
          ← 返回公司
        </button>
      </div>

      <div className="grid-2">
        <section className="panel">
          {script && (
            <PosterCard title={p.name} type={script.type}>
              <div className="attr-line">类型：{TYPE_ZH[script.type]} · 阶段：{STAGE_ZH[p.stage]}</div>
              <div className="attr-line">
                预算 <MoneyText value={p.budget} /> · 已花 <MoneyText value={p.spent} />
              </div>
              <div className="attr-line">VFX {p.vfxPercent}%{p.hasAd ? ' · 含植入广告' : ''}</div>
              {p.ipId && (() => {
                const ip = state.company.ips.find((x) => x.id === p.ipId)
                return ip ? (
                  <div className="attr-line">
                    系列续作：<span className="tag tag-gold">Lv.{ip.level}</span> 第 {p.ipEntry ?? '?'} 部 · 票房加成
                    +{Math.round((ip.sequelBonus - 1) * 100)}%
                  </div>
                ) : null
              })()}
              <div className="attr-line">
                特效等级：
                <b>{vfxTier(state.workers[p.team.technicianId ?? '']?.skills.vfx ?? 40).label}</b>
                {script && (
                  <span className="dim">（{TYPE_ZH[script.type]} ×{vfxTypeFactor(script.type)}）</span>
                )}
              </div>
              <div className="attr-line">Buff {p.buffs > 0 ? `+${p.buffs}` : p.buffs}</div>
              <Bar label="Hype" value={p.hype} color="var(--gold)" />
            </PosterCard>
          )}
        </section>

        <section className="panel">
          <h2>剧组</h2>
          {p.team.directorId && <TeamLine state={state} id={p.team.directorId} label="导演" />}
          {p.team.producerId && <TeamLine state={state} id={p.team.producerId} label="制片" />}
          {p.team.actorIds.map((id, i) => (
            <TeamLine key={id} state={state} id={id} label={`演员${i + 1}`} />
          ))}
          {p.team.shooterId && <TeamLine state={state} id={p.team.shooterId} label="摄影" />}
          {p.team.editorId && <TeamLine state={state} id={p.team.editorId} label="剪辑" />}
          {p.team.marketId && <TeamLine state={state} id={p.team.marketId} label="市场" />}
          <div className="chem-line">
            <span className="slot-label">团队化学</span>
            <Bar value={teamChemistry(state, p)} max={100} color="var(--gold)" showValue />
            {goldenCombos(state, p).map(([a, b]) => (
              <span key={`${a}-${b}`} className="tag tag-gold">
                ⭐ {state.workers[a]?.name} × {state.workers[b]?.name} 黄金组合
              </span>
            ))}
          </div>
        </section>
      </div>

      {p.stage === 'preparing' && (
        <section className="panel">
          <h2>筹备完成</h2>
          <p>剧组已就绪，可以开拍了。</p>
          <button className="btn-primary" onClick={() => dispatch({ type: 'startShooting', projectId })}>
            开拍 ▶（定金 {fmtWan(p.budget * 0.1)}）
          </button>
        </section>
      )}

      {p.stage === 'shooting' && (
        <section className="panel">
          <h2>拍摄中</h2>
          <Bar label={`拍摄进度 ${p.shotStages}/${p.totalStages} 场`} value={p.shotStages} max={p.totalStages} color="var(--ok)" />
          <div className="btn-row">
            <button className="btn-primary" onClick={() => setShotGame(true)}>
              🎬 拍摄运镜挑战（小游戏）
            </button>
          </div>
          <p className="dim">小游戏表现影响成片拍摄分与最终评分。</p>
          {p.pendingEvents.length > 0 && (
            <div className="event-list">
              {p.pendingEvents.map((ev) => (
                <EventBlock
                  key={ev.id}
                  ev={ev}
                  projectId={projectId}
                  onResolve={(pid, eid, idx) => dispatch({ type: 'resolveEvent', projectId: pid, eventId: eid, optionIndex: idx })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {p.stage === 'editing' && preview && (
        <section className="panel">
          <h2>剪辑与成片预览</h2>
          <div className="score-preview">
            <Bar label="故事" value={preview.scores.story} />
            <Bar label="音乐" value={preview.scores.music} />
            <Bar label="剪辑" value={preview.scores.edit} />
            <Bar label="表演" value={preview.scores.acting} />
            <Bar label="摄影" value={preview.scores.shooting} />
            <Bar label="导演" value={preview.scores.directing} />
            <Bar label="VFX" value={preview.vfx} max={15} />
            <Bar label="特色" value={preview.specific} max={10} />
          </div>
          <div className="attr-line">
            预测 AP <b>{preview.ap}</b> · MP <b>{preview.mp}</b>
          </div>
          <div className="btn-row">
            <button className="btn-primary" onClick={() => setEditGame(true)}>
              ✂ 剪辑节奏挑战（小游戏）
            </button>
          </div>
          <div className="btn-row">
            <button onClick={() => dispatch({ type: 'chooseEditStyle', projectId, style: 'market' })}>
              市场向剪辑（更卖座）
            </button>
            <button onClick={() => dispatch({ type: 'chooseEditStyle', projectId, style: 'art' })}>
              艺术向剪辑（冲奖）
            </button>
          </div>
        </section>
      )}

      {p.stage === 'marketing' && (
        <section className="panel">
          <h2>宣发与上映</h2>
          <div className="config-row">
            <label className="config-label">宣发预算</label>
            <input
              type="number"
              value={budgetInput}
              min={0}
              max={ECONOMY.marketingBudgetCap}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
            <button onClick={() => dispatch({ type: 'setMarketingBudget', projectId, budget: Number(budgetInput) || 0 })}>
              设定
            </button>
            <button onClick={() => dispatch({ type: 'launchMarketing', projectId })}>投放宣发</button>
          </div>
          {p.marketingBudget > 0 && <p className="dim">待投放预算 {fmtWan(p.marketingBudget)}</p>}

          <h3>主攻地区（集中宣发）</h3>
          <div className="slot-row">
            <span className="slot-label">重点市场</span>
            <select
              value={p.targetRegion ?? ''}
              onChange={(e) =>
                dispatch({ type: 'setTargetRegion', projectId, region: e.target.value || undefined })
              }
            >
              <option value="">全国通发（按全部观众契合）</option>
              {regionMarkets(state).map((r) => {
                const top = (Object.keys(r.focus) as (keyof typeof r.focus)[])
                  .map((t) => ({ t, v: r.focus[t] }))
                  .sort((a, b) => b.v - a.v)[0]
                return (
                  <option key={r.region} value={r.region}>
                    {r.region}（占 {Math.round(r.size * 100)}% · 偏好{TYPE_ZH[top.t]}）
                  </option>
                )
              })}
            </select>
          </div>
          {script && (
            <p className="dim">
              观众契合：全国 ×{audienceFit(state, script.type).toFixed(2)}
              {p.targetRegion && (
                <>
                  {' '}
                  → 主攻「{p.targetRegion}」×{audienceFit(state, script.type, p.targetRegion).toFixed(2)}
                </>
              )}
              {p.targetRegion && audienceFit(state, script.type, p.targetRegion) < audienceFit(state, script.type) && (
                <span className="warn">（当地不偏好此类型，收益下降）</span>
              )}
            </p>
          )}

          <h3>发行渠道（片方所得 = 票房 × 渠道比例）</h3>
          <div className="channel-row">
            {CHANNEL_ORDER.map((ch) => {
              const cur: Channel[] = p.channels.length > 0 ? p.channels : ['cinema']
              const on = cur.includes(ch)
              return (
                <label key={ch} className="config-label">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = on ? cur.filter((c) => c !== ch) : [...cur, ch]
                      dispatch({ type: 'setChannels', projectId, channels: next })
                    }}
                  />
                  {CHANNEL_INFO[ch].label}（{Math.round(CHANNEL_INFO[ch].factor * 100)}%）
                </label>
              )
            })}
          </div>

          <h3>发行方式</h3>
          {p.publisherId ? (
            <p className="dim">
              已与发行商签约，预付款已到账；后端分成将在上映结算时扣除。
            </p>
          ) : (
            <div className="slot-row">
              <span className="slot-label">发行商</span>
              <select value={pubSel} onChange={(e) => setPubSel(e.target.value)}>
                <option value="">自发行（拿全部份额）</option>
                {state.world.publishers.map((pb) => (
                  <option key={pb.id} value={pb.id}>
                    {pb.name}（预付款 {Math.round(pb.prepayBase + pb.reputation * pb.prepayPerRep)}万 · 后端分成{' '}
                    {Math.round(pb.shareRate * 100)}%）
                  </option>
                ))}
              </select>
              {pubSel && (
                <button
                  onClick={() =>
                    dispatch({ type: 'selectPublisher', projectId, publisherId: pubSel })
                  }
                >
                  签约
                </button>
              )}
            </div>
          )}

          <div className="btn-row">
            <button
              className="btn-primary"
              onClick={() => {
                if (!window.confirm(`确认上映《${p.name}》？`)) return
                dispatch({ type: 'release', projectId })
                // 上映后读取结算结果，弹出成员成长结算
                const latest = useGameStore.getState().state
                const r = latest?.projects.find((x) => x.id === projectId)?.result
                if (r?.settlement) setSettlement(r.settlement)
              }}
            >
              🎞 上映
            </button>
          </div>
        </section>
      )}

      {p.stage === 'released' && p.result && (
        <section className="panel">
          <h2>上映结算</h2>
          <div className="grid-2">
            <div className="score-preview">
              <Bar label="故事" value={p.result.scores.story} />
              <Bar label="音乐" value={p.result.scores.music} />
              <Bar label="剪辑" value={p.result.scores.edit} />
              <Bar label="表演" value={p.result.scores.acting} />
              <Bar label="摄影" value={p.result.scores.shooting} />
              <Bar label="导演" value={p.result.scores.directing} />
              <Bar label="VFX" value={p.result.vfx} max={15} />
              <Bar label="特色" value={p.result.specific} max={10} />
            </div>
            <div>
              <div className="stat-row">
                <span className="stat-label">AP（艺术分）</span>
                <b>{p.result.ap}</b>
                <span className="stat-label">MP（市场分）</span>
                <b>{p.result.mp}</b>
              </div>
              <div className="stat-row">
                <span className="stat-label">影评口碑</span>
                <b>{p.result.criticScore}</b>
                <span className="stat-label">声誉变化</span>
                <span className={p.result.reputationGain >= 0 ? 'good' : 'bad'}>
                  {p.result.reputationGain >= 0 ? '+' : ''}
                  {p.result.reputationGain}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">票房</span>
                <MoneyText value={p.result.boxOffice} />
              </div>
              <div className="stat-row">
                <span className="stat-label">发行渠道</span>
                <span>
                  {(p.result.channels ?? ['cinema']).map((c) => CHANNEL_INFO[c].label).join(' / ')}
                </span>
              </div>
              {p.result.publisherName && (
                <div className="stat-row">
                  <span className="stat-label">发行商</span>
                  <span>{p.result.publisherName}</span>
                </div>
              )}
              {p.result.targetRegion && (
                <div className="stat-row">
                  <span className="stat-label">主攻地区</span>
                  <span>{p.result.targetRegion}</span>
                </div>
              )}
              <div className="stat-row">
                <span className="stat-label">片方总收入</span>
                <MoneyText value={p.result.revenue ?? p.result.boxOffice * ECONOMY.cinemaShare} />
              </div>
              <h3>成员成长结算</h3>
              {p.result.settlement ? (
                <p className="dim">
                  每位成员的参与角色、表现评分与全部属性变化已入账，点击查看明细。
                </p>
              ) : null}
              {p.result.settlement ? (
                <button className="btn-primary" onClick={() => setSettlement(p.result!.settlement!)}>
                  📊 查看全员属性变化
                </button>
              ) : (
                <ul className="career-list">
                  {p.result.groupPerformance.map((g) => (
                    <li key={g.workerId}>
                      {state.workers[g.workerId]?.name ?? '未知'}（{ROLE_ZH[g.role]}） · 表现{' '}
                      {Math.round(g.performance)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 影评人区：剪辑/宣发显示预测，上映后显示真实评分 */}
      {p.stage !== 'preparing' && p.stage !== 'shooting' && (
        <section className="panel">
          <h2>影评人</h2>
          {p.stage === 'released' && p.result ? (
            <CriticReviews reviews={p.result.reviews} average={p.result.criticScore} title="上映后评分" />
          ) : preview ? (
            <CriticReviews reviews={preview.reviews} title="影评预测" />
          ) : null}
        </section>
      )}

      {settlement && (
        <Modal title="📊 上映结算 · 成员成长明细" xwide onClose={() => setSettlement(null)}>
          <p className="dim">
            结算已入账：经验、技能、CA、Fame 与心情的变化会在上映时立即生效，并写入个人履历。
          </p>
          <DataTable<WorkerSettlement>
            columns={settlementColumns(state)}
            rows={settlement}
            rowKey={(s) => s.workerId}
            emptyText="无成员结算数据"
          />
        </Modal>
      )}

      {shotGame && (
        <TimingMinigame
          title="🎬 拍摄运镜挑战"
          desc="标记循环移动，在金色亮带处点击「运镜」。共 3 轮，判定影响成片拍摄分。"
          actionLabel="运镜"
          onResult={(q) => dispatch({ type: 'applyShotBuff', projectId, quality: q })}
          onClose={() => setShotGame(false)}
        />
      )}
      {editGame && (
        <TimingMinigame
          title="✂ 剪辑节奏挑战"
          desc="在节奏点处点击「剪」，保留精彩镜头。共 3 轮，判定影响剪辑 Buff。"
          actionLabel="剪！"
          onResult={(q) => dispatch({ type: 'applyEditBuff', projectId, quality: q })}
          onClose={() => setEditGame(false)}
        />
      )}
    </div>
  )
}

/** 上映结算表列（依赖 state 取员工名） */
function settlementColumns(state: GameState): Column<WorkerSettlement>[] {
  const delta = (v: number) => (
    <span className={v >= 0 ? 'good' : 'bad'}>{signedDelta(v)}</span>
  )
  return [
    {
      key: 'name',
      label: '成员',
      render: (s) => <span className="table-name">{state.workers[s.workerId]?.name ?? '未知'}</span>,
    },
    { key: 'role', label: '参与角色', render: (s) => ROLE_ZH[s.role] },
    { key: 'perf', label: '表现', render: (s) => Math.round(s.performance) },
    { key: 'ca', label: 'CA', render: (s) => delta(s.caGain) },
    { key: 'exp', label: '经验', render: (s) => `+${Math.round(s.expGain)}` },
    { key: 'fame', label: 'Fame', render: (s) => delta(s.fameGain) },
    { key: 'mood', label: '心情', render: (s) => delta(s.moodGain) },
    {
      key: 'skills',
      label: '技能变化',
      render: (s) =>
        s.skillChanges.length === 0 ? (
          <span className="dim">—</span>
        ) : (
          <span className="settle-skills">
            {s.skillChanges.map((c, i) => (
              <span key={c.key}>
                {i > 0 ? '、' : ''}
                {SKILL_ZH[c.key]} <span className={c.delta >= 0 ? 'good' : 'bad'}>{signedDelta(c.delta)}</span>
              </span>
            ))}
          </span>
        ),
    },
  ]
}

function TeamLine({
  state,
  id,
  label,
}: {
  state: GameState
  id: string
  label: string
}) {
  const w = state.workers[id]
  if (!w) return null
  return (
    <div className="team-line">
      <span className="slot-label">{label}</span>
      <span>{w.name}</span>
      <span className="dim">
        CA {w.basic.ca} · 心情 {Math.round(w.active.mood)}
      </span>
    </div>
  )
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--ok)'
  if (score >= 60) return 'var(--gold)'
  return 'var(--danger)'
}

/** 影评人评分列表（含预测） */
function CriticReviews({
  reviews,
  title,
  average,
}: {
  reviews: CriticReview[] | undefined
  title: string
  average?: number
}) {
  if (!reviews || reviews.length === 0) return null
  return (
    <div className="critic-list">
      <h3>{title}</h3>
      {reviews.map((r) => (
        <div key={r.criticId} className="critic-row">
          <span className="critic-name">{r.criticName}</span>
          <Bar value={r.score} max={100} color={scoreColor(r.score)} showValue={false} />
          <span className="critic-score" style={{ color: scoreColor(r.score) }}>
            {r.score}
          </span>
        </div>
      ))}
      {average !== undefined && (
        <div className="critic-row critic-avg">
          <span className="critic-name">平均</span>
          <Bar value={average} max={100} color={scoreColor(average)} showValue={false} />
          <span className="critic-score" style={{ color: scoreColor(average) }}>
            {average}
          </span>
        </div>
      )}
    </div>
  )
}
