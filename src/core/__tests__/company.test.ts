import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'
import { pairAffinity, teamChemistry, collaborations } from '../rules/chemistry'
import type { GameState } from '../types'

describe('化学反应', () => {
  it('性格相似的两人相性高于性格迥异者', () => {
    const rng = createRng(3)
    const a = generateWorker(rng, 'actor')
    const b = generateWorker(rng, 'actor')
    const c = generateWorker(rng, 'actor')
    // 把 b 的属性对齐 a
    b.mental.dedication = a.mental.dedication
    b.mental.adaptability = a.mental.adaptability
    b.mental.versatility = a.mental.versatility
    b.physical.charisma = a.physical.charisma
    expect(pairAffinity(a, b)).toBeGreaterThan(pairAffinity(a, c))
  })

  it('共同合作提升相性', () => {
    const rng = createRng(5)
    const a = generateWorker(rng, 'actor')
    const b = generateWorker(rng, 'actor')
    const before = pairAffinity(a, b)
    a.career.push({ week: 1, projectName: '《合作片》', role: 'actor', performance: 70 })
    b.career.push({ week: 1, projectName: '《合作片》', role: 'actor', performance: 70 })
    expect(collaborations(a, b)).toBe(1)
    expect(pairAffinity(a, b)).toBeGreaterThan(before)
  })

  it('团队化学在 0–100 区间', () => {
    let s = createInitialState(7)
    const rng = createRng(8)
    const roles = ['director', 'actor', 'shooter', 'editor', 'market'] as const
    for (const role of roles) {
      const w = generateWorker(rng, role)
      w.id = `c-${role}`
      s.workers[w.id] = w
    }
    const project = {
      id: 'p1',
      team: {
        directorId: 'c-director',
        actorIds: ['c-actor'],
        shooterId: 'c-shooter',
        editorId: 'c-editor',
        marketId: 'c-market',
      },
    } as GameState['projects'][number]
    const chem = teamChemistry(s, project)
    expect(chem).toBeGreaterThanOrEqual(0)
    expect(chem).toBeLessThanOrEqual(100)
  })
})

describe('写作学校与投资人', () => {
  it('升级学校扣费并提升等级', () => {
    let s = createInitialState(1)
    s.company.cash = 10000
    s = reduce(s, { type: 'upgradeSchool' })
    expect(s.company.schoolLevel).toBe(1)
    s = reduce(s, { type: 'upgradeSchool' })
    expect(s.company.schoolLevel).toBe(2)
  })

  it('现金不足不能升级', () => {
    let s = createInitialState(1)
    s.company.cash = 10
    s = reduce(s, { type: 'upgradeSchool' })
    expect(s.company.schoolLevel).toBe(0)
  })

  it('签约投资人：注资入账 + 上映分账回收', () => {
    let s = createInitialState(3)
    s.company.cash = 2000
    s.company.reputation = 50
    const inv = s.world.investors[0]
    const investment = Math.round(inv.investmentBase + 50 * inv.investmentPerRep)
    const cashBefore = s.company.cash
    s = reduce(s, { type: 'signInvestor', investorId: inv.id })
    expect(s.company.investor).toBeDefined()
    expect(s.company.cash).toBe(cashBefore + investment)

    // 走完整流程上映一部片，验证分账扣减
    const remaining = s.company.investor!.remainingToCollect
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team: {
        directorId: 'test-director',
        actorIds: ['test-actor'],
        shooterId: 'test-shooter',
        editorId: 'test-editor',
        marketId: 'test-market',
      },
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
    for (let i = 0; i < 30 && s.projects[0].stage === 'shooting'; i++) {
      s = reduce(s, { type: 'advanceWeek' })
      for (const ev of [...s.projects[0].pendingEvents]) {
        s = reduce(s, { type: 'resolveEvent', projectId: pid, eventId: ev.id, optionIndex: 0 })
      }
      if (s.projects[0].pendingShotGame) {
        s = reduce(s, { type: 'applyShotGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
      }
    }
    s = reduce(s, { type: 'applyEditGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    s = reduce(s, { type: 'chooseEditStyle', projectId: pid, style: 'market' })
    const cashMid = s.company.cash
    s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
    s = reduce(s, { type: 'setCinemaCount', projectId: pid, count: 100 })
    s = reduce(s, { type: 'release', projectId: pid, weeks: 0 })
    s = reduce(s, { type: 'advanceWeek' }) // 首周结算：收入入账 + 投资人按比例分成
    const run = s.projects[0].run!.runs[0]
    const w1 = run.weekly[0]
    const investorPaid = w1.revenue * inv.share
    expect(investorPaid).toBeGreaterThan(0)
    expect(s.company.investor!.remainingToCollect).toBeLessThan(remaining)
    // 现金增量不可能超过当周分账
    expect(s.company.cash).toBeLessThanOrEqual(cashMid + w1.revenue)
  })
})
