import { useState } from 'react'
import type { ReactNode } from 'react'

/** 轻量标签页（无受控需求） */
export function Tabs({
  tabs,
}: {
  tabs: Array<{ key: string; label: string; content: ReactNode }>
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? '')
  const current = tabs.find((t) => t.key === active) ?? tabs[0]
  return (
    <div className="tabs">
      <div className="tab-head">
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
