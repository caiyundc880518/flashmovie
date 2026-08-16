import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { eventVfxBonus } from '../rules/events'
import { computeFilmResult } from '../rules/scoring'
import { applyIndustryEvent } from '../tick/advance'
import { INDUSTRY_EVENTS } from '../config/events'
import type { FilmProject, GameState, SkillKey, WorldEvent } from '../types'

function makeProjectState(seed = 42): GameState {
  let s = createInitialState(seed)
  s.company.cash = 100000
  const script = generateScript(createRng(seed + 1), 'company')
  script.id = 'scr-ev'
  script.type = 'comedy'
  script.scale = 8
  s.scripts[script.id] = script
  s.company.ownedScriptIds.push(script.id)
  const roles = ['director', 'actor', 'shooter', 'editor', 'market'] as const
  for (const role of roles) {
    const w = generateWorker(createRng(seed + 2), role, 'pro')
    w.id = `w-${role}`
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 60
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  const tech = generateWorker(createRng(seed + 3), 'technician', 'pro')
  tech.id = 'w-tech'
  tech.skills.vfx = 70
  s.workers['w-tech'] = tech
  s.company.employeeIds.push('w-tech')
  const p: FilmProject = {
    id: 'prj-ev',
    name: '《事件测试》',
    scriptId: script.id,
    stage: 'marketing',
    team: { directorId: 'w-director', actorIds: ['w-actor'], shooterId: 'w-shooter', editorId: 'w-editor', marketId: 'w-market', technicianId: 'w-tech' },
    totalStages: script.scale,
    shotStages: script.scale,
    vfxPercent: 100,
    hasAd: false,
    hype: 60,
    marketingBudget: 0,
    budget: 1000,
    spent: 0,
    editStyle: 'market',
    buffs: 0,
    apAdjust: 0,
    pendingEvents: [],
    channels: ['cinema'],
  }
  s.projects.push(p)
  return s
}

function pushEvent(s: GameState, over: Partial<WorldEvent>): GameState {
  s.world.activeEvents.push({
    id: 'ev1',
    title: '测试事件',
    desc: '测试',
    kind: 'boom',
    untilWeek: 999,
    ...over,
  })
  return s
}

describe('行业随机事件（GDD §6 Random Events）', () => {
  it('事件池自洽：持续型带 weeks，即时型带效果字段', () => {
    const kinds = new Set(INDUSTRY_EVENTS.map((e) => e.kind))
    expect(kinds.has('boom')).toBe(true)
    expect(kinds.has('slump')).toBe(true)
    expect(kinds.has('typeBoom')).toBe(true)
    expect(kinds.has('tech')).toBe(true)
    expect(kinds.has('scandal')).toBe(true)
    expect(kinds.has('praise')).toBe(true)
    expect(kinds.has('grant')).toBe(true)
    for (const e of INDUSTRY_EVENTS) {
      expect(e.weight).toBeGreaterThan(0)
      if (e.weeks) {
        expect(e.boxOfficeMul || e.typeBoomMul || e.vfxBonus).toBeTruthy()
      } else {
        expect(e.fame || e.mood || e.cash).toBeTruthy()
      }
    }
  })

  it('推进 24 周（多种子）必然触发过行业事件，且过期事件被清理', () => {
    let triggered = false
    for (let seed = 100; seed < 130; seed++) {
      let s = createInitialState(seed)
      s.company.cash = 100000
      s.company.employeeIds = []
      for (let i = 0; i < 24; i++) s = reduce(s, { type: 'advanceWeek' })
      if (s.world.news.some((n) => n.text.includes('【行业事件】') || n.text.includes('【好消息】') || n.text.includes('【风波】') || n.text.includes('【喜讯】'))) {
        triggered = true
        break
      }
    }
    expect(triggered).toBe(true)
    // 过期清理：事件 untilWeek < 当前周应被移除
    let s = createInitialState(200)
    s.company.cash = 100000
    s.company.employeeIds = []
    s.calendar = { year: 1, week: 30 }
    s.world.activeEvents = [
      { id: 'exp', title: '过期', desc: 'x', kind: 'boom', untilWeek: 29, boxOfficeMul: 1.15 },
      { id: 'live', title: '有效', desc: 'y', kind: 'boom', untilWeek: 35, boxOfficeMul: 1.15 },
    ]
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.world.activeEvents.map((e) => e.id)).toEqual(['live'])
  })

  it('boom/slump 事件按乘数影响票房；typeBoom 只影响对应类型', () => {
    const base = makeProjectState(7)
    const boom = makeProjectState(7)
    pushEvent(boom, { kind: 'boom', boxOfficeMul: 1.15 })
    const slump = makeProjectState(7)
    pushEvent(slump, { kind: 'slump', boxOfficeMul: 0.85 })
    const typeBoom = makeProjectState(7)
    pushEvent(typeBoom, { kind: 'typeBoom', typeBoomMul: 1.25, type: 'action' }) // 本片 comedy，不应受影响

    const rBase = computeFilmResult(base, base.projects[0], createRng(0))
    const rBoom = computeFilmResult(boom, boom.projects[0], createRng(0))
    const rSlump = computeFilmResult(slump, slump.projects[0], createRng(0))
    const rType = computeFilmResult(typeBoom, typeBoom.projects[0], createRng(0))
    expect(rBoom.boxOffice).toBeCloseTo(rBase.boxOffice * 1.15, 0)
    expect(rSlump.boxOffice).toBeCloseTo(rBase.boxOffice * 0.85, 0)
    expect(rType.boxOffice).toBeCloseTo(rBase.boxOffice, 0)
  })

  it('tech 事件提升 VFX 分', () => {
    const base = makeProjectState(11)
    const tech = makeProjectState(11)
    pushEvent(tech, { kind: 'tech', vfxBonus: 0.15 })
    const rBase = computeFilmResult(base, base.projects[0], createRng(0))
    const rTech = computeFilmResult(tech, tech.projects[0], createRng(0))
    expect(eventVfxBonus(tech)).toBe(0.15)
    expect(rTech.vfx).toBeGreaterThan(rBase.vfx)
  })

  it('scandal：高 Fame 员工被波及，Fame/心情下降', () => {
    const s = createInitialState(13)
    s.company.cash = 100000
    s.company.employeeIds = ['w1', 'w2']
    const famous = generateWorker(createRng(1), 'actor', 'pro')
    famous.id = 'w1'
    famous.basic.fame = 80
    famous.active.mood = 70
    const unknown = generateWorker(createRng(2), 'actor', 'rookie')
    unknown.id = 'w2'
    unknown.basic.fame = 5
    s.workers['w1'] = famous
    s.workers['w2'] = unknown
    const def = INDUSTRY_EVENTS.find((e) => e.kind === 'scandal')!
    applyIndustryEvent(s, def, createRng(9))
    expect(s.workers['w1'].basic.fame).toBe(70) // 高 Fame 者被选中，-10
    expect(s.workers['w1'].active.mood).toBe(55) // -15
    expect(s.workers['w2'].basic.fame).toBe(5) // 无名者不受波及
  })

  it('grant：政府补贴到账；praise：随机员工 Fame 上升', () => {
    let s = createInitialState(15)
    s.company.cash = 1000
    const grantDef = INDUSTRY_EVENTS.find((e) => e.kind === 'grant')!
    applyIndustryEvent(s, grantDef, createRng(1))
    expect(s.company.cash).toBe(1000 + (grantDef.cash ?? 0))

    s = createInitialState(17)
    s.company.cash = 100000
    s.company.employeeIds = ['w1']
    const actor = generateWorker(createRng(3), 'actor', 'pro')
    actor.id = 'w1'
    actor.basic.fame = 50
    s.workers['w1'] = actor
    const praiseDef = INDUSTRY_EVENTS.find((e) => e.kind === 'praise')!
    applyIndustryEvent(s, praiseDef, createRng(1))
    expect(s.workers['w1'].basic.fame).toBe(58)
  })
})
