import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { SEASON_ZH, TYPE_ZH, fmtWan } from '../format'
import { ECONOMY } from '../../core/config/economy'
import { INVESTOR_CONFIG, SCHOOL_CONFIG } from '../../core/config/company'
import { IP_CONFIG } from '../../core/config/ip'
import { TECH_CONFIG, TECH_LINES } from '../../core/config/tech'
import { techLevelOf, techProgressInLevel } from '../../core/rules/tech'
import { audienceFit, regionMarkets, type RegionMarket } from '../../core/rules/audience'
import { MoneyText } from '../components/MoneyText'
import { DataTable, type Column } from '../components/DataTable'
import type { AudienceGroup, Competitor, GameState, IpAsset } from '../../core/types'

export function CompanyScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [loanAmount, setLoanAmount] = useState('500')

  if (!state) return null
  const { company, calendar, world } = state
  const payroll = company.employeeIds.reduce((sum, id) => sum + (state.workers[id]?.salary ?? 0), 0)
  const totalLoan = company.loans.reduce((s, l) => s + l.principal, 0)

  return (
    <div className="screen">
      <div className="grid-2">
        <section className="panel">
          <h2>公司概况</h2>
          <div className="stat-row">
            <span className="stat-label">现金</span>
            <MoneyText value={company.cash} />
            <span className="stat-label">声誉</span>
            <span>{Math.round(company.reputation)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">周薪支出</span>
            <MoneyText value={payroll} />
            <span className="stat-label">办公成本</span>
            <MoneyText value={ECONOMY.weeklyOfficeCost} />
          </div>
          <div className="stat-row">
            <span className="stat-label">员工</span>
            <span>{company.employeeIds.length} 人</span>
            <span className="stat-label">贷款余额</span>
            <MoneyText value={totalLoan} />
          </div>
          <div className="loan-box">
            <div className="loan-input-row">
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="贷款金额"
              />
              <button onClick={() => dispatch({ type: 'takeLoan', amount: Number(loanAmount) || 0 })}>
                申请贷款
              </button>
            </div>
            {company.loans.map((l) => (
              <div key={l.id} className="loan-row">
                <span>
                  本金 {fmtWan(l.principal)} · 剩余 {l.weeksLeft} 周
                </span>
                <button onClick={() => dispatch({ type: 'repayLoan', loanId: l.id })}>提前还款</button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>日历</h2>
          <div className="cal-row">
            第 {calendar.year} 年 · 第 {calendar.week} 周 · {SEASON_ZH(calendar.week)}
          </div>
          <div className="cal-row">
            潮流类型：
            {world.trend ? (
              <>
                <b style={{ color: 'var(--gold)' }}>{TYPE_ZH[world.trend.type]}</b>
                （持续到第 {world.trend.untilWeek} 周）
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="cal-row">剧本市场刷新：{world.marketRefreshIn} 周后</div>
          <div className="cal-row">签约编剧创作中：{Object.keys(state.writerQueues).length} 位</div>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>写作学校</h2>
          <div className="stat-row">
            <span className="stat-label">等级</span>
            <span>{company.schoolLevel} / 3</span>
          </div>
          <p className="dim">
            签约编剧产出质量 +{Math.round(SCHOOL_CONFIG.writerQualityPerLevel * company.schoolLevel * 100)}%，
            精品剧本概率 +{Math.round(SCHOOL_CONFIG.boutiqueChancePerLevel * company.schoolLevel * 100)}%。
          </p>
          {company.schoolLevel < 3 ? (
            <button
              disabled={company.cash < SCHOOL_CONFIG.upgradeCost[company.schoolLevel + 1]}
              onClick={() => dispatch({ type: 'upgradeSchool' })}
            >
              升级到 {company.schoolLevel + 1} 级（
              <MoneyText value={SCHOOL_CONFIG.upgradeCost[company.schoolLevel + 1]} />）
            </button>
          ) : (
            <p className="dim">学校已满级。</p>
          )}
        </section>

        <section className="panel">
          <h2>融资 · 投资人</h2>
          {company.investor ? (
            <>
              <div className="stat-row">
                <span className="stat-label">投资人</span>
                <span>{company.investor.name}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">分成</span>
                <span>{Math.round(company.investor.share * 100)}% 片方收入</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">待回收</span>
                <MoneyText value={company.investor.remainingToCollect} />
              </div>
              <p className="dim">上映结算时自动扣除分成，回收完毕投资人退出。</p>
            </>
          ) : (
            <div className="investor-list">
              {world.investors.map((inv) => {
                const investment = Math.round(
                  inv.investmentBase + company.reputation * inv.investmentPerRep,
                )
                return (
                  <div key={inv.id} className="investor-row">
                    <div>
                      <div className="table-name">{inv.name}</div>
                      <div className="dim">
                        出资 {fmtWan(investment)} · 分成 {Math.round(inv.share * 100)}% · 需回收{' '}
                        {fmtWan(Math.round(investment * INVESTOR_CONFIG.repayMultiplier))}
                      </div>
                    </div>
                    <button onClick={() => dispatch({ type: 'signInvestor', investorId: inv.id })}>
                      签约
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>IP 资产 · 系列化经营</h2>
        <DataTable<IpAsset>
          columns={ipColumns}
          rows={company.ips}
          rowKey={(ip) => ip.id}
          emptyText={`尚无 IP。票房 ≥ ${IP_CONFIG.originBoxOffice} 万且影评 ≥ ${IP_CONFIG.originCriticScore} 分的影片会自动沉淀为 IP，之后可在「组队立项」中立项续作。`}
        />
      </section>

      <section className="panel">
        <h2>科技研发 · VFX Tech</h2>
        <p className="dim">
          投入资金推进研发；技术/特效员工的 VFX 技能越高，每次投入的进度越多。研发进度满 100 自动升级。
        </p>
        <div className="tech-list">
          {TECH_LINES.map((line) => {
            const level = techLevelOf(state, line.id)
            const progress = Math.floor(techProgressInLevel(state.company.tech, line.id))
            const done = level >= line.maxLevel
            const affordable = state.company.cash >= TECH_CONFIG.investCost
            return (
              <div key={line.id} className="tech-row">
                <div className="tech-info">
                  <div className="tech-head">
                    <span className="slot-title">
                      {line.icon} {line.name}
                    </span>
                    {done ? (
                      <span className="tag tag-gold">已满级</span>
                    ) : (
                      <span className="tag tag-required">
                        Lv.{level}/{line.maxLevel}
                      </span>
                    )}
                  </div>
                  <div className="dim">{line.desc}</div>
                  <div className="attr-line">
                    当前：<b className="good">{level > 0 ? line.effectText(level) : '未解锁'}</b>
                  </div>
                  {!done && <div className="dim">下一级：{line.effectText(level + 1)}</div>}
                </div>
                <div className="tech-progress">
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="dim">
                    {progress} / {TECH_CONFIG.progressPerLevel}
                  </span>
                </div>
                <button
                  className="btn-primary"
                  disabled={!affordable || done}
                  onClick={() => dispatch({ type: 'investTech', lineId: line.id })}
                >
                  {done ? '已满级' : affordable ? `投入研发（${TECH_CONFIG.investCost} 万）` : '现金不足'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h2>观众群体</h2>
        <p className="dim">
          票房按「群体规模 × 类型关注度」加权结算；容忍度低的市场更挑剔差片。偏好每季度缓慢漂移。
        </p>
        <DataTable<AudienceGroup>
          columns={audienceColumns}
          rows={world.audience}
          rowKey={(g) => g.id}
          emptyText="暂无观众群体数据。"
        />
        <div className="dim" style={{ marginTop: 10 }}>
          当前主流：{world.trend ? TYPE_ZH[world.trend.type] : '—'}（观众契合 ×
          {world.trend ? audienceFit(state, world.trend.type).toFixed(2) : '—'}）
        </div>
      </section>

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
        <h2>市场事件</h2>
        {world.activeEvents.length === 0 ? (
          <p className="dim">暂无进行中的市场事件。</p>
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

      <section className="panel">
        <h2>市场动态</h2>
        <DataTable<Competitor>
          columns={competitorColumns}
          rows={world.competitors}
          rowKey={(c) => c.id}
          emptyText="暂无竞争对手"
        />
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
    render: (g) => (g.tolerance >= 0.6 ? <span className="good">宽和</span> : g.tolerance >= 0.45 ? '一般' : <span className="bad">挑剔</span>),
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

const competitorColumns: Column<Competitor>[] = [
  { key: 'name', label: '影业', render: (c) => <span className="table-name">{c.name}</span> },
  { key: 'rep', label: '声誉', render: (c) => c.reputation },
  {
    key: 'next',
    label: '下次上映',
    render: (c) => `${c.nextReleaseIn} 周后`,
  },
  {
    key: 'last',
    label: '近作',
    render: (c) => {
      const last = c.history[c.history.length - 1]
      return last ? `${last.name} · ${fmtWan(last.boxOffice)}` : '—'
    },
  },
]

const ipColumns: Column<IpAsset>[] = [
  {
    key: 'name',
    label: '系列',
    render: (ip) => (
      <>
        <span className="table-name">{ip.name}</span>{' '}
        <span className="tag" style={{ color: 'var(--accent)' }}>
          {TYPE_ZH[ip.type]}
        </span>
      </>
    ),
  },
  { key: 'entry', label: '部数', render: (ip) => `第 ${ip.entry} 部` },
  {
    key: 'level',
    label: '等级',
    render: (ip) => <span className="tag tag-gold">Lv.{ip.level}</span>,
  },
  { key: 'total', label: '累计票房', render: (ip) => fmtWan(ip.totalBoxOffice) },
  { key: 'best', label: '最高票房', render: (ip) => fmtWan(ip.bestBoxOffice) },
  { key: 'critic', label: '最佳口碑', render: (ip) => `${ip.bestCriticScore} 分` },
  {
    key: 'royalty',
    label: '季度授权',
    render: (ip) => `${fmtWan(ip.royaltyPerQuarter)}/季`,
  },
  {
    key: 'bonus',
    label: '续作加成',
    render: (ip) => `票房 +${Math.round((ip.sequelBonus - 1) * 100)}%`,
  },
  { key: 'earned', label: '授权累计', render: (ip) => fmtWan(ip.royaltyEarned) },
  {
    key: 'since',
    label: '诞生',
    render: (ip) => `${ip.originYear} 年第 ${ip.originWeek} 周`,
  },
]
