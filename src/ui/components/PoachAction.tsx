import { useState } from 'react'
import type { Competitor, GameState, Worker } from '../../core/types'
import type { Action } from '../../core/state/actions'
import { poachSuccessChance } from '../../core/rules/competitor'

/** 挖角操作：签字费报价 + 成功率预估 + 确认按钮（招聘页行内 / 竞对员工详情弹窗共用） */
export function PoachAction({
  state,
  competitor,
  worker,
  dispatch,
  onDone,
}: {
  state: GameState
  competitor: Competitor
  worker: Worker
  dispatch: (a: Action) => void
  onDone?: () => void
}) {
  const [offer, setOffer] = useState(Math.max(1, Math.round(worker.salary * 3)))
  const chance = poachSuccessChance(state, competitor, worker, offer)
  const canAfford = state.company.cash >= offer
  return (
    <div className="poach-action">
      <input
        className="poach-offer"
        type="number"
        min={1}
        value={offer}
        onChange={(e) => setOffer(Math.max(0, Math.round(Number(e.target.value) || 0)))}
      />
      <span className="dim">
        签字费（万）· 成功率{' '}
        <b className={chance >= 0.5 ? 'good' : chance >= 0.2 ? '' : 'bad'}>
          {Math.round(chance * 100)}%
        </b>
      </span>
      <button
        className="btn-primary"
        disabled={!canAfford || offer <= 0}
        onClick={() => {
          dispatch({
            type: 'poachCompetitorWorker',
            competitorId: competitor.id,
            workerId: worker.id,
            offer,
          })
          onDone?.()
        }}
      >
        挖角
      </button>
    </div>
  )
}
