import { useGameStore } from '../store/gameStore'
import { ECONOMY } from '../../core/config/economy'
import { IPO_CONFIG, SCHOOL_CONFIG } from '../../core/config/company'
import { MoneyText } from '../components/MoneyText'

/** IPO 上市页（GDD §3.1：上市融资，解锁大规模扩张） */
export function IpoScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)

  if (!state) return null
  const { company } = state
  const totalRevenue = company.history.reduce(
    (s, r) => s + (r.revenue ?? r.boxOffice * ECONOMY.cinemaShare),
    0,
  )
  const canIpo =
    !company.public &&
    company.reputation >= IPO_CONFIG.minReputation &&
    totalRevenue >= IPO_CONFIG.minTotalRevenue

  return (
    <div className="screen">
      <section className="panel">
        <h2>🚀 IPO 上市（解锁大规模扩张）</h2>
        <p className="dim">
          达到上市条件后可融资一大笔资金，并解锁贷款额度、写作学校扩建与 IP 授权放大；代价是每季度向股东分红。
        </p>
        {company.public ? (
          <>
            <div className="stat-row">
              <span className="stat-label">上市时间</span>
              <span>
                第 {company.public.year} 年 · 第 {company.public.week} 周
              </span>
              <span className="stat-label">融资额</span>
              <MoneyText value={company.public.raised} />
            </div>
            <div className="stat-row">
              <span className="stat-label">已解锁</span>
              <span>
                贷款额度 ×{IPO_CONFIG.loanCapFactorAfter} · 写作学校上限 {SCHOOL_CONFIG.maxLevelPublic} 级 ·
                IP 授权收入 ×{IPO_CONFIG.ipRoyaltyMultiplier}
              </span>
            </div>
            <p className="dim">
              股东每季度分红（{Math.round(IPO_CONFIG.dividendRatio * 100)}% 现金，保底{' '}
              {IPO_CONFIG.dividendBase} 万）。
            </p>
          </>
        ) : (
          <>
            <div className="stat-row">
              <span className="stat-label">声誉</span>
              <span>
                {Math.round(company.reputation)} / {IPO_CONFIG.minReputation}
              </span>
              <span className="stat-label">累计片方收入</span>
              <MoneyText value={totalRevenue} />
              <span className="dim">/ {IPO_CONFIG.minTotalRevenue}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">预计融资</span>
              <span>
                {canIpo
                  ? `≈ ${Math.round((Math.round(company.reputation * IPO_CONFIG.valuationPerRep + totalRevenue * IPO_CONFIG.valuationRevenueRatio)) * IPO_CONFIG.raiseRatio)} 万`
                  : '达标后可见'}
              </span>
            </div>
            {canIpo ? (
              <button className="btn-primary" onClick={() => dispatch({ type: 'ipo' })}>
                🚀 启动上市
              </button>
            ) : (
              <p className="dim">
                满足「声誉 ≥ {IPO_CONFIG.minReputation} 且 累计片方收入 ≥ {IPO_CONFIG.minTotalRevenue}{' '}
                万」后可上市融资。多拍好片、提升口碑，达成条件即可。
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
