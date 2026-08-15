import type { FilmType } from '../../core/types'
import { TYPE_COLOR, TYPE_ZH } from '../format'

/** 电影海报卡片：类型色 + 标题 + 内容区 */
export function PosterCard({
  title,
  type,
  children,
  onClick,
  active,
}: {
  title: string
  type: FilmType
  children?: React.ReactNode
  onClick?: () => void
  active?: boolean
}) {
  const color = TYPE_COLOR[type]
  return (
    <div
      className={`poster${active ? ' poster-active' : ''}${onClick ? ' poster-clickable' : ''}`}
      style={{ borderColor: color }}
      onClick={onClick}
    >
      <div className="poster-head" style={{ background: color }}>
        <span className="poster-type">{TYPE_ZH[type]}</span>
        <span className="poster-title">{title}</span>
      </div>
      <div className="poster-body">{children}</div>
    </div>
  )
}
