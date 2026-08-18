import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { computeCriticReviews, computeAudienceScore, computeFilmResult } from '../rules/scoring'
import { generateReviewText } from '../config/reviews'
import type { AudienceGroup, FilmProject, GameState, SkillKey } from '../types'

function makeState(seed = 5, type: 'comedy' | 'action' = 'comedy'): GameState {
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
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 70
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  const p: FilmProject = {
    id: 'prj-r',
    name: '《评分测试》',
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

describe('评分机制（10 分制 + 文字评语 + 观众评分）', () => {
  it('影评人评分：0–10 一位小数，且带非空文字评语', () => {
    const s = makeState(7)
    const reviews = computeCriticReviews(s, s.projects[0], 75, createRng(1))
    expect(reviews.length).toBeGreaterThan(0)
    for (const r of reviews) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(10)
      expect(Number.isInteger(r.score * 10)).toBe(true) // 一位小数
      expect(r.text).toBeTruthy()
      expect(r.text!.length).toBeGreaterThan(4)
    }
  })

  it('影评类型偏好：偏好类型评分高于错配类型', () => {
    // 构造一个偏好 comedy 的影评人
    const s = makeState(9, 'comedy')
    s.world.critics = [{ id: 'c1', name: '甲', taste: 'comedy', influence: 60 }]
    const good = computeCriticReviews(s, s.projects[0], 60, createRng(1))[0].score
    // 换成动作片再看同一位影评人
    const s2 = makeState(9, 'action')
    s2.world.critics = [{ id: 'c1', name: '甲', taste: 'comedy', influence: 60 }]
    const bad = computeCriticReviews(s2, s2.projects[0], 60, createRng(1))[0].score
    expect(good).toBeGreaterThan(bad)
    expect(good - bad).toBeCloseTo(1.5, 5) // +1.0 偏好 vs −0.5 错配
  })

  it('观众评分：0–10 一位小数；类型契合高 → 观众分更高', () => {
    const s = makeState(11, 'comedy')
    s.world.audience = [mkAudience('喜剧迷', 0.9, 1.0)]
    const a = computeAudienceScore(s, s.projects[0], 60, 60, createRng(0))
    expect(a.score).toBeGreaterThanOrEqual(0)
    expect(a.score).toBeLessThanOrEqual(10)
    expect(Number.isInteger(a.score * 10)).toBe(true)
    expect(a.text.length).toBeGreaterThan(4)

    const s2 = makeState(11, 'comedy')
    s2.world.audience = [mkAudience('喜剧迷', 0.1, 1.0)] // 当地不偏好喜剧
    const b = computeAudienceScore(s2, s2.projects[0], 60, 60, createRng(0))
    expect(a.score).toBeGreaterThan(b.score)
    expect(a.score - b.score).toBeGreaterThan(1)
  })

  it('computeFilmResult：criticScore/audienceScore 均为 10 分制且入库', () => {
    const s = makeState(13)
    const result = computeFilmResult(s, s.projects[0], createRng(2))
    expect(result.criticScore).toBeGreaterThanOrEqual(0)
    expect(result.criticScore).toBeLessThanOrEqual(10)
    expect(result.audienceScore).toBeGreaterThanOrEqual(0)
    expect(result.audienceScore).toBeLessThanOrEqual(10)
    expect(result.audienceText).toBeTruthy()
  })

  it('评语生成：分数段越高文案越积极（抽查神作/烂片池非空且不同）', () => {
    const rng = createRng(1)
    const high = generateReviewText(rng, 9.2, 'action')
    const low = generateReviewText(rng, 3.1, 'action')
    expect(high.length).toBeGreaterThan(4)
    expect(low.length).toBeGreaterThan(4)
    expect(high).not.toBe(low)
  })
})

function mkAudience(name: string, comedyFocus: number, size = 0.5): AudienceGroup {
  return {
    id: `a-${name}`,
    name,
    region: '测试',
    size,
    tolerance: 0.5,
    focus: { comedy: comedyFocus, horror: 0.3, action: 0.3, love: 0.3, war: 0.3, drama: 0.3 },
  }
}
