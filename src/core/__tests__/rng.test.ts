import { describe, expect, it } from 'vitest'
import { chance, createRng, randInt, weightedPick } from '../rng'

describe('rng', () => {
  it('同种子序列确定', () => {
    const a = createRng(123)
    const b = createRng(123)
    for (let i = 0; i < 10; i++) expect(a()).toBe(b())
  })

  it('不同种子序列不同', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a()).not.toBe(b())
  })

  it('randInt 在闭区间内', () => {
    const r = createRng(7)
    for (let i = 0; i < 200; i++) {
      const v = randInt(r, 3, 9)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(9)
    }
  })

  it('weightedPick 权重为 0 的项永不选中', () => {
    const r = createRng(5)
    for (let i = 0; i < 200; i++) {
      expect(weightedPick(r, [[0, 'never'], [1, 'always']])).toBe('always')
    }
  })

  it('chance 边界', () => {
    expect(chance(createRng(0), 0)).toBe(false)
    expect(chance(createRng(0), 1)).toBe(true)
  })
})
