import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import {
  decideCompetitorType,
  releaseCompetitorFilm,
  scoreCompetitorFilm,
  shouldCompetitorRelease,
  playerWindowTypes,
  poachSuccessChance,
  idlePlayerWorkers,
} from '../rules/competitor'
import { competitorSummary, weeklyCompanyBoxOffice } from '../rules/competitorView'
import { generateWorker } from '../generators/workerGen'
import { createRng } from '../rng'
import type { Competitor, FilmProject, RoleId } from '../types'

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

  it('NPC 团队：新档对手自带 3–6 名员工（员工在 workers 表，不属于玩家）', () => {
    const s = createInitialState(20)
    for (const c of s.world.competitors) {
      expect(c.team.length).toBeGreaterThanOrEqual(3)
      expect(c.team.length).toBeLessThanOrEqual(6)
      for (const id of c.team) {
        expect(s.workers[id]).toBeDefined()
        expect(s.company.employeeIds).not.toContain(id)
      }
    }
  })

  it('成功率公式：报价越高/声誉差越大 → 成功率越高，且有上下限', () => {
    const s = createInitialState(25)
    const comp = s.world.competitors[0]
    const worker = s.workers[comp.team[0]]
    const low = poachSuccessChance(s, comp, worker, 0)
    const high = poachSuccessChance(s, comp, worker, worker.salary * 20)
    expect(high).toBeGreaterThan(low)
    expect(poachSuccessChance(s, comp, worker, 999999)).toBeLessThanOrEqual(0.9)
    expect(low).toBeGreaterThanOrEqual(0.05)
  })

  it('idlePlayerWorkers：只返回非项目组的空闲员工', () => {
    const s = createInitialState(26)
    const w1 = generateWorker(createRng(1), 'director')
    w1.id = 'idle1'
    const w2 = generateWorker(createRng(2), 'actor')
    w2.id = 'busy1'
    s.workers['idle1'] = w1
    s.workers['busy1'] = w2
    s.company.employeeIds = ['idle1', 'busy1']
    s.projects = [{ id: 'p1', stage: 'shooting', team: { actorIds: ['busy1'] } } as unknown as FilmProject]
    const idle = idlePlayerWorkers(s)
    expect(idle.map((w) => w.id)).toEqual(['idle1'])
  })

  it('回应对手挖角：放人 → 员工跳槽至对手团队并移出公司', () => {
    const s = createInitialState(27)
    const w = s.world.candidates[0]
    w.id = 'victim'
    s.workers['victim'] = w
    s.company.employeeIds = ['victim']
    const comp = s.world.competitors[0]
    s.world.pendingPoach = { competitorId: comp.id, workerId: 'victim', offer: 100 }
    const s2 = reduce(s, { type: 'respondPoach', keep: false })
    expect(s2.world.pendingPoach).toBeUndefined()
    expect(s2.company.employeeIds).not.toContain('victim')
    expect(s2.world.competitors[0].team).toContain('victim')
  })

  it('回应对手挖角：挽留 → 扣签字费、员工留队、待决清除', () => {
    const s = createInitialState(28)
    const w = s.world.candidates[0]
    w.id = 'victim'
    s.workers['victim'] = w
    s.company.employeeIds = ['victim']
    const comp = s.world.competitors[0]
    s.world.pendingPoach = { competitorId: comp.id, workerId: 'victim', offer: 100 }
    const s2 = reduce(s, { type: 'respondPoach', keep: true })
    expect(s2.world.pendingPoach).toBeUndefined()
    expect(s2.company.employeeIds).toContain('victim')
    expect(s2.company.cash).toBe(s.company.cash - 100)
  })

  it('挽留但资金不足 → 保持待决不变', () => {
    const s = createInitialState(29)
    const w = s.world.candidates[0]
    w.id = 'victim'
    s.workers['victim'] = w
    s.company.employeeIds = ['victim']
    const comp = s.world.competitors[0]
    s.company.cash = 50
    s.world.pendingPoach = { competitorId: comp.id, workerId: 'victim', offer: 100 }
    const s2 = reduce(s, { type: 'respondPoach', keep: true })
    expect(s2.world.pendingPoach).toBeDefined()
    expect(s2.company.cash).toBe(50)
  })

  it('玩家挖角：资金不足直接失败（无变化）', () => {
    const s = createInitialState(30)
    const comp = s.world.competitors[0]
    const wid = comp.team[0]
    s.company.cash = 10
    const s2 = reduce(s, { type: 'poachCompetitorWorker', competitorId: comp.id, workerId: wid, offer: 500 })
    expect(s2.company.cash).toBe(10)
    expect(s2.world.competitors[0].team).toContain(wid)
  })

  it('玩家挖角：高报价 + 高声誉 → 有成功；低报价 → 有失败（种子遍历确定性）', () => {
    let successes = 0
    let failures = 0
    for (let seed = 1; seed <= 60; seed++) {
      const s = createInitialState(seed)
      const comp = s.world.competitors[0]
      const wid = comp.team[0]
      const worker = s.workers[wid]
      s.company.reputation = 90
      s.company.cash = 10000
      const s2 = reduce(s, {
        type: 'poachCompetitorWorker',
        competitorId: comp.id,
        workerId: wid,
        offer: Math.round(worker.salary * 20),
      })
      if (s2.company.employeeIds.includes(wid)) successes++
      else failures++
    }
    expect(successes).toBeGreaterThan(0)
    expect(failures).toBeGreaterThan(0)
  })

  it('NPC 挖角触发：推进若干周后发起针对高价值空闲员工的挖角', () => {
    let s = createInitialState(31)
    s.company.employeeIds = []
    const rng = createRng(3)
    for (const role of ['director', 'actor'] as RoleId[]) {
      const w = generateWorker(rng, role, 'pro')
      w.id = `my-${role}`
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    let fired = false
    for (let i = 0; i < 80; i++) {
      s = reduce(s, { type: 'advanceWeek' })
      if (s.world.pendingPoach) {
        fired = true
        expect(s.company.employeeIds).toContain(s.world.pendingPoach.workerId)
        expect(
          s.world.competitors.find((c) => c.id === s.world.pendingPoach!.competitorId),
        ).toBeDefined()
        expect(s.world.pendingPoach.offer).toBeGreaterThan(0)
        break
      }
    }
    expect(fired).toBe(true)
  })

  it('竞对聚合：出片数/累计/平均/最佳统计正确', () => {
    const s = createInitialState(40)
    const c = s.world.competitors[0]
    c.history = [
      { week: 1, year: 1, name: 'A', ap: 50, mp: 50, boxOffice: 1000 },
      { week: 3, year: 1, name: 'B', ap: 60, mp: 60, boxOffice: 2000 },
      { week: 5, year: 1, name: 'C', ap: 40, mp: 40, boxOffice: 500 },
    ]
    const sum = competitorSummary(s, c)
    expect(sum.films).toBe(3)
    expect(sum.totalBoxOffice).toBe(3500)
    expect(sum.avgBoxOffice).toBe(1167)
    expect(sum.best?.name).toBe('B')
  })

  it('本周公司票房对比：我司周结算累计 + NPC 上映周一次性', () => {
    const s = createInitialState(41)
    s.calendar = { year: 1, week: 10 }
    const script = s.world.marketScripts[0]
    s.scripts[script.id] = script
    const p = {
      id: 'p1',
      name: '我司片',
      scriptId: script.id,
      stage: 'released',
      run: {
        status: 'running',
        currentRunId: 'r1',
        runs: [
          {
            id: 'r1',
            channel: 'cinema',
            isFirst: true,
            config: {},
            expectedTotal: 100,
            startWeek: 8,
            startYear: 1,
            status: 'running',
            weekly: [{ week: 10, year: 1, boxOffice: 800, revenue: 400, mp: 60, audience: 6 }],
            channelCost: 0,
          },
        ],
        releaseWeek: 8,
        releaseYear: 1,
        presale: 0,
        firstRunEnded: false,
        basePotential: 100,
      },
    } as unknown as FilmProject
    s.projects = [p]
    s.world.competitors[0].history = [{ week: 10, year: 1, name: '对手片', ap: 50, mp: 50, boxOffice: 1200 }]
    const list = weeklyCompanyBoxOffice(s)
    expect(list.find((e) => e.ours)?.boxOffice).toBe(800)
    expect(list.find((e) => e.name === s.world.competitors[0].name)?.boxOffice).toBe(1200)
  })
})
