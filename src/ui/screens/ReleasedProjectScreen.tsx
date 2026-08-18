import { useState } from 'react'
import type { Channel, CriticReview, FilmRun, GameState, WorkerSettlement } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { vfxTierAt, vfxTypeFactor } from '../../core/rules/scoring'
import { lowerChannelsOf } from '../../core/tick/distribution'
import { ECONOMY } from '../../core/config/economy'
import { CHANNEL_CONFIG, CHANNEL_INFO, TOTAL_CINEMAS } from '../../core/config/channels'
import { ROLE_ZH, SKILL_ZH, TYPE_ZH, fmtScore10, fmtWan, scoreColor10, signedDelta } from '../format'
import { PosterCard } from '../components/PosterCard'
import { Bar } from '../components/Bar'
import { MoneyText } from '../components/MoneyText'
import { Modal } from '../components/Modal'
import { DataTable, type Column } from '../components/DataTable'
import { Tabs } from '../components/Tabs'
import { LineChart } from '../components/LineChart'

/**
 * 已上映电影独立详情页（4-TAB）：
 * TAB1 电影信息（基础信息/上映档案/成片评分/剧组）
 * TAB2 电影上映（上映状态 + 上映结算卡(档案第一行/结算第二行) + 长尾收益曲线，按首轮/再发行子 TAB）
 * TAB3 影评与观众口碑 · TAB4 获奖记录
 */
