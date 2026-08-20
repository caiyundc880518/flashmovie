import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import {
  decideCompetitorType,
  releaseCompetitorFilm,
  scoreCompetitorFilm,
  shouldCompetitorRelease,
  playerWindowTypes,
} from '../rules/competitor'
import { createRng } from '../rng'
import type { Competitor, FilmProject } from '../types'

function makeCompetitor(over: Partial<Competitor> = {}): Competitor {
  return {
    id: 'comp-x',
    name: '测试影业',
    reputation: 50,
    nextReleaseIn: 1,
    history: [],
    personality: 'balanced',
    cash: 1000,
    team: [],
    ips: [],
    ...over,
  }
}

/** 造一个玩家待映项目（本周开映，指定类型） */
function makePlayerPresale(s: ReturnType<typeof createInitialState>, type: string, releaseWeek: number): void {
  const script = s.world.marketScripts[0]
  script.type = type as never
  s.scripts[script.id] = script
  const p = {
    id: 'prj-p',
    name: '玩家片',
    scriptId: script.id,
    stage: 'released',
    run: {
      status: 'presale',
      currentRunId: null,
      runs: [],
      releaseWeek,
      releaseYear: s.calendar.year,
      presale: 100,
      firstRunEnded: false,
      basePotential: 2000,
    },
  } as unknown as FilmProject
  s.projects = [p]
}

