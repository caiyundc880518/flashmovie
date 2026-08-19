import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { releaseAndFinish, advanceN } from './helpers'
import {
  allTimeFilms,
  monthlyCompanies,
  monthlyFilms,
  weeklyFilms,
  yearlyCompanies,
} from '../rules/leaderboard'
import type { GameState, SkillKey } from '../types'

/** 构造一部「宣发中」的强项目（影院），id = prj-lb */
function makeProject(seed = 42): GameState {
  let s = createInitialState(seed)
  s.company.cash = 100000
  s.company.reputation = 100
  const script = generateScript(createRng(seed + 1), 'company')
  script.id = 'scr-lb'
  script.type = 'action'
  script.scale = 10
  script.storyPoint = 90
  script.artPot = 90
  script.marketPot = 90
  s.scripts[script.id] = script
  s.company.ownedScriptIds.push(script.id)
  for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
    const w = generateWorker(createRng(seed + 2), role, 'pro')
    w.id = `w-${role}`
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 90
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  const p = {
    id: 'prj-lb',
    name: '《周结算测试片》',
    scriptId: script.id,
    stage: 'marketing' as const,
    team: {
      directorId: 'w-director',
      actorIds: ['w-actor'],
      shooterId: 'w-shooter',
      editorId: 'w-editor',
      marketId: 'w-market',
    },
    totalStages: script.scale,
    shotStages: script.scale,
    budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
    vfxLevel: 0,
    adSponsorIds: [],
    hype: 90,
    budget: 1000,
    spent: 0,
    editStyle: 'market' as const,
    buffs: 0,
    apAdjust: 0,
    pendingEvents: [],
    channel: 'cinema' as const,
    cinemaCount: 900,
    webPlatforms: [],
    webWeeks: 0,
    dvdPrice: 0,
    freeAdPrice: 0,
    warmup: 0,
    shotGameBonus: 0,
    pendingShotGame: false,
    editGameDone: true,
    editGameBonus: 0,
  }
  s.projects.push(p)
  return s
}

describe('排行榜（周结算模型）', () => {
  it('放映中影片按周进入周榜：本周榜 = 当周票房（无需等下片）', () => {
    let s = makeProject(5)
    s = reduce(s, { type: 'release', projectId: 'prj-lb', weeks: 0 })
    s = reduce(s, { type: 'advanceWeek' }) // 第 1 周结算
    const p = s.projects[0]
    expect(p.run!.status).toBe('running') // 还没下片
    const week1 = p.run!.runs[0].weekly[0]
    const list = weeklyFilms(s)
    expect(list.find((e) => e.name === p.name)!.boxOffice).toBe(week1.boxOffice)
    // 再推进一周：本周榜 = 第 2 周票房（不是累计）
    s = reduce(s, { type: 'advanceWeek' })
    const week2 = s.projects[0].run!.runs[0].weekly[1]
    expect(weeklyFilms(s).find((e) => e.name === p.name)!.boxOffice).toBe(week2.boxOffice)
    // 月榜 = 本月每周累计；总榜 = 实时累计（放映中也算）
    expect(monthlyFilms(s).find((e) => e.name === p.name)!.boxOffice).toBe(week1.boxOffice + week2.boxOffice)
    expect(allTimeFilms(s).find((e) => e.name === p.name)!.boxOffice).toBe(week1.boxOffice + week2.boxOffice)
  })

  it('公司月收入 = 本月每周分账之和（含放映中）', () => {
    let s = makeProject(6)
    s = reduce(s, { type: 'release', projectId: 'prj-lb', weeks: 0 })
    s = advanceN(s, 2)
    const sumRev = s.projects[0].run!.runs[0].weekly.reduce((a, w) => a + w.revenue, 0)
    const list = monthlyCompanies(s)
    expect(list.find((e) => e.name === s.company.name)!.revenue).toBeCloseTo(sumRev, 5)
  })

  it('首轮下片后：整段每周仍按周计入各榜（不重复、不漏）', () => {
    let s = makeProject(7)
    s = reduce(s, { type: 'release', projectId: 'prj-lb', weeks: 0 })
    s = releaseAndFinish(s, 'prj-lb')
    const p = s.projects[0]
    const total = p.run!.runs[0].weekly.reduce((a, w) => a + w.boxOffice, 0)
    expect(allTimeFilms(s).find((e) => e.name === p.name)!.boxOffice).toBe(total)
  })

  it('旧档已完结影片（无周记录）：整部按其上映周一次性计入总榜/公司收入', () => {
    let s = makeProject(8)
    s = reduce(s, { type: 'release', projectId: 'prj-lb', weeks: 0 })
    s = releaseAndFinish(s, 'prj-lb')
    const p = s.projects[0]
    const total = p.result!.boxOffice
    const rev = p.result!.revenue ?? p.result!.boxOffice * 0.45
    // 模拟 v13 迁移旧档：清空周记录
    p.run!.runs = []
    expect(allTimeFilms(s).find((e) => e.name === p.name)!.boxOffice).toBe(total)
    expect(yearlyCompanies(s).find((e) => e.name === s.company.name)!.revenue).toBeCloseTo(rev, 5)
  })

  it('对手影片按其上映周一次性计入本周/本月榜', () => {
    let s = createInitialState(10)
    s = reduce(s, { type: 'advanceWeek' })
    s = reduce(s, { type: 'advanceWeek' })
    const comp = s.world.competitors[0]
    comp.history.push({
      week: s.calendar.week,
      year: s.calendar.year,
      name: '对手片',
      ap: 70,
      mp: 70,
      boxOffice: 2500,
    })
    const w = weeklyFilms(s).find((e) => e.name === '对手片' && e.owner === comp.name)
    expect(w!.boxOffice).toBe(2500)
    expect(monthlyFilms(s).find((e) => e.name === '对手片' && e.owner === comp.name)!.boxOffice).toBe(2500)
  })
})
