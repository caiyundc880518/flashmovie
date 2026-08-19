import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'
import { applyWeeklyWorkerState } from '../rules/growth'
import { GROWTH } from '../config/growth'
import type { SkillKey } from '../types'

describe('作弊开关：员工 CA 不衰退（成长照常）', () => {
  it('开关开启：空闲超过阈值也不掉技能/CA', () => {
    const w = generateWorker(createRng(5), 'actor', 'pro')
    const skillsBefore = { ...w.skills }
    const caBefore = w.basic.ca
    w.idleWeeks = GROWTH.decayAfterWeeks + 1
    const rng = createRng(7)
    for (let i = 0; i < 20; i++) applyWeeklyWorkerState(w, false, rng, true)
    expect(w.basic.ca).toBe(caBefore)
    for (const k of Object.keys(skillsBefore) as SkillKey[]) {
      expect(w.skills[k]).toBe(skillsBefore[k])
    }
  })

  it('开关关闭（默认）：空闲超过阈值正常衰减 CA', () => {
    const w = generateWorker(createRng(5), 'actor', 'pro')
    w.idleWeeks = GROWTH.decayAfterWeeks + 1
    const caBefore = w.basic.ca
    const rng = createRng(7)
    for (let i = 0; i < 20; i++) applyWeeklyWorkerState(w, false, rng)
    expect(w.basic.ca).toBeLessThan(caBefore)
  })

  it('reducer 切换存档开关 + 每周推进遵循开关', () => {
    let s = createInitialState(11)
    const w = generateWorker(createRng(12), 'actor', 'pro')
    w.id = 'w1'
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
    // 开启开关
    s = reduce(s, { type: 'toggleNoCaDecay' })
    expect(s.cheats?.noCaDecay).toBe(true)
    const w1 = s.workers['w1']
    w1.idleWeeks = GROWTH.decayAfterWeeks + 1
    const caBefore = w1.basic.ca
    s = reduce(s, { type: 'advanceWeek' })
    // 空闲员工在开关开启下不衰减（已超阈值也不掉）
    expect(s.workers['w1'].basic.ca).toBe(caBefore)
    // 关回开关
    s = reduce(s, { type: 'toggleNoCaDecay' })
    expect(s.cheats?.noCaDecay).toBe(false)
  })
})