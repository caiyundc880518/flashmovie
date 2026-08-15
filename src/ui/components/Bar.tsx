export function Bar({
  value,
  max = 100,
  color = 'var(--accent)',
  label,
}: {
  value: number
  max?: number
  color?: string
  label?: string
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="bar-row">
      {label && <span className="bar-label">{label}</span>}
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="bar-value">{Math.round(value)}</span>
    </div>
  )
}
