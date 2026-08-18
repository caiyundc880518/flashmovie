import { useState } from 'react'
import type { FilmProject, GameState, ProjectEvent, ProjectStage } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { createRng } from '../../core/rng'
import { computeFilmResult, channelRevenue } from '../../core/rules/scoring'
import { audienceFit, regionMarkets } from '../../core/rules/audience'
import { ECONOMY } from '../../core/config/economy'
import { CHANNEL_CONFIG, CHANNEL_INFO, CHANNEL_ORDER, TOTAL_CINEMAS, WEB_PLATFORMS } from '../../core/config/channels'
import { STAGE_ZH, TYPE_ZH, fmtWan } from '../format'
import { Bar } from '../components/Bar'
import { Modal } from '../components/Modal'
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

/**
 * 制作中的项目详情页（筹备→拍摄→剪辑→宣发）。
 * 已上映的项目请走独立的 ReleasedProjectScreen（电影档案详情页）。
 */
export function ProjectDetailScreen({
  projectId,
  onBack,
  onReleased,
}: {
  projectId: string
  onBack: () => void
  /** 上映成功后回调（result 已写入），由外层承载口碑揭晓弹窗 */
  onReleased?: (projectId: string, result: NonNullable<FilmProject['result']>) => void
}) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [warmupInput, setWarmupInput] = useState('')
  const [shotGame, setShotGame] = useState(false)
  const [editGame, setEditGame] = useState(false)
  // 取消未上映项目的二次确认弹窗
  const [cancelOpen, setCancelOpen] = useState(false)
  // 定档：提前上映周数（0 = 本周立即上映）
  const [releaseWeeks, setReleaseWeeks] = useState(0)

  if (!state) return null
  const p = state.projects.find((x) => x.id === projectId)
  if (!p) return null
  // 已上映项目由 ReleasedProjectScreen 承载
  if (p.stage === 'released') return null
  const script = state.scripts[p.scriptId]

  const preview = p.stage === 'editing' || p.stage === 'marketing' ? estimate(state, p) : null

  // 项目流程步骤条：①筹备 → ②拍摄 → ③剪辑 → ④宣发 → ⑤上映完成
  const FLOW_STEPS: Array<{ key: ProjectStage; label: string }> = [
    { key: 'preparing', label: '① 筹备' },
    { key: 'shooting', label: '② 拍摄' },
    { key: 'editing', label: '③ 剪辑' },
    { key: 'marketing', label: '④ 宣发' },
    { key: 'released', label: '⑤ 上映完成' },
  ]
  const stageIndex = FLOW_STEPS.findIndex((s) => s.key === p.stage)

  return (
    <div className="screen">
      <button className="back-mini" onClick={onBack} title="返回上一页">
        ← 返回
      </button>

      {/* 多步骤流程条：走到上映完成（阶段 5）后详情页正式生成 */}
      <div className="flow-steps">
        {FLOW_STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`flow-step${i === stageIndex ? ' flow-step-current' : ''}${i < stageIndex ? ' flow-step-done' : ''}`}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="flow-stage-body">
        {p.stage === 'preparing' && (
          <section className="panel">
            <h2>① 筹备期</h2>
            <p className="dim">
              剧组已就绪。可投入<b>预热成本</b>为影片造势：投入越多，上映结算 MP 加成越多（每{' '}
              {ECONOMY.warmupPerMp} 万 +1 MP，无上限）。
            </p>
            <div className="config-row">
              <label className="config-label">预热投入（万）</label>
              <input
                type="number"
                value={warmupInput}
                min={0}
                onChange={(e) => setWarmupInput(e.target.value)}
              />
              <button
                onClick={() => {
                  const amount = Number(warmupInput) || 0
                  if (amount <= 0) return
                  dispatch({ type: 'setWarmup', projectId, amount })
                  setWarmupInput('')
                }}
              >
                投入
              </button>
            </div>
            {p.warmup > 0 && (
              <p className="dim">
                已投入 <b style={{ color: 'var(--gold)' }}>{fmtWan(p.warmup)}</b>，当前 MP 加成
                <b style={{ color: 'var(--gold)' }}> +{Math.floor(p.warmup / ECONOMY.warmupPerMp)}</b>
              </p>
            )}
            <div className="btn-row">
              <button className="btn-primary" onClick={() => dispatch({ type: 'startShooting', projectId })}>
                开拍 ▶（定金 {fmtWan(p.budget * 0.1)}）
              </button>
            </div>
          </section>
        )}
        {p.stage === 'shooting' && (
          <section className="panel">
            <h2>② 拍摄中</h2>
            <Bar
              label={`拍摄进度 ${p.shotStages}/${p.totalStages} 场`}
              value={p.shotStages}
              max={p.totalStages}
              color="var(--ok)"
            />
            <p className="dim">
              某些场次会触发<b>运镜挑战小游戏</b>（被动触发，必须完成才能继续推进）：三次全完美大幅提升
              AP/MP，全部失误无加成。
            </p>
            {p.pendingShotGame && (
              <p className="msg">🎬 本场需要完成运镜挑战——点击「推进一周」开始小游戏。</p>
            )}
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
            <h2>③ 剪辑与成片预览</h2>
            <p className="dim">
              剪辑必须完成<b>节奏挑战小游戏</b>才能继续推进：三次全完美大幅提升 AP/MP，全部失误无加成。
            </p>
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
            {!p.editGameDone ? (
              <p className="msg">✂ 点击「推进一周」完成剪辑小游戏后，才能选择剪辑取向。</p>
            ) : (
              <div className="btn-row">
                <button onClick={() => dispatch({ type: 'chooseEditStyle', projectId, style: 'market' })}>
                  市场向剪辑（更卖座）
                </button>
                <button onClick={() => dispatch({ type: 'chooseEditStyle', projectId, style: 'art' })}>
                  艺术向剪辑（冲奖）
                </button>
              </div>
            )}
          </section>
        )}
        {p.stage === 'marketing' && (
          <section className="panel">
            <h2>④ 宣发与上映</h2>
            <h3>发行渠道（单选一种）</h3>
            <div className="channel-row">
              {CHANNEL_ORDER.map((ch) => (
                <label key={ch} className="config-label">
                  <input
                    type="radio"
                    name="channel"
                    checked={p.channel === ch}
                    onChange={() => dispatch({ type: 'setChannel', projectId, channel: ch })}
                  />
                  {CHANNEL_INFO[ch].label}
                </label>
              ))}
            </div>
            <p className="dim">{p.channel ? CHANNEL_INFO[p.channel].desc : '请选择一种发行渠道。'}</p>
            {p.channel === 'cinema' && (
              <div className="config-row">
                <label className="config-label">
                  投放影院数（共 {TOTAL_CINEMAS} 家，单价 {CHANNEL_CONFIG.cinemaCostPerUnit} 万/家）
                </label>
                <input
                  type="number"
                  value={p.cinemaCount || ''}
                  min={0}
                  max={TOTAL_CINEMAS}
                  placeholder="50"
                  onChange={(e) => dispatch({ type: 'setCinemaCount', projectId, count: Number(e.target.value) || 0 })}
                />
              </div>
            )}
            {p.channel === 'web' && (
              <>
                <div className="channel-row">
                  {WEB_PLATFORMS.map((pl) => {
                    const on = p.webPlatforms.includes(pl)
                    return (
                      <label key={pl} className="config-label">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const next = on ? p.webPlatforms.filter((x) => x !== pl) : [...p.webPlatforms, pl]
                            dispatch({ type: 'setWebConfig', projectId, platforms: next, weeks: p.webWeeks || 4 })
                          }}
                        />
                        {pl}
                      </label>
                    )
                  })}
                </div>
                <div className="config-row">
                  <label className="config-label">投放时长（周）</label>
                  <input
                    type="number"
                    value={p.webWeeks || 4}
                    min={1}
                    max={52}
                    onChange={(e) =>
                      dispatch({ type: 'setWebConfig', projectId, platforms: p.webPlatforms, weeks: Number(e.target.value) || 4 })
                    }
                  />
                </div>
              </>
            )}
            {p.channel === 'dvd' && (
              <div className="config-row">
                <label className="config-label">DVD 单价（元/张）</label>
                <input
                  type="number"
                  value={p.dvdPrice || ''}
                  min={1}
                  max={CHANNEL_CONFIG.dvdPriceRange[1]}
                  placeholder="20"
                  onChange={(e) => dispatch({ type: 'setDvdPrice', projectId, price: Number(e.target.value) || 0 })}
                />
              </div>
            )}
            {p.channel === 'free' && (
              <div className="config-row">
                <label className="config-label">广告单价（元/千次播放）</label>
                <input
                  type="number"
                  value={p.freeAdPrice || ''}
                  min={1}
                  max={CHANNEL_CONFIG.freeAdPriceRange[1]}
                  placeholder="30"
                  onChange={(e) => dispatch({ type: 'setFreeAdPrice', projectId, price: Number(e.target.value) || 0 })}
                />
              </div>
            )}
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
            {/* 预计渠道结算：实时反映渠道选择对票房的影响 */}
            {preview && p.channel && (() => {
              const est = channelRevenue(p, preview.boxOffice)
              return (
                <div className="channel-effect channel-preview">
                  <h3>预计渠道结算</h3>
                  <p>
                    预计票房 <b style={{ color: 'var(--gold)' }}>{fmtWan(est.boxOffice)}</b> · 片方分账{' '}
                    <b>{fmtWan(est.revenue)}</b> · 投放成本 <b>{fmtWan(est.channelCost)}</b>
                    {est.admissions !== undefined && (
                      <>
                        {' '}
                        · 观影人次 <b>{fmtWan(est.admissions)}人次</b>
                      </>
                    )}
                    {est.dvdUnits !== undefined && (
                      <>
                        {' '}
                        · 卖出 <b>{fmtWan(est.dvdUnits)}张</b>
                      </>
                    )}
                    {est.freeViews !== undefined && (
                      <>
                        {' '}
                        · 播放量 <b>{fmtWan(est.freeViews)}次</b>
                      </>
                    )}
                  </p>
                  <p className="dim">
                    影院权重最高（影院数越多票房放大越大）＞ 网络（时长驱动）＞ DVD ＞ 免费。
                  </p>
                </div>
              )
            })()}
            <div className="slot-row">
              <span className="slot-label">定档：提前上映周数</span>
              <select value={releaseWeeks} onChange={(e) => setReleaseWeeks(Number(e.target.value))}>
                <option value={0}>本周立即上映</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    提前 {n} 周（攒预售）
                  </option>
                ))}
              </select>
            </div>
            <p className="dim">
              提前定档可在等待期按热度累积预售，加成首周票房；等待越久预售越多，但热度会随时间衰减——
              是"尽早开映"与"攒足预售"之间的取舍。
            </p>
            <div className="btn-row">
              <button
                className="btn-primary"
                disabled={!p.channel}
                onClick={() => {
                  if (!window.confirm(`确认《${p.name}》${releaseWeeks > 0 ? `提前 ${releaseWeeks} 周` : '本周'}定档上映？`)) return
                  dispatch({ type: 'release', projectId, weeks: releaseWeeks })
                  const latest = useGameStore.getState().state
                  const r = latest?.projects.find((x) => x.id === projectId)?.result
                  if (r) onReleased?.(projectId, r)
                }}
              >
                🎞 定档上映
              </button>
            </div>
          </section>
        )}
        <div className="flow-cancel">
          <button className="btn-danger" onClick={() => setCancelOpen(true)}>
            🗑 取消项目
          </button>
        </div>
      </div>

      {cancelOpen && (
        <Modal title={`🗑 取消《${p.name}》`} onClose={() => setCancelOpen(false)}>
          <p className="dim">
            当前处于「{STAGE_ZH[p.stage]}」阶段。取消后项目将被移除，<b>无法恢复</b>。
          </p>
          <p className="warn">
            已投入 <b style={{ color: 'var(--danger)' }}>{fmtWan(p.spent)}</b>
            （含定金、拍摄成本与预热）<b>不退还</b>。
          </p>
          <p className="dim">
            剧组人员将释放回员工池，可重新组建剧组；所属 IP 系列不受影响。
          </p>
          <div className="btn-row">
            <button
              className="btn-danger"
              onClick={() => {
                dispatch({ type: 'cancelProject', projectId })
                setCancelOpen(false)
                onBack()
              }}
            >
              确认取消
            </button>
            <button onClick={() => setCancelOpen(false)}>再想想</button>
          </div>
        </Modal>
      )}

      {shotGame && (
        <TimingMinigame
          title="🎬 拍摄运镜挑战"
          desc="标记循环移动，在金色亮带处点击「运镜」。共 3 轮，判定影响成片 AP/MP。"
          actionLabel="运镜"
          onResult={() => {}}
          onFinish={(qs) => dispatch({ type: 'applyShotGame', projectId, qualities: qs })}
          onClose={() => setShotGame(false)}
        />
      )}
      {editGame && (
        <TimingMinigame
          title="✂ 剪辑节奏挑战"
          desc="在节奏点处点击「剪」，保留精彩镜头。共 3 轮，判定影响成片 AP/MP。"
          actionLabel="剪！"
          onResult={() => {}}
          onFinish={(qs) => dispatch({ type: 'applyEditGame', projectId, qualities: qs })}
          onClose={() => setEditGame(false)}
        />
      )}
    </div>
  )
}
