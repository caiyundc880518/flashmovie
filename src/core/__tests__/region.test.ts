import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { audienceFit, regionMarkets } from '../rules/audience'
import { releaseAndFinish } from './helpers'
import type { AudienceGroup, FilmProject, GameState, SkillKey } from '../types'

/** 两个地区市场：华东偏好喜剧，华北偏好动作 */
function makeState(seed = 1): GameState {
  const s = createInitialState(seed)
  s.company.cash = 100000
  const mk = (id: string, name: string, region: string, size: number): AudienceGroup => ({
    id,
    name,
    region,
    size,
    tolerance: 0.5,
    focus: { comedy: 0.2, horror: 0.3, action: 0.2, love: 0.3, war: 0.2, drama: 0.3 },
  })
  const g1 = mk('a1', '华东喜剧迷', '华东', 0.6)
  g1.focus.comedy = 0.9
  g1.focus.action = 0.3
  const g2 = mk('a2', '华北动作迷', '华北', 0.4)
  g2.focus.action = 0.9
  g2.focus.comedy = 0.2
  s.world.audience = [g1, g2]
  return s
}

/** 构造宣发中项目（喜剧片） */
function makeProject(s: GameState): GameState {
  const script = generateScript(createRng(s.seed + 1), 'company')
  script.id = 'scr-region'
  script.type = 'comedy'
  script.scale = 8
  s.scripts[script.id] = script
  s.company.ownedScriptIds.push(script.id)
  const roles = ['director', 'actor', 'shooter', 'editor', 'market'] as const
  for (const role of roles) {
    const w = generateWorker(createRng(s.seed + 2), role, 'pro')
    w.id = `w-${role}`
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 60
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  const p: FilmProject = {
    id: 'prj-region',
    name: '《地区测试片》',
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

describe('地区市场（GDD §6 Area）', () => {
  it('regionMarkets：按地区聚合规模与偏好（加权均值）', () => {
    const s = makeState(3)
    const regions = regionMarkets(s)
    expect(regions.length).toBe(2)
    const east = regions.find((r) => r.region === '华东')!
    expect(east.size).toBeCloseTo(0.6, 5)
    expect(east.focus.comedy).toBeCloseTo(0.9, 5)
    const north = regions.find((r) => r.region === '华北')!
    expect(north.focus.action).toBeCloseTo(0.9, 5)
    // 按规模降序
    expect(regions[0].size).toBeGreaterThanOrEqual(regions[1].size)
  })

  it('观众契合：主攻偏好地区 > 全国 > 主攻错配地区', () => {
    const s = makeState(5)
    const national = audienceFit(s, 'comedy')
    const east = audienceFit(s, 'comedy', '华东')
    const north = audienceFit(s, 'comedy', '华北')
    expect(east).toBeGreaterThan(national)
    expect(national).toBeGreaterThan(north)
    // 动作片视角：华北 > 全国 > 华东
    expect(audienceFit(s, 'action', '华北')).toBeGreaterThan(audienceFit(s, 'action'))
    expect(audienceFit(s, 'action')).toBeGreaterThan(audienceFit(s, 'action', '华东'))
  })

  it('setTargetRegion：宣发阶段可设置/清除主攻地区，其他阶段拒绝', () => {
    let s = makeProject(makeState(7))
    s = reduce(s, { type: 'setTargetRegion', projectId: 'prj-region', region: '华东' })
    expect(s.projects[0].targetRegion).toBe('华东')
    s = reduce(s, { type: 'setTargetRegion', projectId: 'prj-region', region: undefined })
    expect(s.projects[0].targetRegion).toBeUndefined()

    // 非 marketing 阶段（preparing）拒绝
    const idle = createInitialState(9)
    const script = generateScript(createRng(10), 'company')
    script.id = 'scr-x'
    script.type = 'comedy'
    idle.scripts[script.id] = script
    idle.company.ownedScriptIds.push(script.id)
    const rejected = reduce(idle, { type: 'setTargetRegion', projectId: 'prj-region', region: '华东' })
    expect(rejected).toBe(idle)
  })

  it('release：结算结果记录主攻地区', () => {
    let s = makeProject(makeState(11))
    s = reduce(s, { type: 'setTargetRegion', projectId: 'prj-region', region: '华东' })
    s = reduce(s, { type: 'release', projectId: 'prj-region', weeks: 0 })
    expect(s.projects[0].result!.targetRegion).toBe('华东')
  })

  it('主攻偏好地区 vs 错配地区：票房显著差异（同配置）', () => {
    const good = makeProject(makeState(13))
    good.projects[0].targetRegion = '华东'
    const bad = makeProject(makeState(13))
    bad.projects[0].targetRegion = '华北'
    const rGood = releaseAndFinish(good, 'prj-region')
    const rBad = releaseAndFinish(bad, 'prj-region')
    expect(rGood.projects[0].result!.boxOffice).toBeGreaterThan(rBad.projects[0].result!.boxOffice)
  })
})
