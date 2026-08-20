import { describe, expect, it } from 'vitest'
import { fmtWanCore } from '../format'

describe('fmtWanCore（新闻文本票房单位）', () => {
  it('≥1 亿（10000 万）→ 亿，否则 → 万', () => {
    expect(fmtWanCore(15000)).toBe('1.50亿')
    expect(fmtWanCore(12345)).toBe('1.23亿')
    expect(fmtWanCore(9999)).toBe('9999 万')
    expect(fmtWanCore(2090)).toBe('2090 万')
    expect(fmtWanCore(0)).toBe('0 万')
  })
})