export function ReleasedProjectScreen({
  projectId,
  onBack,
}: {
  projectId: string
  onBack: () => void
}) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [settlement, setSettlement] = useState<WorkerSettlement[] | null>(null)
  const [rereleaseCh, setRereleaseCh] = useState<Channel | ''>('')

  if (!state) return null
  const p = state.projects.find((x) => x.id === projectId)
  if (!p || p.stage !== 'released') return null
  const r = p.result
  if (!r) return null
  const script = state.scripts[p.scriptId]
  const ip = p.ipId ? state.company.ips.find((x) => x.id === p.ipId) : undefined
  const ch = r.channel ?? r.channels?.[0]
  const channelLabel = ch ? CHANNEL_INFO[ch].label : null
  const rs = p.run
  const curRun = rs?.runs.find((x) => x.id === rs.currentRunId)
  const lastRun = rs ? rs.runs[rs.runs.length - 1] : undefined
  const lowerCh = lastRun ? lowerChannelsOf(lastRun.channel) : []

  /** 上映档案：五大数字 + 发行信息（TAB1 与 TAB2 结算卡第一行复用） */
  const archiveStats = (
    <>
      <div className="film-stats">
        <div className="film-stat">
          <b className="money">{fmtWan(r.boxOffice)}</b>
          <span>总票房</span>
        </div>
        <div className="film-stat">
          <b className="money">{fmtWan(r.revenue ?? r.boxOffice * ECONOMY.cinemaShare)}</b>
          <span>片方分账</span>
        </div>
        <div className="film-stat">
          <b style={{ color: scoreColor10(r.criticScore) }}>{fmtScore10(r.criticScore)}</b>
          <span>影评均分</span>
        </div>
        <div className="film-stat">
          <b style={{ color: scoreColor10(r.audienceScore ?? 0) }}>{fmtScore10(r.audienceScore ?? 0)}</b>
          <span>观众口碑</span>
        </div>
        <div className="film-stat">
          <b className={r.awardCount ? 'money' : undefined}>{r.awardCount ?? 0}</b>
          <span>🏆 获奖</span>
        </div>
      </div>
      <div className="film-hero-meta">
        <div className="stat-row">
          <span className="stat-label">发行渠道</span>
          <span>{channelLabel ?? '—'}</span>
        </div>
        {r.publisherName && (
          <div className="stat-row">
            <span className="stat-label">发行商</span>
            <span>{r.publisherName}</span>
          </div>
        )}
        {r.targetRegion && (
          <div className="stat-row">
            <span className="stat-label">主攻地区</span>
            <span>{r.targetRegion}</span>
          </div>
        )}
        <div className="stat-row">
          <span className="stat-label">声誉变化</span>
          <span className={r.reputationGain >= 0 ? 'good' : 'bad'}>
            {r.reputationGain >= 0 ? '+' : ''}
            {r.reputationGain}
          </span>
        </div>
      </div>
    </>
  )

  /** TAB1 电影信息：电影详情卡片（拉满一整行）+ 成片评分 + 剧组 */
  const infoTab = (
    <>
      {script && (
        <PosterCard
          title={p.name}
          type={script.type}
          corner={<span className="stage-badge">已上映</span>}
          typeInFooter
          titleBadge={ip ? <span className="ip-badge">IP</span> : undefined}
        >
          <div className="attr-line">
            类型：{TYPE_ZH[script.type]} · 上映于 第{r.year}年 第{r.week}周
          </div>
          <div className="attr-line">
            预算 <MoneyText value={p.budget} /> · 总投入 <MoneyText value={p.spent} />
          </div>
          <div className="attr-line">
            预算侧重：剧情 {p.budgetAlloc?.story ?? 0}% · VFX {p.budgetAlloc?.vfx ?? 0}% · 表演{' '}
            {p.budgetAlloc?.acting ?? 0}% · 剪辑 {p.budgetAlloc?.edit ?? 0}%
            {(p.adSponsorIds?.length ?? 0) > 0 ? ` · 含 ${p.adSponsorIds.length} 家植入广告` : ''}
          </div>
          {ip && (
            <div className="attr-line">
              系列续作：<span className="tag tag-gold">Lv.{ip.level}</span> 第 {p.ipEntry ?? '?'} 部 · 票房加成
              +{Math.round((ip.sequelBonus - 1) * 100)}%
            </div>
          )}
          <div className="attr-line">
            特效等级：
            <b>
              {vfxTierAt(state.workers[p.team.technicianId ?? '']?.skills.vfx ?? 40, p.vfxLevel ?? 0).label}
            </b>
            {script && (
              <span className="dim">（{TYPE_ZH[script.type]} ×{vfxTypeFactor(script.type).toFixed(2)}）</span>
            )}
          </div>
          <Bar label="热度" value={p.hype} color="var(--gold)" />
          {script?.desc && <p className="plot-desc">{script.desc}</p>}
        </PosterCard>
      )}

      <section className="panel">
        <h2>成片评分</h2>
        <div className="grid-2">
          <div className="score-preview">
            <Bar label="故事" value={r.scores.story} />
            <Bar label="音乐" value={r.scores.music} />
            <Bar label="剪辑" value={r.scores.edit} />
            <Bar label="表演" value={r.scores.acting} />
          </div>
          <div className="score-preview">
            <Bar label="摄影" value={r.scores.shooting} />
            <Bar label="导演" value={r.scores.directing} />
            <Bar label="VFX" value={r.vfx} max={15} />
            <Bar label="特色" value={r.specific} max={10} />
          </div>
        </div>
        <div className="attr-line" style={{ marginTop: 10 }}>
          综合 AP <b className="ca-cell">{r.ap}</b> · MP <b className="ca-cell">{r.mp}</b>
        </div>
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
      </section>
    </>
  )

  /** TAB2 电影上映：上映状态 + 上映结算卡 + 长尾收益曲线 */
  const releaseTab = (
    <>
      {/* 上映状态横幅 */}
      {rs && (
        <section className="panel run-status">
          {rs.status === 'presale' && (
            <>
              <span className="tag run-status-tag">⏳ 待映 · 预售中</span>
              <p className="dim">
                距正式上映还有 {Math.max(0, rs.releaseWeek - state.calendar.week)} 周 · 已累积预售{' '}
                <b style={{ color: 'var(--gold)' }}>{fmtWan(rs.presale)}</b>
                · 当前热度 {Math.round(p.hype ?? 50)}（每周攒预售、热度会衰减）
              </p>
            </>
          )}
          {rs.status === 'running' && curRun && (
            <>
              <div className="run-status-head">
                <span className="tag tag-gold run-status-tag">
                  🎬 {CHANNEL_INFO[curRun.channel].label}档 · 放映第 {curRun.weekly.length + 1} 周
                </span>
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (window.confirm(`确认《${p.name}》手动下片？本周已结算收入保留。`)) {
                      dispatch({ type: 'endRun', projectId: p.id })
                    }
                  }}
                >
                  ⏹ 手动下片
                </button>
              </div>
              <p className="dim">
                每周票房动态结算中，票房归零或达上限周数自动下片；首轮下片后结算成员成长与 IP 沉淀。
              </p>
            </>
          )}
          {rs.status === 'idle' && (
            <>
              <div className="run-status-head">
                <span className="tag run-status-tag">⏸ 已下片 · 可再发行</span>
                {lowerCh.length > 0 && (
                  <div className="rerelease-box">
                    <span className="slot-label">再发行渠道（严格更低档）</span>
                    <select value={rereleaseCh} onChange={(e) => setRereleaseCh(e.target.value as Channel | '')}>
                      <option value="">选择渠道…</option>
                      {lowerCh.map((c) => (
                        <option key={c} value={c}>
                          {CHANNEL_INFO[c].label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-primary"
                      disabled={!rereleaseCh}
                      onClick={() => {
                        if (!rereleaseCh) return
                        dispatch({ type: 'rerelease', projectId: p.id, channel: rereleaseCh as Channel })
                        setRereleaseCh('')
                      }}
                    >
                      下周开映 ▶
                    </button>
                  </div>
                )}
              </div>
              <p className="dim">
                再发行不定档不预售，选更低档渠道下周直接开映；收益按当前最终口碑/MP 结算，不再触发成长。
              </p>
            </>
          )}
          {rs.status === 'finished' && (
            <>
              <span className="tag run-status-tag">🏁 已彻底完结</span>
              <p className="dim">本片已结束全部发行，仅保留档案。</p>
            </>
          )}
        </section>
      )}

      {/* 上映结算卡：第一行 = 上映档案内容，第二行 = 结算明细 */}
      <section className="panel">
        <h2>上映结算</h2>
        <div className="settle-head">{archiveStats}</div>
        <div className="settle-body">
          <div className="grid-2">
            <div>
              {r.channel && (
                <div className="channel-effect" style={{ marginTop: 0 }}>
                  <h3>宣发渠道效果</h3>
                  {r.channel === 'cinema' && (
                    <p>
                      投放影院 <b>{p.cinemaCount || CHANNEL_CONFIG.cinemaDefaultCount} 家</b>
                      （全国共 {TOTAL_CINEMAS} 家） · 观影人次
                      <b style={{ color: 'var(--gold)' }}>{fmtWan(r.admissions ?? 0)}人次</b>
                    </p>
                  )}
                  {r.channel === 'web' && (
                    <p>
                      上架平台 <b>{p.webPlatforms.length > 0 ? p.webPlatforms.join('、') : '—'}</b> · 投放时长
                      <b style={{ color: 'var(--gold)' }}>{p.webWeeks || CHANNEL_CONFIG.webDefaultWeeks} 周</b>
                    </p>
                  )}
                  {r.channel === 'dvd' && (
                    <p>
                      单价 <b>{p.dvdPrice || CHANNEL_CONFIG.dvdRefPrice} 元/张</b> · 卖出
                      <b style={{ color: 'var(--gold)' }}>{fmtWan(r.dvdUnits ?? 0)}张</b>
                    </p>
                  )}
                  {r.channel === 'free' && (
                    <p>
                      广告单价 <b>{p.freeAdPrice || 30} 元/千次</b> · 播放量
                      <b style={{ color: 'var(--gold)' }}>{fmtWan(r.freeViews ?? 0)}次</b> · 广告收入
                      <b style={{ color: 'var(--gold)' }}>{fmtWan(r.revenue ?? 0)}</b>
                    </p>
                  )}
                </div>
              )}
              {r.adSettlement && r.adSettlement.length > 0 && (
                <div className="stat-row">
                  <span className="stat-label">植入广告</span>
                  <span>
                    {r.adSettlement.map((a) => (
                      <span key={a.id} className={a.met ? 'ok' : 'warn'}>
                        {a.name} {a.met ? `+${fmtWan(a.fee)}` : '未达标'}
                        {'　'}
                      </span>
                    ))}
                    {r.adIncome ? (
                      <b style={{ color: 'var(--gold)' }}>共到账 {fmtWan(r.adIncome)}</b>
                    ) : (
                      <span className="warn">全部未到账</span>
                    )}
                  </span>
                </div>
              )}
              <div className="stat-row">
                <span className="stat-label">片方总收入</span>
                <MoneyText value={r.revenue ?? r.boxOffice * ECONOMY.cinemaShare} />
              </div>
            </div>
            <div>
              <h3>成员成长结算</h3>
              {r.settlement ? (
                <>
                  <p className="dim">
                    每位成员的参与角色、表现评分与全部属性变化已入账，点击查看明细。
                  </p>
                  <div className="btn-row">
                    <button className="btn-primary" onClick={() => setSettlement(r.settlement!)}>
                      📊 查看全员属性变化
                    </button>
                  </div>
                </>
              ) : (
                <ul className="career-list">
                  {r.groupPerformance.map((g) => (
                    <li key={g.workerId}>
                      {state.workers[g.workerId]?.name ?? '未知'}（{ROLE_ZH[g.role]}） · 表现{' '}
                      {Math.round(g.performance)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 长尾收益走势：首轮/再发行 子 TAB，每个用曲线图 */}
      {rs && rs.runs.length > 0 && (
        <section className="panel">
          <h2>长尾收益走势</h2>
          <p className="dim">X 轴为 WEEK（第几周），Y 轴为当周数值；首轮与每段再发行分开查看。</p>
          <Tabs
            tabs={rs.runs.map((run, i) => ({
              key: run.id,
              label: run.isFirst ? '首轮' : `再发行 ${i}`,
              content: <RunCharts run={run} />,
            }))}
          />
        </section>
      )}
    </>
  )

  /** TAB3 影评与观众口碑 */
  const reviewsTab = (
    <section className="panel">
      <h2>影评与观众口碑</h2>
      {r.reviews && r.reviews.length > 0 ? (
        <CriticReviews
          reviews={r.reviews}
          average={r.criticScore}
          title="上映后评分"
          audience={r.audienceScore !== undefined ? { score: r.audienceScore, text: r.audienceText } : undefined}
        />
      ) : (
        <p className="dim empty-hint">这部影片没有收到影评人评分。</p>
      )}
    </section>
  )

  /** TAB4 获奖记录 */
  const awardsTab = (
    <section className="panel">
      <h2>获奖记录</h2>
      <p className="dim">
        TMA 颁奖典礼的获奖记录：本片获得的奖项，以及本片所有参与者获得的奖项（跨届累计）。
      </p>
      {r.awards && r.awards.length > 0 ? (
        <div className="award-list">
          {r.awards.map((a, i) => (
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
      )}
    </section>
  )

  return (
    <div className="screen">
      <button className="back-mini" onClick={onBack} title="返回上一页">
        ← 返回
      </button>

      <Tabs
        tabs={[
          { key: 'info', label: '电影信息', content: infoTab },
          { key: 'release', label: '电影上映', content: releaseTab },
          { key: 'reviews', label: '影评与观众口碑', content: reviewsTab },
          { key: 'awards', label: '获奖记录', content: awardsTab },
        ]}
      />

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
    </div>
  )
}

/** 单段放映的曲线图（票房/分账/渠道指标） */
function RunCharts({ run }: { run: FilmRun }) {
  const box = run.weekly.map((w) => w.boxOffice)
  const rev = run.weekly.map((w) => w.revenue)
  const metric = run.weekly.map((w) => w.admissions ?? w.traffic ?? w.units ?? 0)
  const sum = run.weekly.reduce((a, w) => a + w.boxOffice, 0)
  const sumRev = run.weekly.reduce((a, w) => a + w.revenue, 0)
  const metricLabel =
    run.channel === 'cinema' ? '观影人次（万）' : run.channel === 'web' || run.channel === 'free' ? '播放量（万次）' : '销量（万张）'
  const metricColor =
    run.channel === 'cinema' ? '#e05555' : run.channel === 'web' ? '#8a5cff' : run.channel === 'dvd' ? '#f5a623' : '#4c8bf5'

  return (
    <div className="run-charts">
      <div className="run-charts-head">
        <span className="tag tag-gold">{CHANNEL_INFO[run.channel].label}档</span>
        <span className="dim">
          {run.weekly.length} 周 · 累计票房 <b>{fmtWan(sum)}</b> · 分账 {fmtWan(sumRev)}
          {run.status === 'running' ? ' · 放映中' : ` · ${run.endWeek ? `第 ${run.endWeek} 周下片` : '已下片'}`}
        </span>
      </div>
      <div className="lt-charts">
        <div className="lt-chart">
          <h4>每周票房（万）</h4>
          <LineChart series={[{ name: '票房', color: 'var(--gold)', values: box }]} format={(v) => fmtWan(v)} />
        </div>
        <div className="lt-chart">
          <h4>每周片方分账（万）</h4>
          <LineChart series={[{ name: '分账', color: 'var(--ok)', values: rev }]} format={(v) => fmtWan(v)} />
        </div>
        <div className="lt-chart">
          <h4>每周{metricLabel}</h4>
          <LineChart series={[{ name: metricLabel, color: metricColor, values: metric }]} />
        </div>
      </div>
    </div>
  )
}

function TeamLine({ state, id, label }: { state: GameState; id: string; label: string }) {
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

/** 上映结算表列（依赖 state 取员工名） */
export function settlementColumns(state: GameState): Column<WorkerSettlement>[] {
  const delta = (v: number) => <span className={v >= 0 ? 'good' : 'bad'}>{signedDelta(v)}</span>
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
