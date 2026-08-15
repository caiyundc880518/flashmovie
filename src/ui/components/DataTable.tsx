import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  /** 第二参数为行索引（0 起），用于排名等场景 */
  render: (row: T, index: number) => ReactNode
  className?: string
}

/** 通用数据表格（暗色主题） */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyText,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyText?: string
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render(row, idx)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyText ?? '暂无数据'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
