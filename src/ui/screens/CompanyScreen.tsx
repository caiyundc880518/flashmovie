import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { SEASON_ZH, TYPE_ZH, fmtWan } from '../format'
import { ECONOMY } from '../../core/config/economy'
import { INVESTOR_CONFIG, SCHOOL_CONFIG } from '../../core/config/company'
import { IP_CONFIG } from '../../core/config/ip'
import { MoneyText } from '../components/MoneyText'
import { DataTable, type Column } from '../components/DataTable'
import type { Competitor, IpAsset } from '../../core/types'

export function CompanyScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [loanAmount, setLoanAmount] = useState('500')

  if (!state) return null
  const { company, calendar, world } = state
  const payroll = company.employeeIds.reduce((sum, id) => sum + (state.workers[id]?.salary ?? 0), 0)
  const totalLoan = company.loans.reduce((s, l) => s + l.principal, 0)
  const schoolMax = company.public ? SCHOOL_CONFIG.maxLevelPublic : SCHOOL_CONFIG.maxLevel

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
            <span>
              {company.schoolLevel} / {schoolMax}
            </span>
          </div>
          <p className="dim">
            签约编剧产出质量 +{Math.round(SCHOOL_CONFIG.writerQualityPerLevel * company.schoolLevel * 100)}%，
            精品剧本概率 +{Math.round(SCHOOL_CONFIG.boutiqueChancePerLevel * company.schoolLevel * 100)}%。
          </p>
          {company.schoolLevel < schoolMax ? (
            <button
              disabled={company.cash < SCHOOL_CONFIG.upgradeCost[company.schoolLevel + 1]}
              onClick={() => dispatch({ type: 'upgradeSchool' })}
            >
              升级到 {company.schoolLevel + 1} 级（
              <MoneyText value={SCHOOL_CONFIG.upgradeCost[company.schoolLevel + 1]} />）
            </button>
          ) : (
            <p className="dim">学校已满级{company.public ? '。' : '（上市后可扩建至 5 级）。'}</p>
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
