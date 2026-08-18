import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { audienceFit, avgTolerance, tolerancePenalty } from '../rules/audience'
import { computeFilmResult } from '../rules/scoring'
import type { AudienceGroup, FilmProject, GameState, SkillKey } from '../types'

function makeProjectState(seed = 42, type: 'comedy' | 'action' = 'comedy'): GameState {
  let s = createInitialState(seed)
  s.company.cash = 100000
  const script = generateScript(createRng(seed + 1), 'company')
  script.id = `scr-${type}`
  script.type = type
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
  const p: FilmProject = {
    id: 'prj-aud',
    name: '《观众测试》',
    scriptId: script.id,
    stage: 'marketing',
    team: { directorId: 'w-director', actorIds: ['w-actor'], shooterId: 'w-shooter', editorId: 'w-editor', marketId: 'w-market' },
    totalStages: script.scale,
    shotStages: script.scale,
    budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
    vfxLevel: 0,
    adSponsorIds: [],
    hype: 60,
    budget: 1000,
    spent: 0,
    editStyle: 'market',
    buffs: 0,
    apAdjust: 0,
    pendingEvents: [],
    channel: 'cinema',
    cinemaCount: 50,
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

/** 构造固定观众群体：一个群体偏好 comedy，另一个偏好 action */
function withAudience(s: GameState): GameState {
  const mk = (name: string, size: number, tolerance: number): AudienceGroup => ({
    id: `aud-${name}`,
    name,
    region: '测试区',
    size,
    tolerance,
    focus: { comedy: 0.2, horror: 0.3, action: 0.2, love: 0.3, war: 0.2, drama: 0.3 },
  })
  const g1 = mk('喜剧迷', 0.7, 0.7)
  g1.focus.comedy = 0.9
  g1.focus.action = 0.2
  const g2 = mk('动作迷', 0.3, 0.3)
  g2.focus.action = 0.9
  g2.focus.comedy = 0.2
  s.world.audience = [g1, g2]
  return s
}

describe('观众群体（GDD §6）', () => {
  it('新档生成 6 个群体，覆盖 6 类型，规模占比 ≈1', () => {
    const s = createInitialState(3)
    expect(s.world.audience.length).toBe(6)
    const total = s.world.audience.reduce((sum, g) => sum + g.size, 0)
    expect(total).toBeGreaterThan(0.95)
    expect(total).toBeLessThanOrEqual(1.05)
    const mainTypes = new Set(s.world.audience.map((g) => {
      const top = (Object.keys(g.focus) as (keyof typeof g.focus)[]).sort((a, b) => g.focus[b] - g.focus[a])[0]
      return top
    }))
    expect(mainTypes.size).toBe(6)
  })

  it('观众契合：偏好类型契合度显著高于非偏好类型', () => {
    const s = withAudience(createInitialState(5))
    const comedyFit = audienceFit(s, 'comedy')
    const actionFit = audienceFit(s, 'action')
    expect(comedyFit).toBeGreaterThan(actionFit)
    expect(comedyFit).toBeGreaterThan(1)
    // 最差类型也应 ≥ fitMin
    expect(audienceFit(s, 'horror')).toBeGreaterThanOrEqual(0.8)
  })

  it('票房：偏好类型上映票房更高（同配置对比）', () => {
    const a = withAudience(makeProjectState(7, 'comedy'))
    const b = withAudience(makeProjectState(7, 'action'))
    const ra = computeFilmResult(a, a.projects[0], createRng(0))
    const rb = computeFilmResult(b, b.projects[0], createRng(0))
    expect(ra.boxOffice).toBeGreaterThan(rb.boxOffice)
  })

  it('容忍度：低口碑片在挑剔市场（低容忍度）声誉惩罚更重', () => {
    const s = withAudience(createInitialState(11))
    // 全部群体高容忍
    const lenient = structuredClone(s)
    for (const g of lenient.world.audience) g.tolerance = 0.9
    // 全部群体低容忍
    const picky = structuredClone(s)
    for (const g of picky.world.audience) g.tolerance = 0.2
    expect(tolerancePenalty(picky, 4)).toBeGreaterThan(tolerancePenalty(lenient, 4))
    expect(tolerancePenalty(picky, 4)).toBeGreaterThan(0)
    expect(tolerancePenalty(picky, 7)).toBe(0)
  })

  it('平均容忍度按规模加权', () => {
    const s = withAudience(createInitialState(13))
    const avg = avgTolerance(s)
    // 0.7×0.7 + 0.3×0.3 = 0.58
    expect(avg).toBeCloseTo(0.58, 2)
  })

  it('季度推进：第 13 周观众 focus 漂移且保持在 [0.05, 0.95]', () => {
    let s = createInitialState(17)
    s.company.cash = 100000
    const before = JSON.stringify(s.world.audience.map((g) => ({ ...g, focus: { ...g.focus } })))
    s.calendar = { year: 1, week: 12 }
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.calendar.week).toBe(13)
    const after = JSON.stringify(s.world.audience.map((g) => ({ ...g, focus: { ...g.focus } })))
    expect(after).not.toBe(before)
    for (const g of s.world.audience) {
      for (const v of Object.values(g.focus)) {
        expect(v).toBeGreaterThanOrEqual(0.05)
        expect(v).toBeLessThanOrEqual(0.95)
      }
    }
  })
})
