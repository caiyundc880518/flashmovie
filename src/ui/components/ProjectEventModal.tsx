import type { ProjectEvent } from '../../core/types'
import { fmtWan } from '../format'
import { Modal } from './Modal'

/**
 * 拍摄事件强制弹窗：拍摄阶段的事件必须做出选择才能继续推进一周。
 * 点「推进一周」遇到未处理事件时弹出；选择后 resolve，若该项目还有事件则继续弹出。
 */
export function ProjectEventModal({
  projectName,
  event,
  onResolve,
  onLater,
}: {
  projectName: string
  event: ProjectEvent
  onResolve: (optionIndex: number) => void
  /** 稍后处理：关闭弹窗但本周无法推进，直到事件被处理 */
  onLater: () => void
}) {
  return (
    <Modal title={`⚡ 拍摄事件 · 《${projectName}》`} onClose={onLater}>
      <div className="event-block event-block-modal">
        <div className="event-title">{event.title}</div>
        <div className="event-desc">{event.desc}</div>
        <p className="dim">这是拍摄中的关键抉择，必须选择后才能继续推进一周。</p>
        <div className="btn-row event-options">
          {event.options.map((o, i) => (
            <button key={i} className="btn-primary" onClick={() => onResolve(i)}>
              {o.label}
              {o.cash ? `（${fmtWan(o.cash)})` : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="event-later">
        <button className="btn-ghost" onClick={onLater}>
          稍后处理（本周不能推进）
        </button>
      </div>
    </Modal>
  )
}
