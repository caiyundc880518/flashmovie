import { useEffect } from 'react'
import type { ReactNode } from 'react'

/** 通用弹窗：遮罩点击 / Esc 关闭；wide/xwide 控制宽度档位 */
export function Modal({
  title,
  onClose,
  children,
  wide,
  xwide,
}: {
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** 超宽档（结算明细等需要一行展示大量内容的场景） */
  xwide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={xwide ? 'modal modal-xwide' : wide ? 'modal modal-wide' : 'modal'}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
