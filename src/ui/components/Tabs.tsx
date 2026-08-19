import { useState } from 'react'
import type { ReactNode } from 'react'

/** 轻量标签页（无受控需求）；scrollable=true 时 TAB 栏超宽可横向滚动（隐藏滚动条） */
export function Tabs({
  tabs,
  scrollable = false,
}: {
  tabs: Array<{ key: string; label: string; content: ReactNode }>
  scrollable?: boolean
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? '')
  const current = tabs.find((t) => t.key === active) ?? tabs[0]
  return (
    <div className="tabs">
      <div className={scrollable ? 'tab-head tab-head-scroll' : 'tab-head'}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={t.key === active ? 'tab-btn tab-active' : 'tab-btn'}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body">{current?.content}</div>
    </div>
  )
}
