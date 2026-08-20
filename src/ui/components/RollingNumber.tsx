import { useEffect, useRef, useState } from 'react'

/**
 * 滚动数字：value 变化时从旧值平滑滚动到新值（rAF + easeOutCubic），
 * 挂载时从 0 滚起——用于「实时票房」风格的动态数字展示。
 */
export function RollingNumber({
  value,
  duration = 700,
  format,
  className,
}: {
  value: number
  duration?: number
  /** 自定义格式化（默认千分位整数） */
  format?: (n: number) => string
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = to
    if (from === to) {
      setDisplay(to)
      return
    }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString())
  return (
    <span className={className ? `rolling-num ${className}` : 'rolling-num'}>{fmt(display)}</span>
  )
}
