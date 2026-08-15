import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { SEASON_ZH, STAGE_ZH, TYPE_ZH, fmtWan } from '../format'
import { ECONOMY } from '../../core/config/economy'
import { INVESTOR_CONFIG, SCHOOL_CONFIG } from '../../core/config/company'
import { PosterCard } from '../components/PosterCard'
import { MoneyText } from '../components/MoneyText'
import { DataTable, type Column } from '../components/DataTable'
import type { Competitor } from '../../core/types'

export function CompanyScreen({ onOpenProject }: { onOpenProject: (id: string) => void }) {
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
        <h2>项目</h2>
        {state.projects.length === 0 && (
          <p className="dim">还没有项目。去「剧本市场」买一个剧本，再到「组队立项」开拍吧。</p>
        )}
        <div className="project-list">
          {state.projects.map((p) => {
            const script = state.scripts[p.scriptId]
            return (
              <div key={p.id} className="project-row clickable" onClick={() => onOpenProject(p.id)}>
                <PosterCard title={p.name} type={script?.type ?? 'drama'}>
                  <div>
                    阶段：<b>{STAGE_ZH[p.stage]}</b>
                  </div>
                  {p.stage === 'shooting' && <div>场次 {p.shotStages}/{p.totalStages}</div>}
                  {p.stage === 'marketing' && <div>Hype {Math.round(p.hype)}</div>}
                  {p.stage === 'released' && p.result && (
                    <div>
                      票房 {fmtWan(p.result.boxOffice)} · AP {p.result.ap} / MP {p.result.mp}
                    </div>
                  )}
                  {p.stage === 'editing' && <div>等待剪辑决策</div>}
                  {p.stage === 'preparing' && <div>等待开拍</div>}
                </PosterCard>
              </div>
            )
          })}
        </div>
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
