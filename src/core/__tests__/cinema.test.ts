import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { cinemaBuildCost, cinemaMaxMul, ownCinemas, totalCinemas } from '../rules/cinema'
import { channelRevenue } from '../rules/scoring'
import { channelCostFor, channelMulFactor } from '../tick/distribution'
import { CHANNEL_CONFIG, TOTAL_CINEMAS } from '../config/channels'
import type { FilmProject } from '../types'

/** 造一个影院渠道项目 */
function cinemaProj(cinemaCount: number): FilmProject {
  return {
    id: 'p1',
    name: '测试片',
    scriptId: 's1',
    stage: 'marketing',
    team: { directorId: 'w1', actorIds: [], shooterId: 'w2', editorId: 'w3', marketId: 'w4' },
    totalStages: 4,
    shotStages: 4,
    budgetAlloc: { story: 30, vfx: 20, acting: 30, edit: 20 },
    vfxLevel: 0,
    adSponsorIds: [],
    hype: 50,
    marketingBudget: 100,
    budget: 1000,
    spent: 0,
    editStyle: 'market',
    buffs: 0,
    apAdjust: 0,
    pendingEvents: [],
    channel: 'cinema',
    cinemaCount,
    webPlatforms: [],
    webWeeks: 0,
    dvdPrice: 0,
    freeAdPrice: 0,
    result: { name: '测试片', ap: 60, mp: 60, criticScore: 7, audienceScore: 7, boxOffice: 0, revenue: 0 },
  } as unknown as FilmProject
}

describe('院线管理（影院自建）', () => {
  it('初始：自建 0，全国影院 = 基础 5178', () => {
    const s = createInitialState(60)
    expect(ownCinemas(s)).toBe(0)
    expect(totalCinemas(s)).toBe(TOTAL_CINEMAS)
    expect(cinemaMaxMul(s)).toBe(CHANNEL_CONFIG.cinemaMaxMul)
  })

  it('建造成功：扣现金、自建数增加、全国总数变大、上报纸', () => {
    const s = createInitialState(61)
    const cash0 = s.company.cash
    const s2 = reduce(s, { type: 'buildCinemas', count: 500 })
    expect(s2.company.ownCinemas).toBe(500)
    expect(s2.company.cash).toBe(cash0 - 500 * CHANNEL_CONFIG.cinemaBuildCost)
    expect(totalCinemas(s2)).toBe(TOTAL_CINEMAS + 500)
    expect(cinemaMaxMul(s2)).toBeCloseTo(CHANNEL_CONFIG.cinemaMaxMul + 500 * CHANNEL_CONFIG.cinemaMaxMulPerCinema)
    expect(s2.world.news.some((n) => n.text.includes('院线扩张'))).toBe(true)
  })

  it('资金不足：不建造、不改状态', () => {
    const s = createInitialState(62)
    s.company.cash = 100
    const s2 = reduce(s, { type: 'buildCinemas', count: 5000 })
    expect(s2.company.ownCinemas).toBe(0)
    expect(s2.company.cash).toBe(100)
  })

  it('非法数量（0/负数）：不建造', () => {
    const s = createInitialState(63)
    const cash0 = s.company.cash
    const s2 = reduce(reduce(s, { type: 'buildCinemas', count: 0 }), { type: 'buildCinemas', count: -5 })
    expect(s2.company.ownCinemas).toBe(0)
    expect(s2.company.cash).toBe(cash0)
  })

  it('投放结算：全国总数变大后，覆盖分母/上限随投放数变化', () => {
    const r0 = channelRevenue(cinemaProj(TOTAL_CINEMAS), 1000) // 自建 0：投满 5178 → ×4.0
    expect(r0.boxOffice).toBeCloseTo(1000 * CHANNEL_CONFIG.cinemaMaxMul)

    const s = createInitialState(65)
    const s2 = reduce(s, { type: 'buildCinemas', count: 1000 })
    const total = totalCinemas(s2) // 6178
    // 投满新总数 → 满覆盖上限提升到 4.5
    const rFull = channelRevenue(cinemaProj(total), 1000, total)
    expect(rFull.boxOffice).toBeCloseTo(1000 * (CHANNEL_CONFIG.cinemaMaxMul + 1000 * CHANNEL_CONFIG.cinemaMaxMulPerCinema))
    // 仍只投基础 5178 → 覆盖率 < 1，放大介于 0.9 与 4.5 之间且低于满覆盖
    const rPartial = channelRevenue(cinemaProj(TOTAL_CINEMAS), 1000, total)
    expect(rPartial.boxOffice).toBeLessThan(rFull.boxOffice)
    expect(rPartial.boxOffice).toBeGreaterThan(1000 * CHANNEL_CONFIG.cinemaBaseMul)
    // 投放成本按实际投放数计
    const cfg = { cinemaCount: total, webPlatforms: [], webWeeks: 0, dvdPrice: 0, freeAdPrice: 0 }
    expect(channelCostFor('cinema', cfg, total)).toBeCloseTo(total * CHANNEL_CONFIG.cinemaCostPerUnit)
    // 再发行/首映渠道倍数同步动态化
    const mul = channelMulFactor('cinema', cfg, 50, total)
    expect(mul).toBeCloseTo(CHANNEL_CONFIG.cinemaMaxMul + 1000 * CHANNEL_CONFIG.cinemaMaxMulPerCinema)
  })

  it('造价工具：count × 单价，非法输入归零', () => {
    expect(cinemaBuildCost(100)).toBe(100)
    expect(cinemaBuildCost(0)).toBe(0)
    expect(cinemaBuildCost(-3)).toBe(0)
  })

  it('宣发投放上限 = 全国影院总数（自建后不再钳制在基础 5178）', () => {
    const s = createInitialState(66)
    // 造一个宣发中影院项目
    const script = s.world.marketScripts[0]
    s.scripts[script.id] = script
    const p = {
      id: 'prj-m',
      name: '宣发片',
      scriptId: script.id,
      stage: 'marketing',
      channel: 'cinema',
      team: { directorId: 'w1', actorIds: [], shooterId: 'w2', editorId: 'w3', marketId: 'w4' },
      totalStages: 4,
      shotStages: 4,
      budgetAlloc: { story: 30, vfx: 20, acting: 30, edit: 20 },
      vfxLevel: 0,
      adSponsorIds: [],
      hype: 50,
      marketingBudget: 100,
      budget: 1000,
      spent: 0,
      editStyle: 'market',
      buffs: 0,
      apAdjust: 0,
      pendingEvents: [],
      cinemaCount: 0,
    } as unknown as FilmProject
    s.projects = [p]
    s.company.employeeIds = ['w1', 'w2', 'w3', 'w4']
    s.workers['w1'] = { id: 'w1', name: '甲', role: 'director' } as never

    // 未自建：上限 = 5178
    let s2 = reduce(s, { type: 'setCinemaCount', projectId: 'prj-m', count: 9000 })
    expect(s2.projects[0].cinemaCount).toBe(TOTAL_CINEMAS)
    // 自建 1000 座后：上限 = 6178
    s2 = reduce(s2, { type: 'buildCinemas', count: 1000 })
    s2 = reduce(s2, { type: 'setCinemaCount', projectId: 'prj-m', count: 9000 })
    expect(s2.projects[0].cinemaCount).toBe(TOTAL_CINEMAS + 1000)
    // 精确投放新上限内的数量不被截断
    s2 = reduce(s2, { type: 'setCinemaCount', projectId: 'prj-m', count: 6000 })
    expect(s2.projects[0].cinemaCount).toBe(6000)
  })
})
