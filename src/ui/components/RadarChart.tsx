/** 属性雷达图（SVG） */
export function RadarChart({
  values,
  labels,
  size = 150,
}: {
  values: number[]
  labels: string[]
  size?: number
}) {
  const n = values.length
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 22

  const point = (val: number, i: number): [number, number] => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2
    const rr = (Math.min(100, Math.max(0, val)) / 100) * r
    return [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)]
  }

  const grids = [25, 50, 75, 100].map((lv) => {
    const pts = values
      .map((_, i) => {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2
        return `${cx + (lv / 100) * r * Math.cos(ang)},${cy + (lv / 100) * r * Math.sin(ang)}`
      })
      .join(' ')
    return <polygon key={lv} points={pts} className="radar-grid" />
  })

  const axes = values.map((_, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2
    return (
      <line
        key={i}
        x1={cx}
        y1={cy}
        x2={cx + r * Math.cos(ang)}
        y2={cy + r * Math.sin(ang)}
        className="radar-axis"
      />
    )
  })

  const labelsEl = labels.map((lb, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2
    return (
      <text
        key={i}
        x={cx + (r + 16) * Math.cos(ang)}
        y={cy + (r + 16) * Math.sin(ang) + 4}
        textAnchor="middle"
        className="radar-label"
      >
        {lb}
      </text>
    )
  })

  const poly = values.map((v, i) => point(v, i).join(',')).join(' ')

  return (
    <svg width={size} height={size} className="radar">
      {grids}
      {axes}
      <polygon points={poly} className="radar-fill" />
      <polygon points={poly} className="radar-stroke" fill="none" />
      {labelsEl}
    </svg>
  )
}
