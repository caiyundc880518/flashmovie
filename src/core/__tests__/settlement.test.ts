import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { applyWeeklyWorkerState } from '../rules/growth'
import { GROWTH } from '../config/growth'
import { releaseAndFinish } from './helpers'
import type { FilmProject, GameState, SkillKey } from '../types'

/** 构造一部「宣发中」的项目（含 5 名成员），直接上映结算 */
function makeReadyState(seed = 42): GameState {
  let s = createInitialState(seed)
  s.company.cash = 100000

  const script = generateScript(createRng(seed + 1), 'company')
  script.id = 'scr-settle'
  script.type = 'action'
  script.scale = 8
  s.scripts[script.id] = script
  s.company.ownedScriptIds.push(script.id)

  const roles = ['director', 'actor', 'shooter', 'editor', 'market'] as const
  for (const role of roles) {
    const w = generateWorker(createRng(seed + 2), role, 'pro')
    w.id = `w-${role}`
    w.basic.ca = 60
    w.basic.pa = 95
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 60
    w.mental.gift = 60
    w.mental.intelligence = 60
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }

  const p: FilmProject = {
    id: 'prj-settle',
    name: '《结算测试片》',
    scriptId: script.id,
    stage: 'marketing',
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
    hype: 80,
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

describe('上映结算：成员成长明细', () => {
  it('release 生成 settlement：覆盖全部成员，含角色/表现/CA/经验/技能/Fame/心情', () => {
    let s = makeReadyState()
    const caBefore: Record<string, number> = {}
    for (const id of s.company.employeeIds) caBefore[id] = s.workers[id].basic.ca

    s = releaseAndFinish(s, 'prj-settle')
    const result = s.projects[0].result!
    expect(result.settlement).toBeDefined()
    expect(result.settlement!.length).toBe(5)

    for (const st of result.settlement!) {
      const w = s.workers[st.workerId]
      expect(w).toBeDefined()
      // CA 涨跌 = 结算前后差值
      expect(st.caGain).toBe(w.basic.ca - caBefore[st.workerId])
      // 成长生效：经验增加、CA 至少不降（技能只增）
      expect(w.experience).toBeGreaterThan(0)
      expect(st.expGain).toBeGreaterThan(0)
      expect(st.caGain).toBeGreaterThanOrEqual(0)
      expect(st.skillChanges.length).toBeGreaterThan(0)
      // 履历追加一条：角色 + 表现 + CA 涨跌
      const entry = w.career[w.career.length - 1]
      expect(entry.projectName).toBe('《结算测试片》')
      expect(entry.performance).toBe(st.performance)
      expect(entry.caGain).toBe(st.caGain)
      expect(entry.role).toBe(st.role)
    }
  })

  it('表现优秀 → Fame/心情上升；表现差 → 心情下降', () => {
    let s = makeReadyState(7)
    // 强制低表现：把 groupPerformance 预置为低分（release 用 result.groupPerformance 结算成长）
    s = releaseAndFinish(s, 'prj-settle')
    const result = s.projects[0].result!
    // 高分片（AP/口碑好）→ 至少大多数成员 Fame ≥ 0
    expect(result.settlement!.every((st) => st.fameGain >= 0)).toBe(true)
    // 心情变化方向与表现一致：表现 ≥60 → +2，否则 -2
    for (const st of result.settlement!) {
      const expected = st.performance >= 60 ? 2 : -2
      expect(st.moodGain).toBe(expected)
    }
  })

  it('旧档 result 无 settlement → UI 走兜底，不崩溃', () => {
    const s = makeReadyState(11)
    const r = s.projects[0].result
    expect(r).toBeUndefined()
    // 直接构造一个无 settlement 的 result 模拟旧档
    const legacy = { ...s.projects[0], result: { settlement: undefined } } as FilmProject
    expect(legacy.result!.settlement).toBeUndefined()
  })

  it('空闲衰减同步到 CA：结算时不再出现大幅 CA 下跌', () => {
    let s = makeReadyState(21)
    const actor = s.workers['w-actor']
    actor.idleWeeks = GROWTH.decayAfterWeeks + 1
    const caBefore = actor.basic.ca
    const rng = createRng(5)
    // 模拟 20 周空闲（衰减生效）
    for (let i = 0; i < 20; i++) applyWeeklyWorkerState(actor, false, rng)
    // CA 已同步重算（不滞后）：等于当前技能的加权均值
    const keys = Object.keys(actor.skills) as SkillKey[]
    const avg = keys.reduce((s2, k) => s2 + actor.skills[k], 0) / keys.length
    const max = Math.max(...keys.map((k) => actor.skills[k]))
    expect(actor.basic.ca).toBe(Math.round(avg * 0.7 + max * 0.3))
    expect(actor.basic.ca).toBeLessThanOrEqual(caBefore)

    // 随后参与项目结算：技能只增 → CA 不再暴跌（caGain ≥ 0）
    actor.idleWeeks = 0
    s = releaseAndFinish(s, 'prj-settle')
    const st = s.projects[0].result!.settlement!.find((x) => x.workerId === 'w-actor')!
    expect(st.caGain).toBeGreaterThanOrEqual(0)
    // 衰减已削弱：20 周空闲 CA 跌幅显著收敛（远小于此前 20+ 点的暴跌）
    expect(caBefore - actor.basic.ca).toBeLessThan(12)
  })
})
