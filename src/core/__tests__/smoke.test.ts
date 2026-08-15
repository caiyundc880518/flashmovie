import { describe, expect, it } from 'vitest'

describe('core smoke', () => {
  it('rule layer runs under vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
