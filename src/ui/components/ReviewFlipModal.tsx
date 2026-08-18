import { useEffect, useState } from 'react'
import type { CriticReview } from '../../core/types'
import { fmtScore10, scoreColor10 } from '../format'
import { Bar } from './Bar'
import { Modal } from './Modal'

/**
 * 上映后大弹窗：影评人卡片翻牌展示评分与评价。
 * 全部影评人翻开后，再展示观众口碑（评分 + 总评）。
 */
export function ReviewFlipModal({
  projectName,
  reviews,
  audience,
  onClose,
}: {
  projectName: string
  reviews: CriticReview[]
  audience?: { score: number; text?: string }
  onClose: () => void
}) {
  const [flipped, setFlipped] = useState<boolean[]>(reviews.map(() => false))
  const [revealed, setRevealed] = useState(false)

  const allFlipped = flipped.length > 0 && flipped.every(Boolean)
  // 全部翻开后展示观众口碑
  useEffect(() => {
    if (allFlipped && !revealed) {
      const t = setTimeout(() => setRevealed(true), 500)
      return () => clearTimeout(t)
    }
  }, [allFlipped, revealed])

  const flip = (idx: number) =>
    setFlipped((prev) => prev.map((v, j) => (j === idx ? true : v)))

  return (
    <Modal title={`🎬 《${projectName}》上映 · 口碑揭晓`} xwide onClose={onClose}>
      <p className="dim">点击卡片翻面，看看每位影评人的评分与评价（共 {reviews.length} 位）。</p>

      {reviews.length === 0 ? (
        <p className="dim empty-hint">本次没有收到影评人评分。</p>
      ) : (
        <div className="flip-grid">
          {reviews.map((r, i) => (
            <div key={r.criticId} className="flip-card" onClick={() => flip(i)}>
              <div className={`flip-inner${flipped[i] ? ' flip-flipped' : ''}`}>
                {/* 背面：影评人头像占位 */}
                <div className="flip-face flip-back">
                  <div className="flip-back-emoji">🎭</div>
                  <div className="table-name">{r.criticName}</div>
                  <div className="dim">点击揭晓评分</div>
                </div>
                {/* 正面：评分 + 评语 */}
                <div className="flip-face flip-front">
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
              </div>
            </div>
          ))}
        </div>
      )}

      {reviews.length > 0 && !allFlipped && (
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            onClick={() => {
              setFlipped(reviews.map(() => true))
              setRevealed(true)
            }}
          >
            全部翻开 ▶
          </button>
        </div>
      )}

      {/* 观众口碑：全部影评人评完后展示 */}
      {revealed && audience && (
        <div className="audience-reveal">
          <h3>👥 观众口碑</h3>
          <div className="critic-summary">
            <span>
              观众评分{' '}
              <b style={{ color: scoreColor10(audience.score) }}>{fmtScore10(audience.score)}</b> / 10
            </span>
            <span className="critic-quote">「{audience.text ?? '—'}」</span>
          </div>
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 18 }}>
        <button className="btn-primary" onClick={onClose}>
          收起
        </button>
      </div>
    </Modal>
  )
}
