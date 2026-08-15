import type { YearAwards } from '../../core/types'
import { Modal } from './Modal'

/** TMA 颁奖典礼演出（跨年自动弹出） */
export function AwardsCeremonyModal({
  ceremony,
  onClose,
}: {
  ceremony: YearAwards
  onClose: () => void
}) {
  return (
    <Modal title={`🏆 第 ${ceremony.year} 届 TMA 颁奖典礼`} onClose={onClose}>
      <p className="dim">以下是本年度的获奖名单：</p>
      <ul className="award-list">
        {ceremony.winners.map((w) => (
          <li key={w.category} className="award-row">
            <span className="award-cat">{w.category}</span>
            <span className="award-film">
              《{w.filmName}》
              {w.workerName ? ` · ${w.workerName}` : ''}
            </span>
            <span className={`tag ${w.ours ? 'tag-gold' : 'tag-pro'}`}>
              {w.ours ? '我方' : '对手'}
            </span>
          </li>
        ))}
      </ul>
      {ceremony.winners.length === 0 && <p className="dim">本年无影片参评。</p>}
      <div className="btn-row">
        <button className="btn-primary" onClick={onClose}>
          恭喜！继续经营 ▶
        </button>
      </div>
    </Modal>
  )
}
