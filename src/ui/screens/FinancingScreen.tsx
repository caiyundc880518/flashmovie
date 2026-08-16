import { useGameStore } from '../store/gameStore'
import { fmtWan } from '../format'
import { INVESTOR_CONFIG } from '../../core/config/company'
import { MoneyText } from '../components/MoneyText'

/** 融资页（GDD §3.1）：签投资人拿启动资金，按片方收入分成回收 */
export function FinancingScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  if (!state) return null

  const { company, world } = state
  const investor = company.investor

  return (
    <div className="screen">
      <section className="panel">
        <h2>融资 · 投资人{investor ? '（已签约）' : ''}</h2>
        <p className="dim">
          投资人按<b>片方收入分成</b>提供融资：签约即获得一笔资金，此后每部影片上映结算时自动扣除
          {investor ? ` ${Math.round(investor.share * 100)}%` : '约定比例'}分成，直至回收完毕投资人退出。
          声誉越高，投资人出资越多。
        </p>

        {investor ? (
          <div className="invest-grid">
            <div className="invest-card invest-card-active">
              <div className="invest-card-head">
                <span className="table-name">{investor.name}</span>
                <span className="tag tag-gold">合作中</span>
              </div>
              <div className="invest-stats">
                <div className="invest-stat">
                  <b>{Math.round(investor.share * 100)}%</b>
                  <span>片方收入分成</span>
                </div>
                <div className="invest-stat">
                  <b>
                    <MoneyText value={investor.remainingToCollect} />
                  </b>
                  <span>待回收</span>
                </div>
              </div>
              <p className="dim invest-note">
                上映结算时自动扣除分成；回收完毕投资人退出，可另觅新投资人。
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="dim">
              当前无投资人。可选候选人如下——签约后获得注资，但未来上映收益需分成。
            </p>
            <div className="invest-grid">
              {world.investors.map((inv) => {
                const investment = Math.round(
                  inv.investmentBase + company.reputation * inv.investmentPerRep,
                )
                const repay = Math.round(investment * INVESTOR_CONFIG.repayMultiplier)
                return (
                  <div key={inv.id} className="invest-card">
                    <div className="invest-card-head">
                      <span className="table-name">{inv.name}</span>
                      <span className="tag" style={{ color: 'var(--accent)' }}>
                        分成 {Math.round(inv.share * 100)}%
                      </span>
                    </div>
                    <div className="invest-stats">
                      <div className="invest-stat">
                        <b>{fmtWan(investment)}</b>
                        <span>签约注资</span>
                      </div>
                      <div className="invest-stat">
                        <b>{fmtWan(repay)}</b>
                        <span>需回收</span>
                      </div>
                    </div>
                    <div className="invest-card-sub">
                      出资 = 基数 {fmtWan(inv.investmentBase)} + 声誉 × {inv.investmentPerRep}
                    </div>
                    <div className="invest-footer">
                      <button className="btn-primary" onClick={() => dispatch({ type: 'signInvestor', investorId: inv.id })}>
                        签约融资
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
