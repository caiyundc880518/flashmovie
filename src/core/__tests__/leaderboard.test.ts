import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import {
  allTimeFilms,
  monthlyCompanies,
  monthlyFilms,
  weeklyFilms,
  yearlyCompanies,
} from '../rules/leaderboard'

describe('排行榜', () => {
  function stateWithFilms() {
    // 推进 3 周，让当前周与第 1 周同月但不同周（周榜/月榜区分开）
    let s = createInitialState(31)
    for (let i = 0; i < 3; i++) s = reduce(s, { type: 'advanceWeek' })
    // 我方两部片：本周一部（高票房）、本月（第1周）另一部
    s.company.history.push(
      {
        name: '《本周大片》',
        scores: { story: 80, music: 70, edit: 75, acting: 80, shooting: 75, directing: 80 },
        vfx: 8,
        specific: 6,
        ap: 80,
        mp: 80,
        criticScore: 80,
        reviews: [],
        boxOffice: 3000,
        reputationGain: 2,
        groupPerformance: [],
        week: s.calendar.week,
        year: s.calendar.year,
        revenue: 1350,
      },
      {
        name: '《本月佳作》',
        scores: { story: 60, music: 60, edit: 60, acting: 60, shooting: 60, directing: 60 },
        vfx: 0,
        specific: 5,
        ap: 60,
        mp: 60,
        criticScore: 60,
        reviews: [],
        boxOffice: 1500,
        reputationGain: 1,
        groupPerformance: [],
        week: 1,
        year: s.calendar.year,
        revenue: 675,
      },
    )
    // 对手：本周一部 2500 万
    const comp = s.world.competitors[0]
    comp.history.push({
      week: s.calendar.week,
      year: s.calendar.year,
      name: '对手本周片',
      ap: 70,
      mp: 70,
      boxOffice: 2500,
    })
    comp.history.push({
      week: 1,
      year: s.calendar.year,
      name: '对手本月片',
      ap: 70,
      mp: 70,
      boxOffice: 1000,
    })
    return s
  }

  it('周票房榜：只含本周影片，按票房降序', () => {
    const s = stateWithFilms()
    const list = weeklyFilms(s)
    expect(list).toHaveLength(2)
    expect(list[0].name).toBe('《本周大片》')
    expect(list[1].name).toBe('对手本周片')
  })

  it('月票房榜：含本月（第1周与本周同月）影片', () => {
    const s = stateWithFilms()
    const list = monthlyFilms(s)
    // 本周与第 1 周在同一个月时，应含 3 部
    const names = list.map((e) => e.name)
    expect(names).toContain('《本周大片》')
    expect(names).toContain('《本月佳作》')
  })

  it('总票房榜：前 10 且含全部', () => {
    const s = stateWithFilms()
    const list = allTimeFilms(s)
    expect(list.length).toBeGreaterThanOrEqual(4)
    expect(list[0].name).toBe('《本周大片》')
  })

  it('月公司收入排行：我司 = 当月两部片收入之和', () => {
    const s = stateWithFilms()
    const list = monthlyCompanies(s)
    const me = list.find((e) => e.name === s.company.name)!
    expect(me.revenue).toBeCloseTo(1350 + 675, 5)
    // 对手当月收入 = (2500 + 1000) × 0.45
    const opp = list.find((e) => e.name === s.world.competitors[0].name)!
    expect(opp.revenue).toBeCloseTo((2500 + 1000) * 0.45, 5)
  })

  it('年公司收入排行包含我方', () => {
    const s = stateWithFilms()
    const list = yearlyCompanies(s)
    expect(list.find((e) => e.name === s.company.name)!.revenue).toBeCloseTo(1350 + 675, 5)
  })
})
