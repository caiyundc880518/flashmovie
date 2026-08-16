import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { IPO_CONFIG, SCHOOL_CONFIG } from '../config/company'
import { ECONOMY } from '../config/economy'
import type { GameState } from '../types'

/** 构造一个接近上市条件的公司 */
function makeRichState(seed = 3): GameState {
  let s = createInitialState(seed)
  s.company.cash = 10000
  s.company.reputation = 70
  s.company.history = [
    {
      name: '《成名作》',
      scores: { story: 80, music: 70, edit: 75, acting: 80, shooting: 70, directing: 75 },
      vfx: 0,
      specific: 0,
      ap: 80,
      mp: 75,
      criticScore: 80,
      reviews: [],
      boxOffice: 12000,
      reputationGain: 3,
      groupPerformance: [],
      week: 10,
      year: 1,
      revenue: 17000,
    },
  ]
  return s
}

describe('IPO 上市（GDD §3.1）', () => {
  it('条件不足：声誉或累计收入不达标时拒绝', () => {
    let s = createInitialState(5)
    s.company.cash = 10000
    s.company.reputation = 50 // 声誉不足
    s.company.history = [{ name: 'x', scores: { story: 0, music: 0, edit: 0, acting: 0, shooting: 0, directing: 0 }, vfx: 0, specific: 0, ap: 0, mp: 0, criticScore: 0, reviews: [], boxOffice: 10000, reputationGain: 0, groupPerformance: [], week: 1, year: 1, revenue: 9000 }]
    const rejected1 = reduce(s, { type: 'ipo' })
    expect(rejected1).toBe(s)

    s = makeRichState(7)
    s.company.reputation = 80
    s.company.history[0].revenue = 1000 // 收入不足
    const rejected2 = reduce(s, { type: 'ipo' })
    expect(rejected2).toBe(s)
  })

  it('条件达标：融资入账、上市状态与新闻', () => {
    let s = makeRichState(9)
    const cashBefore = s.company.cash
    const valuation = Math.round(70 * IPO_CONFIG.valuationPerRep + 17000 * IPO_CONFIG.valuationRevenueRatio)
    const raised = Math.round(valuation * IPO_CONFIG.raiseRatio)
    s = reduce(s, { type: 'ipo' })
    expect(s.company.public).toBeDefined()
    expect(s.company.public!.raised).toBe(raised)
    expect(s.company.cash).toBe(cashBefore + raised)
    expect(s.world.news.some((n) => n.text.includes('上市'))).toBe(true)
  })

  it('上市后贷款额度提升：额度 = 现金 × 5（原 ×3）', () => {
    const pre = makeRichState(11)
    pre.company.public = undefined
    pre.company.cash = 1000
    pre.company.reputation = 70
    pre.company.history = []
    const post = makeRichState(13)
    post.company.public = { week: 1, year: 1, raised: 1000 }
    post.company.cash = 1000

    const r1 = reduce(pre, { type: 'takeLoan', amount: 4000 })
    expect(r1.company.cash).toBe(4000) // 借到上限 1000×3=3000
    const r2 = reduce(post, { type: 'takeLoan', amount: 4000 })
    expect(r2.company.cash).toBe(5000) // 借满 4000（上限 1000×5=5000）
    expect(r2.company.loans[0].principal).toBe(4000)
    expect(r1.company.loans[0].principal).toBe(3000)
  })

  it('上市后写作学校可升级到 5 级；未上市上限 3 级', () => {
    let s = makeRichState(15)
    s.company.public = { week: 1, year: 1, raised: 1000 }
    s.company.cash = 100000
    for (let i = 0; i < 5; i++) {
      s = reduce(s, { type: 'upgradeSchool' })
    }
    expect(s.company.schoolLevel).toBe(SCHOOL_CONFIG.maxLevelPublic)
    // 已满级，再升被拒绝
    const done = reduce(s, { type: 'upgradeSchool' })
    expect(done).toBe(s)

    // 未上市：只能到 3 级
    let t = makeRichState(17)
    t.company.cash = 100000
    for (let i = 0; i < 5; i++) t = reduce(t, { type: 'upgradeSchool' })
    expect(t.company.schoolLevel).toBe(SCHOOL_CONFIG.maxLevel)
  })

  it('季度分红：上市后第 13 周支付股东分红（现金 3% 保底 50）', () => {
    let s = makeRichState(19)
    s.company.public = { week: 1, year: 1, raised: 1000 }
    s.company.employeeIds = []
    s.company.cash = 2000
    s.calendar = { year: 1, week: 12 }
    s = reduce(s, { type: 'advanceWeek' })
    // 2000×0.03=60 > 50 保底；再扣周办公成本 5
    expect(s.company.cash).toBe(2000 - 5 - 100)
    expect(s.world.news.some((n) => n.text.includes('股东分红'))).toBe(true)
  })

  it('上市后 IP 季度授权收入 ×1.5', () => {
    let s = makeRichState(21)
    s.company.public = { week: 1, year: 1, raised: 1000 }
    s.company.employeeIds = []
    s.company.cash = 1000
    s.company.ips = [
      { id: 'ip1', name: '《系列》', type: 'action', entry: 1, originWeek: 1, originYear: 1, totalBoxOffice: 2000, bestBoxOffice: 2000, bestCriticScore: 75, level: 1, royaltyPerQuarter: 12, sequelBonus: 1.05, royaltyEarned: 0, films: ['p1'] },
    ]
    s.calendar = { year: 1, week: 12 }
    s = reduce(s, { type: 'advanceWeek' })
    // 1000 - 5 办公 = 995；+18 IP 授权 = 1013；分红 = max(50, 1013×5%≈51) = 51 → 962
    expect(s.company.cash).toBe(962)
    expect(s.company.ips[0].royaltyEarned).toBe(18)
  })

  it('累计收入对旧档缺 revenue 的兼容：用票房 × 影院分账兜底', () => {
    const s = makeRichState(23)
    s.company.history[0].revenue = undefined
    const fallback = s.company.history[0].boxOffice * ECONOMY.cinemaShare
    const total = s.company.history.reduce(
      (sum, r) => sum + (r.revenue ?? r.boxOffice * ECONOMY.cinemaShare),
      0,
    )
    expect(total).toBe(fallback)
  })
})
