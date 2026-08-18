import { useState } from 'react'
import type {
  CriticReview,
  FilmProject,
  GameState,
  ProjectEvent,
  ProjectStage,
  WorkerSettlement,
} from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { createRng } from '../../core/rng'
import { computeFilmResult, vfxTierAt, vfxTypeFactor, channelRevenue } from '../../core/rules/scoring'
import { goldenCombos, teamChemistry } from '../../core/rules/chemistry'
import { audienceFit, regionMarkets } from '../../core/rules/audience'
import { ECONOMY } from '../../core/config/economy'
import { CHANNEL_CONFIG, CHANNEL_INFO, CHANNEL_ORDER, TOTAL_CINEMAS, WEB_PLATFORMS } from '../../core/config/channels'
import { ROLE_ZH, SKILL_ZH, STAGE_ZH, TYPE_ZH, fmtScore10, fmtWan, scoreColor10, signedDelta } from '../format'
import { PosterCard } from '../components/PosterCard'
import { Bar } from '../components/Bar'
import { MoneyText } from '../components/MoneyText'
import { Modal } from '../components/Modal'
import { DataTable, type Column } from '../components/DataTable'
import { TimingMinigame } from '../components/TimingMinigame'
import { Tabs } from '../components/Tabs'
import { ReviewFlipModal } from '../components/ReviewFlipModal'

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
  const [warmupInput, setWarmupInput] = useState('')
  const [shotGame, setShotGame] = useState(false)
  const [editGame, setEditGame] = useState(false)
  const [settlement, setSettlement] = useState<WorkerSettlement[] | null>(null)
  // 取消未上映项目的二次确认弹窗
  const [cancelOpen, setCancelOpen] = useState(false)
  // 上映后的影评/观众口碑翻牌弹窗
  const [flipReview, setFlipReview] = useState<{
    projectName: string
    reviews: CriticReview[]
    audience?: { score: number; text?: string }
  } | null>(null)

  if (!state) return null
  const p = state.projects.find((x) => x.id === projectId)
  if (!p) return null
  const script = state.scripts[p.scriptId]

  const preview = p.stage === 'editing' || p.stage === 'marketing' ? estimate(state, p) : null

  // 基本信息 TAB：海报信息 + 剧组 + 各阶段操作（开拍/拍摄/剪辑/宣发）
  const infoTab = (
    <>
      <div className="grid-2">
        <section className="panel">
          {script && (
            <PosterCard title={p.name} type={script.type}>
              <div className="attr-line">类型：{TYPE_ZH[script.type]} · 阶段：{STAGE_ZH[p.stage]}</div>
              <div className="attr-line">
                预算 <MoneyText value={p.budget} /> · 已花 <MoneyText value={p.spent} />
              </div>
              <div className="attr-line">
                预算侧重：剧情 {p.budgetAlloc?.story ?? 0}% · VFX {p.budgetAlloc?.vfx ?? 0}% · 表演{' '}
                {p.budgetAlloc?.acting ?? 0}% · 剪辑 {p.budgetAlloc?.edit ?? 0}%
                {(p.adSponsorIds?.length ?? 0) > 0 ? ` · 含 ${p.adSponsorIds.length} 家植入广告` : ''}
              </div>
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
                <b>{vfxTierAt(state.workers[p.team.technicianId ?? '']?.skills.vfx ?? 40, p.vfxLevel ?? 0).label}</b>
                {script && (
                  <span className="dim">（{TYPE_ZH[script.type]} ×{vfxTypeFactor(script.type).toFixed(2)}）</span>
                )}
              </div>
              <Bar label="热度" value={p.hype} color="var(--gold)" />
              {script?.desc && <p className="plot-desc">{script.desc}</p>}
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
    </>
  )

  // 上映结算 TAB：released 后的完整结算
  const settleTab = p.stage === 'released' && p.result ? (
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
            <b>{fmtScore10(p.result.criticScore)} / 10</b>
            <span className="stat-label">观众口碑</span>
            <b>{fmtScore10(p.result.audienceScore ?? 0)} / 10</b>
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
          {/* 渠道效果明细：影院/网络/DVD/免费 */}
          {p.result.channel && (
            <div className="channel-effect">
              <h3>宣发渠道效果</h3>
              {p.result.channel === 'cinema' && (
                <p>
                  投放影院 <b>{p.cinemaCount || CHANNEL_CONFIG.cinemaDefaultCount} 家</b>
                  （全国共 {TOTAL_CINEMAS} 家） · 观影人次
                  <b style={{ color: 'var(--gold)' }}>{fmtWan(p.result.admissions ?? 0)}人次</b>
                </p>
              )}
              {p.result.channel === 'web' && (
                <p>
                  上架平台{' '}
                  <b>{p.webPlatforms.length > 0 ? p.webPlatforms.join('、') : '—'}</b> · 投放时长
                  <b style={{ color: 'var(--gold)' }}>{p.webWeeks || CHANNEL_CONFIG.webDefaultWeeks} 周</b>
                </p>
              )}
              {p.result.channel === 'dvd' && (
                <p>
                  单价 <b>{p.dvdPrice || CHANNEL_CONFIG.dvdRefPrice} 元/张</b> · 卖出
                  <b style={{ color: 'var(--gold)' }}>{fmtWan(p.result.dvdUnits ?? 0)}张</b>
                </p>
              )}
              {p.result.channel === 'free' && (
                <p>
                  广告单价 <b>{p.freeAdPrice || 30} 元/千次</b> · 播放量
                  <b style={{ color: 'var(--gold)' }}>{fmtWan(p.result.freeViews ?? 0)}次</b> · 广告收入
                  <b style={{ color: 'var(--gold)' }}>{fmtWan(p.result.revenue ?? 0)}</b>
                </p>
              )}
            </div>
          )}
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
          {p.result.adSettlement && p.result.adSettlement.length > 0 && (
            <div className="stat-row">
              <span className="stat-label">植入广告</span>
              <span>
                {p.result.adSettlement.map((a) => (
                  <span key={a.id} className={a.met ? 'ok' : 'warn'}>
                    {a.name} {a.met ? `+${fmtWan(a.fee)}` : '未达标'}
                    {'　'}
                  </span>
                ))}
                {p.result.adIncome ? (
                  <b style={{ color: 'var(--gold)' }}>共到账 {fmtWan(p.result.adIncome)}</b>
                ) : (
                  <span className="warn">全部未到账</span>
                )}
              </span>
            </div>
          )}
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
  ) : (
    <section className="panel">
      <p className="dim empty-hint">影片上映后才能查看结算数据。</p>
    </section>
  )

  // 影评 TAB：剪辑/宣发显示预测，上映后显示真实评分
  const reviewsTab = (
    <section className="panel">
      <h2>影评人</h2>
      {p.stage === 'released' && p.result ? (
        <CriticReviews
          reviews={p.result.reviews}
          average={p.result.criticScore}
          title="上映后评分"
          audience={{ score: p.result.audienceScore ?? 0, text: p.result.audienceText }}
        />
      ) : preview ? (
        <CriticReviews reviews={preview.reviews} title="影评预测" />
      ) : (
        <p className="dim empty-hint">进入剪辑阶段后即可预览影评预测。</p>
      )}
    </section>
  )

  // 获奖 TAB：该片获得的所有奖项 + 参与者获得的奖项（TMA 各届累计）
  const awardsTab = (
    <section className="panel">
      <h2>获奖记录</h2>
      <p className="dim">TMA 颁奖典礼的获奖记录：本片获得的奖项，以及本片所有参与者获得的奖项（跨届累计）。</p>
      {p.stage === 'released' && p.result ? (
        p.result.awards && p.result.awards.length > 0 ? (
          <div className="award-list">
            {p.result.awards.map((a, i) => (
              <div key={i} className="award-item">
                <span className="award-icon">🏆</span>
                <span className="award-cat">{a.category}</span>
                {a.workerName && <span className="award-winner">· {a.workerName}</span>}
                <span className="dim">（{a.year} 年 TMA）</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dim empty-hint">这部影片尚未获得任何奖项。</p>
        )
      ) : (
        <p className="dim empty-hint">影片上映并参加 TMA 颁奖后才能查看获奖记录。</p>
      )}
    </section>
  )

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

      {p.stage === 'released' ? (
        <Tabs
          tabs={[
            { key: 'info', label: '基本信息', content: infoTab },
            { key: 'settle', label: '上映结算', content: settleTab },
            { key: 'reviews', label: '影评', content: reviewsTab },
            { key: 'awards', label: '获奖', content: awardsTab },
          ]}
        />
      ) : (
        // 上映完成前：流程聚焦当前阶段操作（详情页正式内容在上映后生成）
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
              <div className="btn-row">
                <button
                  className="btn-primary"
                  disabled={!p.channel}
                  onClick={() => {
                    if (!window.confirm(`确认上映《${p.name}》？`)) return
                    dispatch({ type: 'release', projectId })
                    const latest = useGameStore.getState().state
                    const r = latest?.projects.find((x) => x.id === projectId)?.result
                    if (r) {
                      setFlipReview({
                        projectName: r.name,
                        reviews: r.reviews,
                        audience: r.audienceScore !== undefined
                          ? { score: r.audienceScore, text: r.audienceText }
                          : undefined,
                      })
                    }
                  }}
                >
                  🎞 上映
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
      )}

      {flipReview && (
        <ReviewFlipModal
          projectName={flipReview.projectName}
          reviews={flipReview.reviews}
          audience={flipReview.audience}
          onClose={() => {
            setFlipReview(null)
            // 翻牌弹窗关闭后，若本次上映有成员成长结算则弹出
            const r = useGameStore.getState().state?.projects.find((x) => x.id === projectId)?.result
            if (r?.settlement) setSettlement(r.settlement)
          }}
        />
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

/** 影评人评分卡片（10 分制 + 文字评语）；旧档 0–100 自动换算 */
function CriticReviews({
  reviews,
  title,
  average,
  audience,
}: {
  reviews: CriticReview[] | undefined
  title: string
  average?: number
  audience?: { score: number; text?: string }
}) {
  if (!reviews || reviews.length === 0) return null
  return (
    <div className="critic-cards">
      <h3>{title}</h3>
      <div className="critic-grid">
        {reviews.map((r) => (
          <div key={r.criticId} className="critic-card">
            <div className="critic-card-head">
              <span className="table-name">{r.criticName}</span>
              <span className="critic-score" style={{ color: scoreColor10(r.score) }}>
                {fmtScore10(r.score)}
              </span>
            </div>
            <Bar
              value={r.score > 10 ? r.score / 10 : r.score}
              max={10}
              color={scoreColor10(r.score)}
              showValue={false}
            />
            <p className="critic-quote">「{r.text ?? '—'}」</p>
          </div>
        ))}
      </div>
      <div className="critic-summary">
        {average !== undefined && (
          <span>
            影评人平均 <b style={{ color: scoreColor10(average) }}>{fmtScore10(average)}</b> / 10
          </span>
        )}
        {audience && (
          <span>
            观众口碑 <b style={{ color: scoreColor10(audience.score) }}>{fmtScore10(audience.score)}</b> / 10
            <span className="critic-quote">「{audience.text ?? '—'}」</span>
          </span>
        )}
      </div>
    </div>
  )
}
