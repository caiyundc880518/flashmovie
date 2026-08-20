import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { CHANNEL_CONFIG, TOTAL_CINEMAS } from '../../core/config/channels'
import { cinemaBuildCost, cinemaMaxMul, ownCinemas, totalCinemas } from '../../core/rules/cinema'
import { fmtWan } from '../format'

export function CinemaScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [count, setCount] = useState(100)

  if (!state) return null
  const own = ownCinemas(state)
  const total = totalCinemas(state)
  const maxMul = cinemaMaxMul(state)
  const unitCost = CHANNEL_CONFIG.cinemaBuildCost
  const n = Math.max(0, Math.floor(count) || 0)
  const cost = cinemaBuildCost(n)
  const canAfford = state.company.cash >= cost
  const maxAffordable = Math.floor(state.company.cash / unitCost)

  return (
    <div className="screen">
      <section className="panel">
        <h2>院线管理</h2>
        <p className="dim">
          投钱自建影院，壮大全国院线规模。自建影院会提升影院渠道的满覆盖票房上限，但投放影院数上限与覆盖率分母也随全国总数变化。
        </p>

        <div className="cinema-grid">
          <div className="cinema-stat">
            <div className="cinema-stat-label">基础影院</div>
            <div className="cinema-stat-value">{TOTAL_CINEMAS.toLocaleString()}</div>
            <div className="cinema-stat-sub">全国原有</div>
          </div>
          <div className="cinema-stat cinema-stat-own">
            <div className="cinema-stat-label">自建影院</div>
            <div className="cinema-stat-value">{own.toLocaleString()}</div>
            <div className="cinema-stat-sub">累计投入 {fmtWan(own * unitCost)}</div>
          </div>
          <div className="cinema-stat cinema-stat-total">
            <div className="cinema-stat-label">全国影院总数</div>
            <div className="cinema-stat-value">{total.toLocaleString()}</div>
            <div className="cinema-stat-sub">投放上限 · 覆盖率分母</div>
          </div>
          <div className="cinema-stat">
            <div className="cinema-stat-label">满覆盖票房上限</div>
            <div className="cinema-stat-value">×{maxMul.toFixed(2)}</div>
            <div className="cinema-stat-sub">基础 ×{CHANNEL_CONFIG.cinemaMaxMul.toFixed(1)}，自建 +{Math.round(own * CHANNEL_CONFIG.cinemaMaxMulPerCinema * 1000) / 1000}</div>
          </div>
        </div>

        <div className="cinema-build">
          <h3>投资新建影院</h3>
          <p className="dim">
            单价 {unitCost} 万/座，数量无上限。每座影院让全国铺满时的票房放大上限 +{CHANNEL_CONFIG.cinemaMaxMulPerCinema}。
          </p>
          <div className="cinema-build-row">
            <input
              type="number"
              min={1}
              value={count || ''}
              placeholder="数量"
              onChange={(e) => setCount(Number(e.target.value) || 0)}
            />
            <span className="cinema-build-info">
              共 {n.toLocaleString()} 座，需 {cost.toLocaleString()} 万
              {canAfford ? ' ✓' : `（现金不足，最多可建 ${maxAffordable.toLocaleString()} 座）`}
            </span>
            <button
              className="btn-primary"
              disabled={n <= 0 || !canAfford}
              onClick={() => {
                dispatch({ type: 'buildCinemas', count: n })
                setCount(100)
              }}
            >
              投资建造
            </button>
          </div>
        </div>

        <p className="dim">
          提示：新建影院后，在「项目 → 宣发与上映 → 影院渠道」投放影院数的上限会变为全国影院总数；投得越多覆盖越广。
        </p>
      </section>
    </div>
  )
}
