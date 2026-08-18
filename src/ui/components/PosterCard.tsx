import type { ReactNode } from 'react'
import type { FilmType } from '../../core/types'
import { TYPE_COLOR, TYPE_ZH } from '../format'

/** 电影海报卡片：类型色 + 标题 + 内容区 */
export function PosterCard({
  title,
  type,
  children,
  onClick,
  active,
  corner,
  typeInFooter,
  titleBadge,
}: {
  title: string
  type: FilmType
  children?: ReactNode
  onClick?: () => void
  active?: boolean
  /** 右上角附加内容（如阶段 Label），不传则不显示 */
  corner?: ReactNode
  /** true：类型改为卡片底部小 Label（头部不再显示类型） */
  typeInFooter?: boolean
  /** 标题后紧跟的小 Label（如 IP 系列标识），不传则不显示 */
  titleBadge?: ReactNode
}) {
  const color = TYPE_COLOR[type]
  return (
    <div
      className={`poster${active ? ' poster-active' : ''}${onClick ? ' poster-clickable' : ''}`}
      style={{ borderColor: color }}
      onClick={onClick}
    >
      <div className="poster-head" style={{ background: color }}>
        {!typeInFooter && <span className="poster-type">{TYPE_ZH[type]}</span>}
        <span className="poster-title">
          {title}
          {titleBadge && <span className="poster-title-badge">{titleBadge}</span>}
        </span>
        {corner && <span className="poster-corner">{corner}</span>}
      </div>
      <div className="poster-body">{children}</div>
      {typeInFooter && (
        <div className="poster-foot">
          <span className="poster-foot-type" style={{ background: color }}>
            {TYPE_ZH[type]}
          </span>
        </div>
      )}
    </div>
  )
}
