import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'
import { recalcCA } from '../rules/growth'

const MAIN_OF: Record<string, keyof import('../types').SkillMap> = {
  actor: 'act',
  director: 'direct',
  shooter: 'shoot',
  editor: 'edit',
  market: 'market',
  technician: 'technical',
}

describe('CA 与技能自洽（修复结算暴跌）', () => {
  it('生成即自洽：CA = min(主技能, PA)（各职位大量抽样）', () => {
    const roles = Object.keys(MAIN_OF)
    for (const role of roles) {
      for (let i = 0; i < 300; i++) {
        const w = generateWorker(createRng(1000 + i), role as never, 'pro')
        const main = MAIN_OF[role]
        expect(w.basic.ca).toBe(Math.min(w.skills[main], w.basic.pa))
        expect(w.basic.ca).toBeLessThanOrEqual(w.basic.pa)
      }
    }
  })

  it('首次结算不再暴跌：CA 只随主技能增涨，且与主技能一致', () => {
    for (let i = 0; i < 200; i++) {
      const w = generateWorker(createRng(2000 + i), 'actor', 'pro')
      const mainBefore = w.skills.act
      const before = w.basic.ca
      // 模拟结算成长：主技能 +1（skillGain 恒正），重算 CA 应 ≥ 原 CA 且不暴跌
      w.skills.act = Math.min(100, w.skills.act + 1)
      recalcCA(w)
      expect(w.basic.ca).toBeGreaterThanOrEqual(before)
      expect(w.basic.ca).toBe(Math.min(w.skills.act, w.basic.pa))
      void mainBefore
    }
  })

  it('旧公式落差对比：新生成 CA 不再被旧公式系统性缩水 ~36%', () => {
    const w = generateWorker(createRng(42), 'actor', 'pro')
    const keys = Object.keys(w.skills) as (keyof typeof w.skills)[]
    const avg = keys.reduce((s, k) => s + w.skills[k], 0) / keys.length
    const max = Math.max(...keys.map((k) => w.skills[k]))
    const oldFormula = Math.round(avg * 0.7 + max * 0.3)
    // 新 CA（主技能）与生成目标接近，显著高于旧公式输出（旧公式掉 ~36%）
    expect(w.basic.ca).toBeGreaterThan(oldFormula + 10)
  })
})
