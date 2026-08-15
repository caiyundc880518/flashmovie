import type { Worker } from '../../core/types'
import { ROLE_ZH } from '../format'
import { Bar } from './Bar'
import { MoneyText } from './MoneyText'

/** 员工卡片（列表用） */
export function WorkerCard({
  worker,
  onClick,
  footer,
}: {
  worker: Worker
  onClick?: () => void
  footer?: React.ReactNode
}) {
  const mood = worker.active.mood
  const moodColor = mood >= 70 ? 'var(--ok)' : mood >= 45 ? 'var(--gold)' : 'var(--danger)'
  return (
    <div className={`worker-card${onClick ? ' clickable' : ''}`} onClick={onClick}>
      <div className="worker-head">
        <div className="avatar">{worker.name.slice(-1)}</div>
        <div className="worker-id">
          <div className="worker-name">
            {worker.name} <span className="worker-role">{ROLE_ZH[worker.role]}</span>
          </div>
          <div className="worker-sub">
            周薪 <MoneyText value={worker.salary} /> · 心情
            <span style={{ color: moodColor }}> {Math.round(mood)}</span>
          </div>
        </div>
      </div>
      <Bar label="CA" value={worker.basic.ca} max={worker.basic.pa} color="var(--gold)" />
      <div className="worker-meta">
        <span>PA {worker.basic.pa}</span>
        <span>Fame {Math.round(worker.basic.fame)}</span>
        <span>{worker.gender === 'male' ? '男' : '女'} {worker.age}岁</span>
      </div>
      {footer}
    </div>
  )
}
