/**
 * 数值单位格式化（core 层，供新闻文本使用；与 UI 层 fmtWan 规则一致）：
 * 超过 1 亿（即 ≥ 10000 万）→ 「X.XX亿」，否则 → 「X 万」。
 */
export function fmtWanCore(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10000) return `${(value / 10000).toFixed(2)}亿`
  return `${Math.round(value)} 万`
}
