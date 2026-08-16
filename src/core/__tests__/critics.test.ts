import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { annualCriticRotation } from '../rules/critics'
import { WORLD_CONFIG } from '../config/world'

/** 不变式：影评人恒为 5 位、名字唯一、id 唯一 */
function checkInvariants(s: ReturnType<typeof createInitialState>) {
  expect(s.world.critics).toHaveLength(5)
  const names = s.world.critics.map((c) => c.name)
  expect(new Set(names).size).toBe(5)
  const ids = s.world.critics.map((c) => c.id)
  expect(new Set(ids).size).toBe(5)
}

describe('影评人年度换血', () => {
  it('新档固定生成 5 位影评人', () => {
    const s = createInitialState(21)
    checkInvariants(s)
  })

  it('推进多年后始终维持 5 位、名字不重复', () => {
    let s = createInitialState(23)
    for (let i = 0; i < 300; i++) s = reduce(s, { type: 'advanceWeek' })
    checkInvariants(s)
    // 至少跨过 5 个年度，期间应有换血发生（新闻中出现影评人动态）
    const hasRotation = s.world.news.some((n) => n.text.includes('影评人动态'))
    expect(s.calendar.year).toBeGreaterThan(5)
    expect(hasRotation).toBe(true)
  })

  it('换血：退休 1 位补入 1 位，名字从名池补充且不重复', () => {
    const s = createInitialState(29)
    const before = s.world.critics.map((c) => c.name)
    // 控制 rng 序列：触发换血 → 退休第 0 位 → 名字取第 0 个可用 → 新人有偏好 → 类型取第 0 个
    const seq = [0.1, 0, 0, 0.1, 0, 0.5]
    const rng = () => seq.shift() ?? 0.5
    annualCriticRotation(s, rng)

    expect(s.world.critics).toHaveLength(5)
    const after = s.world.critics.map((c) => c.name)
    expect(after).not.toContain(before[0]) // 退休者离开
    expect(new Set(after).size).toBe(5) // 名字不重复
    expect(s.world.critics.some((c) => c.taste !== 'none')).toBe(true)
    expect(s.world.news.some((n) => n.text.includes('影评人动态'))).toBe(true)
  })

  it('连续多年换血后名字仍在名池内轮换（不耗尽）', () => {
    let s = createInitialState(31)
    for (let i = 0; i < 10; i++) {
      const rng = createRng(1000 + i)
      annualCriticRotation(s, rng)
      checkInvariants(s)
    }
    for (const c of s.world.critics) {
      expect(WORLD_CONFIG.criticNames).toContain(c.name)
    }
  })
})