describe('NPC AI（阶段 2：感知决策 + 口碑闭环）', () => {
  it('类型决策：专精型显著倾向 homeTypes', () => {
    const s = createInitialState(11)
    const c = makeCompetitor({ personality: 'specialist', homeTypes: ['war', 'action'] })
    const counts: Record<string, number> = { war: 0, action: 0, other: 0 }
    for (let i = 0; i < 200; i++) {
      const t = decideCompetitorType(s, c, createRng(i + 1))
      if (t === 'war' || t === 'action') counts[t]++
      else counts.other++
    }
    expect(counts.war + counts.action).toBeGreaterThan(counts.other)
  })

  it('类型决策：狙击型撞玩家窗口类型', () => {
    const s = createInitialState(12)
    makePlayerPresale(s, 'horror', s.calendar.week)
    const c = makeCompetitor({ personality: 'sniper' })
    const picks = new Set<string>()
    for (let i = 0; i < 120; i++) {
      picks.add(decideCompetitorType(s, c, createRng(i + 100)))
    }
    // 玩家窗口内是 horror：狙击型应高频出现 horror（占比明显高于随机 1/6）
    let horror = 0
    for (let i = 0; i < 200; i++) {
      if (decideCompetitorType(s, c, createRng(i + 200)) === 'horror') horror++
    }
    expect(horror).toBeGreaterThan(60)
    expect(picks.size).toBeGreaterThan(1)
  })

  it('档期决策：拥挤时稳健/品质型避让，狙击/快发型照常', () => {
    let s = createInitialState(13)
    // 造拥挤：本周已有 3 部上映片
    s.world.competitors = [
      makeCompetitor({ history: [{ week: s.calendar.week, year: s.calendar.year, name: 'a', ap: 50, mp: 50, boxOffice: 500 }] }),
      makeCompetitor({ history: [{ week: s.calendar.week, year: s.calendar.year, name: 'b', ap: 50, mp: 50, boxOffice: 500 }] }),
      makeCompetitor({ history: [{ week: s.calendar.week, year: s.calendar.year, name: 'c', ap: 50, mp: 50, boxOffice: 500 }] }),
    ]
    const quality = makeCompetitor({ personality: 'quality' })
    const sniper = makeCompetitor({ personality: 'sniper' })
    const volume = makeCompetitor({ personality: 'volume' })
    expect(shouldCompetitorRelease(s, quality, createRng(1))).toBe(false)
    expect(quality.nextReleaseIn).toBeGreaterThan(0) // 已推迟
    expect(shouldCompetitorRelease(s, sniper, createRng(2))).toBe(true)
    expect(shouldCompetitorRelease(s, volume, createRng(3))).toBe(true)
  })

  it('口碑闭环：影评/观众分在 [0,10]，票房为正且随事件乘数变化', () => {
    const s = createInitialState(14)
    const r1 = scoreCompetitorFilm(s, 'action', 70, 70, createRng(5))
    expect(r1.criticScore).toBeGreaterThanOrEqual(0)
    expect(r1.criticScore).toBeLessThanOrEqual(10)
    expect(r1.audienceScore).toBeGreaterThanOrEqual(0)
    expect(r1.audienceScore).toBeLessThanOrEqual(10)
    expect(r1.boxOffice).toBeGreaterThan(0)
    // 行业寒潮 → 票房乘数下降
    s.world.activeEvents = [{ id: 'e1', title: '寒潮', desc: 'x', kind: 'slump', untilWeek: s.calendar.week + 5, boxOfficeMul: 0.85 }]
    const r2 = scoreCompetitorFilm(s, 'action', 70, 70, createRng(6))
    expect(r2.boxOffice).toBeLessThan(r1.boxOffice)
  })

  it('releaseCompetitorFilm：产出带类型/口碑的影片，声誉随 MP 微调', () => {
    const s = createInitialState(15)
    const c = makeCompetitor({ reputation: 40 })
    const film = releaseCompetitorFilm(s, c, createRng(7))
    expect(film.type).toBeDefined()
    expect(typeof film.criticScore).toBe('number')
    expect(typeof film.audienceScore).toBe('number')
    expect(film.boxOffice).toBeGreaterThan(0)
    expect(c.history).toHaveLength(1)
    expect(c.history[0].name).toBe(film.name)
    expect(c.reputation).toBe(40 + (film.mp >= 50 ? 1 : -1))
    expect(c.nextType).toBe(film.type)
  })

  it('playerWindowTypes：只收集玩家上映窗口内的类型', () => {
    const s = createInitialState(16)
    makePlayerPresale(s, 'comedy', s.calendar.week)
    const types = playerWindowTypes(s)
    expect(types).toContain('comedy')
  })

  it('长线经营：高票房新片沉淀为 IP（票房 ≥ 阈值）', () => {
    const s = createInitialState(17)
    // 造有利环境：潮流 action + 行业景气，无竞争
    s.world.trend = { type: 'action', untilWeek: s.calendar.week + 20 }
    s.world.activeEvents = [{ id: 'e1', title: '景气', desc: 'x', kind: 'boom', untilWeek: s.calendar.week + 10, boxOfficeMul: 1.15 }]
    s.world.competitors = []
    const c = makeCompetitor({ personality: 'specialist', homeTypes: ['action'], reputation: 70, cash: 3000 })
    let high = 0
    for (let i = 0; i < 8; i++) {
      const film = releaseCompetitorFilm(s, c, createRng(i + 50))
      if (film.boxOffice >= 1500) high++
    }
    expect(high).toBeGreaterThan(0)
    expect(c.ips.length).toBeGreaterThan(0)
    // 每部沉淀 IP 都满足阈值（续作会在 films 上累加）
    for (const ip of c.ips) {
      expect(ip.films).toBeGreaterThanOrEqual(1)
      expect(ip.totalBoxOffice).toBeGreaterThanOrEqual(1500)
    }
  })

  it('长线经营：同类型 IP 存在时按性格概率拍续作（片名带序号、部数累加）', () => {
    const s = createInitialState(18)
    s.world.trend = { type: 'war', untilWeek: s.calendar.week + 20 }
    s.world.competitors = []
    const c = makeCompetitor({
      personality: 'specialist',
      homeTypes: ['war'],
      reputation: 70,
      cash: 5000,
      ips: [{ id: 'ip1', name: '长津湖畔', type: 'war', films: 2, totalBoxOffice: 8000 }],
    })
    let sequels = 0
    for (let i = 0; i < 40; i++) {
      const film = releaseCompetitorFilm(s, c, createRng(i + 100))
      if (film.name.startsWith('长津湖畔 3')) sequels++
    }
    expect(sequels).toBeGreaterThan(0)
    expect(c.ips[0].films).toBeGreaterThan(2)
    expect(c.ips[0].totalBoxOffice).toBeGreaterThan(8000)
  })

  it('长线经营：破产救急——cash<0 时推进一周注资并歇业 8–12 周', () => {
    const s = createInitialState(19)
    s.company.employeeIds = []
    s.world.competitors[0].cash = -100
    s.world.competitors[0].nextReleaseIn = 0
    const s2 = reduce(s, { type: 'advanceWeek' })
    const c = s2.world.competitors[0]
    expect(c.cash).toBeGreaterThan(0)
    expect(c.nextReleaseIn).toBeGreaterThanOrEqual(8)
    expect(c.nextReleaseIn).toBeLessThanOrEqual(12)
  })
})
