export interface LineSeries {
  name: string
  color: string
  values: number[]
}

/** 平滑曲线路径：三次贝塞尔穿过每个点（Catmull-Rom → Bezier） */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

/**
 * 曲线图：X = W1..WN，Y = 数值；平滑曲线 + 网格 + 轴标签，支持多系列。
 * 用于已上映页的逐周票房/分账/口碑/MP 走势。
 */
export function LineChart({
  series,
  height = 150,
  format = (v: number) => String(Math.round(v)),
  yMin,
  yMax,
}: {
  series: LineSeries[]
  height?: number
  format?: (v: number) => string
  yMin?: number
  yMax?: number
}) {
  const n = series[0]?.values.length ?? 0
  if (n === 0) return <p className="dim empty-hint">暂无数据</p>
  const W = 560
  const padL = 54
  const padR = 14
  const padT = 12
  const padB = 24
  const iw = W - padL - padR
  const ih = height - padT - padB
  const all = series.flatMap((s) => s.values)
  let lo = yMin ?? Math.min(...all)
  let hi = yMax ?? Math.max(...all)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const span = hi - lo
  const x = (i: number) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => padT + (1 - (v - lo) / span) * ih
  const xStep = Math.max(1, Math.ceil(n / 8))
  const grids = [0, 1, 2, 3].map((g) => ({ gy: padT + (g / 3) * ih, val: hi - (g / 3) * span }))

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }}>
        {grids.map((g) => (
          <g key={g.gy}>
            <line x1={padL} y1={g.gy} x2={W - padR} y2={g.gy} className="lc-grid" />
            <text x={padL - 6} y={g.gy + 3} className="lc-ylab" textAnchor="end">
              {format(g.val)}
            </text>
          </g>
        ))}
        {Array.from({ length: n }, (_, i) => i)
          .filter((i) => i % xStep === 0 || i === n - 1)
          .map((i) => (
            <text key={i} x={x(i)} y={height - 5} className="lc-xlab" textAnchor="middle">
              W{i + 1}
            </text>
          ))}
        {series.map((s) => (
          <path
            key={s.name}
            d={smoothPath(s.values.map((v, i) => [x(i), y(v)] as [number, number]))}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="lc-legend">
        {series.map((s) => (
          <span key={s.name} className="lc-legend-item">
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
