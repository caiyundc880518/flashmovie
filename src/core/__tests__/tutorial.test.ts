import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { TUTORIAL_STEPS, tutorialStep } from '../rules/tutorial'
import { generateWorker } from '../generators/workerGen'
import { createRng } from '../rng'
import type { GameState } from '../types'

describe('新手引导', () => {
  it('新档 tutorial=0，未看过欢迎；finishTutorialIntro 后置 1', () => {
    let s = createInitialState(1)
    expect(s.tutorial).toBe(0)
    s = reduce(s, { type: 'finishTutorialIntro' })
    expect(s.tutorial).toBe(1)
  })

  it('进度派生：无员工=0 → 有员工=1 → 有剧本=2 → 已立项=3 → 已上映=4 → 满 3 部=5', () => {
    let s = createInitialState(3)
    expect(tutorialStep(s)).toBe(0)

    // 有员工
    const w = generateWorker(createRng(1), 'director', 'rookie')
    w.id = 'w1'
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
    expect(tutorialStep(s)).toBe(1)

    // 有剧本
    s.company.ownedScriptIds.push('scr1')
    s.scripts['scr1'] = {
      id: 'scr1',
      title: '《剧本》',
      type: 'comedy',
      owner: 'company',
      storyPoint: 60,
      artPot: 60,
      marketPot: 60,
      famePoint: 10,
      trend: 0.5,
      scale: 8,
      price: 50,
      requirement: { genders: [], minAge: 0, maxAge: null, minExperience: 0 },
    }
    expect(tutorialStep(s)).toBe(2)

    // 已立项
    s.projects.push({
      id: 'p1',
      name: '《电影》',
      scriptId: 'scr1',
      stage: 'preparing',
      team: { actorIds: [], directorId: 'w1' },
      totalStages: 8,
      shotStages: 0,
      vfxPercent: 0,
      hasAd: false,
      hype: 0,
      marketingBudget: 0,
      budget: 100,
      spent: 0,
      editStyle: null,
      buffs: 0,
      apAdjust: 0,
      pendingEvents: [],
      channels: [],
    })
    expect(tutorialStep(s)).toBe(3)

    // 已上映 1 部
    s.company.history.push({
      name: '《电影》',
      scores: { story: 60, music: 50, edit: 55, acting: 60, shooting: 50, directing: 60 },
      vfx: 0,
      specific: 0,
      ap: 60,
      mp: 60,
      criticScore: 60,
      reviews: [],
      boxOffice: 1000,
      reputationGain: 1,
      groupPerformance: [],
      week: 10,
      year: 1,
    })
    expect(tutorialStep(s)).toBe(4)

    // 满 3 部
    s.company.history.push({ ...s.company.history[0], name: '《电影2》' })
    s.company.history.push({ ...s.company.history[0], name: '《电影3》' })
    expect(tutorialStep(s)).toBe(5)
  })

  it('步骤定义：5 步、页面合法、提示非空', () => {
    expect(TUTORIAL_STEPS.length).toBe(5)
    const pages = new Set(TUTORIAL_STEPS.map((t) => t.page))
    expect(pages.size).toBe(5)
    for (const t of TUTORIAL_STEPS) {
      expect(t.hint.length).toBeGreaterThan(10)
      expect(t.id).toBeGreaterThan(0)
    }
  })

  it('旧档无 tutorial 字段 → 视为已完成（引导不显示）', () => {
    const s = createInitialState(7) as GameState & { tutorial?: number }
    delete s.tutorial
    // 派生进度仍可算；UI 侧由 tutorial===undefined 判定不显示
    expect(s.tutorial).toBeUndefined()
    expect(tutorialStep(s)).toBe(0)
  })
})
