import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { TECH_CONFIG, TECH_LINES, techLevel } from '../config/tech'
import { techLevelOf, techProgressInLevel } from '../rules/tech'
import { computeFilmResult, vfxTypeFactor } from '../rules/scoring'
import type { FilmProject, GameState, SkillKey } from '../types'

/** 构造一个宣发中项目（含技术员） */
function makeProjectState(seed = 9, technician = true): GameState {
  let s = createInitialState(seed)
  s.company.cash = 100000
  const script = generateScript(createRng(seed + 1), 'company')
  script.id = 'scr-tech'
  script.type = 'action'
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
  if (technician) {
    const tech = generateWorker(createRng(seed + 3), 'technician', 'pro')
    tech.id = 'w-tech'
    tech.skills.vfx = 80
    s.workers['w-tech'] = tech
    s.company.employeeIds.push('w-tech')
  }

  const p: FilmProject = {
    id: 'prj-tech',
    name: '《科技测试片》',
    scriptId: script.id,
    stage: 'marketing',
    team: {
      directorId: 'w-director',
      actorIds: ['w-actor'],
      shooterId: 'w-shooter',
      editorId: 'w-editor',
      marketId: 'w-market',
      technicianId: technician ? 'w-tech' : undefined,
    },
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

describe('科技树（VFX Tech）', () => {
  it('等级推导：进度每满 100 升 1 级，上限 3 级', () => {
    const tech: Record<string, number> = {}
    expect(techLevel(tech, 'render', 3)).toBe(0)
    tech.render = 99
    expect(techLevel(tech, 'render', 3)).toBe(0)
    tech.render = 100
    expect(techLevel(tech, 'render', 3)).toBe(1)
    tech.render = 250
    expect(techLevel(tech, 'render', 3)).toBe(2)
    tech.render = 9999
    expect(techLevel(tech, 'render', 3)).toBe(3)
  })

  it('investTech：扣费、进度增长、无技术员效率 = 基础值', () => {
    let s = createInitialState(5)
    s.company.cash = 1000
    s = reduce(s, { type: 'investTech', lineId: 'render' })
    expect(s.company.cash).toBe(1000 - TECH_CONFIG.investCost)
    expect(s.company.tech.render).toBe(TECH_CONFIG.progressPerInvest)
    expect(techProgressInLevel(s.company.tech, 'render')).toBe(TECH_CONFIG.progressPerInvest)
  })

  it('investTech：技术员 VFX 技能越高进度越多；现金不足拒绝', () => {
    const noTech = createInitialState(11)
    noTech.company.cash = 1000
    const withTech = createInitialState(12)
    withTech.company.cash = 1000
    const tech = generateWorker(createRng(99), 'technician', 'pro')
    tech.id = 't1'
    tech.skills.vfx = 100
    withTech.company.employeeIds.push(tech.id)
    withTech.workers[tech.id] = tech

    const r1 = reduce(noTech, { type: 'investTech', lineId: 'studio' })
    const r2 = reduce(withTech, { type: 'investTech', lineId: 'studio' })
    expect(r2.company.tech.studio).toBeGreaterThan(r1.company.tech.studio)

    const poor = createInitialState(13)
    poor.company.cash = 10
    const rejected = reduce(poor, { type: 'investTech', lineId: 'studio' })
    expect(rejected).toBe(poor)
    expect(rejected.company.tech.studio).toBeUndefined()
  })

  it('研发跨级时推送升级新闻', () => {
    let s = createInitialState(17)
    s.company.cash = 100000
    s.company.tech.render = 95
    s = reduce(s, { type: 'investTech', lineId: 'render' })
    expect(s.company.tech.render).toBeGreaterThanOrEqual(100)
    expect(techLevelOf(s, 'render')).toBe(1)
    expect(s.world.news.some((n) => n.text.includes('渲染引擎') && n.text.includes('科技突破'))).toBe(true)
  })

  it('渲染引擎抬升 VFX 分上限，特效合成整体加成', () => {
    let s = makeProjectState(21)
    const before = computeFilmResult(s, s.projects[0], createRng(0))
    s.company.tech.render = 200 // Lv.2 → 上限 +8
    s.company.tech.comp = 100 // Lv.1 → +6%
    const after = computeFilmResult(s, s.projects[0], createRng(0))
    expect(after.vfx).toBeGreaterThan(before.vfx)
    // 上限确实提高：满 VFX 投入下分数超过原 tier.max
    expect(after.vfx).toBeGreaterThanOrEqual(before.vfx * 1.05)
  })

  it('虚拟制片降低立项预算（VFX 成本折扣）', () => {
    const mk = () => {
      const s = createInitialState(23)
      s.company.cash = 100000
      const script = generateScript(createRng(24), 'company')
      script.id = `scr-${Math.random().toString(36).slice(2)}`
      script.scale = 8
      s.scripts[script.id] = script
      s.company.ownedScriptIds.push(script.id)
      return { s, scriptId: script.id }
    }
    const a = mk()
    const b = mk()
    b.s.company.tech.studio = 200 // Lv.2 → 成本 −20%
    const team = { directorId: 'd', actorIds: ['a'], shooterId: 's', editorId: 'e', marketId: 'm' }
    const r1 = reduce(a.s, { type: 'startProject', scriptId: a.scriptId, team, vfxPercent: 100, hasAd: false })
    const r2 = reduce(b.s, { type: 'startProject', scriptId: b.scriptId, team, vfxPercent: 100, hasAd: false })
    expect(r2.projects[0].budget).toBeLessThan(r1.projects[0].budget)
    // 折扣比例 ≈ 0.5 × 0.2 相对原预算
    const orig = r1.projects[0].budget
    const discounted = r2.projects[0].budget
    expect(discounted).toBeCloseTo(orig - orig * (0.5 / 1.5) * 0.2, 1)
  })

  it('动作捕捉增强动作/战争类型特效系数，不影响其他类型', () => {
    expect(vfxTypeFactor('action', 0.1)).toBeCloseTo(1.32, 2)
    expect(vfxTypeFactor('war', 0.15)).toBeCloseTo(1.38, 2)
    expect(vfxTypeFactor('comedy', 0.15)).toBeCloseTo(0.85, 2)
  })

  it('满级后继续投入被拒绝', () => {
    let s = createInitialState(31)
    s.company.cash = 100000
    s.company.tech.mocap = 300 // 满级
    const rejected = reduce(s, { type: 'investTech', lineId: 'mocap' })
    expect(rejected).toBe(s)
  })

  it('TECH_LINES 配置自洽：4 条线、各 3 级、效果文案可用', () => {
    expect(TECH_LINES.length).toBe(4)
    for (const line of TECH_LINES) {
      expect(line.maxLevel).toBe(3)
      expect(line.values.length).toBe(line.maxLevel)
      for (let lv = 1; lv <= line.maxLevel; lv++) {
        const text = line.effectText(lv)
        expect(text.length).toBeGreaterThan(4)
        expect(/[+−×]/.test(text)).toBe(true)
      }
    }
  })
})
