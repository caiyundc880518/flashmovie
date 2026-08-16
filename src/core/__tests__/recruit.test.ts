import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { RECRUIT_POOLS } from '../config/recruit'
import type { RecruitPoolId } from '../config/recruit'

/** 用指定种子抽一次档位（1 人），返回高 CA / 高 PA 占比 */
function ratioOf(seed: number, pool: RecruitPoolId) {
  let s = createInitialState(seed)
  s.company.cash = 100000
  s = reduce(s, { type: 'refreshCandidates', pool, count: 1 })
  const list = s.world.candidates
  const highCa = list.filter((w) => w.basic.ca >= 60).length / list.length
  const highPa = list.filter((w) => w.basic.pa >= 85).length / list.length
  return { count: list.length, highCa, highPa }
}

describe('招聘抽卡（单演员计价，1 抽 / 10 连）', () => {
  it('流水市场：单抽扣单价 6 万，1 人入市，刷新新闻入列', () => {
    let s = createInitialState(7)
    s.company.cash = 1000
    const before = s.world.candidates
    s = reduce(s, { type: 'refreshCandidates', pool: 'flow', count: 1 })
    expect(s.company.cash).toBe(994)
    expect(s.world.candidates).toHaveLength(1)
    expect(s.world.candidates).not.toEqual(before)
    expect(s.world.news.some((n) => n.text.includes('流水市场'))).toBe(true)
  })

  it('10 连抽：扣 9 折总价（单价×10×0.9），10 人入市', () => {
    let s = createInitialState(13)
    s.company.cash = 10000
    s = reduce(s, { type: 'refreshCandidates', pool: 'pro', count: 10 })
    expect(s.world.candidates).toHaveLength(10)
    // 职业市场单价 30：30×10×0.9 = 270
    expect(s.company.cash).toBe(10000 - 270)
  })

  it('现金不足：拒绝抽取，状态引用不变', () => {
    let s = createInitialState(11)
    s.company.cash = 10
    const before = s.world.candidates
    const rejected = reduce(s, { type: 'refreshCandidates', pool: 'academy', count: 1 })
    expect(rejected).toBe(s)
    expect(rejected.world.candidates).toBe(before)
  })

  it('各档位单价为正且可单抽', () => {
    for (const pool of RECRUIT_POOLS) {
      expect(pool.cost).toBeGreaterThan(0)
      const r = ratioOf(500 + pool.cost, pool.id)
      expect(r.count).toBe(1)
    }
  })

  it('分布特征：专业学院高 CA/高 PA 占比显著高于流水市场（40 种子平均）', () => {
    let flowCa = 0
    let flowPa = 0
    let acaCa = 0
    let acaPa = 0
    const N = 40
    for (let i = 0; i < N; i++) {
      const f = ratioOf(1000 + i, 'flow')
      const a = ratioOf(3000 + i, 'academy')
      flowCa += f.highCa
      flowPa += f.highPa
      acaCa += a.highCa
      acaPa += a.highPa
    }
    flowCa /= N
    flowPa /= N
    acaCa /= N
    acaPa /= N
    // 学院高 CA 概率 0.75 vs 流水 0.15，均值应拉开明显差距
    expect(acaCa).toBeGreaterThan(flowCa + 0.2)
    // 学院高 PA 概率 0.35 vs 流水 0.12
    expect(acaPa).toBeGreaterThan(flowPa + 0.05)
  })

  it('职业市场居中：高 CA 占比低于学院、高于流水', () => {
    let flow = 0
    let pro = 0
    let aca = 0
    const N = 30
    for (let i = 0; i < N; i++) {
      flow += ratioOf(5000 + i, 'flow').highCa
      pro += ratioOf(6000 + i, 'pro').highCa
      aca += ratioOf(7000 + i, 'academy').highCa
    }
    flow /= N
    pro /= N
    aca /= N
    expect(pro).toBeGreaterThan(flow)
    expect(pro).toBeLessThan(aca)
  })
})
