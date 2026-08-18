import { useEffect, useRef, useState } from 'react'
import type { TimingQuality } from '../../core/types'
import { TIMING_CONFIG } from '../../core/config/minigame'
import { Modal } from './Modal'

export type { TimingQuality }

const QUALITY_ZH: Record<TimingQuality, string> = {
  perfect: '完美！',
  good: '不错',
  miss: '失误…',
}

/**
 * 时机节奏小游戏（GDD §3.3/§3.4 Buff Mini Game）
 * 标记在横条上循环移动，在目标区（中间亮带）点击。
 */
export function TimingMinigame({
  title,
  desc,
  actionLabel,
  rounds = TIMING_CONFIG.rounds,
  onResult,
  onFinish,
  onClose,
}: {
  title: string
  desc: string
  actionLabel: string
  rounds?: number
  onResult: (q: TimingQuality) => void
  /** 全部轮次完成时回调（携带每轮判定结果） */
  onFinish?: (qualities: TimingQuality[]) => void
  onClose: () => void
}) {
  const [round, setRound] = useState(1)
  const [pos, setPos] = useState(0.2)
  const [results, setResults] = useState<TimingQuality[]>([])
  const rafRef = useRef(0)
  const lastRef = useRef(performance.now())
  const posRef = useRef(pos)
  posRef.current = pos

  useEffect(() => {
    lastRef.current = performance.now()
    const tick = (t: number) => {
      const dt = (t - lastRef.current) / 1000
      lastRef.current = t
      setPos((p) => (p + dt * TIMING_CONFIG.speed) % 1)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [round])

  const fire = () => {
    const dist = Math.abs(posRef.current - 0.5)
    const q: TimingQuality =
      dist < TIMING_CONFIG.perfectZone ? 'perfect' : dist < TIMING_CONFIG.goodZone ? 'good' : 'miss'
    onResult(q)
    const next = [...results, q]
    setResults(next)
    if (round >= rounds) {
      cancelAnimationFrame(rafRef.current)
      onFinish?.(next)
      onClose()
    } else {
      setRound((r) => r + 1)
    }
  }

  const markerLeft = `${pos * 100}%`

  return (
    <Modal title={title} onClose={onClose}>
      <p className="dim">{desc}</p>
      <div className="timing-track">
        <div className="timing-zone" />
        <div className="timing-perfect" />
        <div className="timing-marker" style={{ left: markerLeft }} />
      </div>
      <div className="timing-meta">
        <span>
          第 {round} / {rounds} 轮
        </span>
        <span className="timing-results">
          {results.map((q, i) => (
            <span
              key={i}
              className={`timing-dot ${q === 'perfect' ? 'dot-perfect' : q === 'good' ? 'dot-good' : 'dot-miss'}`}
            >
              {QUALITY_ZH[q]}
            </span>
          ))}
        </span>
      </div>
      <div className="btn-row">
        <button className="btn-primary" onClick={fire}>
          {actionLabel}（标记到金色亮带时点击）
        </button>
      </div>
    </Modal>
  )
}
