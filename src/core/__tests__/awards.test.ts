import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'
import { applyAwardEffects, computeYearAwards } from '../rules/awards'
import { TMA_CONFIG } from '../config/company'
import type { FilmResult } from '../types'

const BASE_SCORES = { story: 50, music: 50, edit: 50, acting: 50, shooting: 50, directing: 50 }

function makeOurFilm(name: string, over: Partial<FilmResult>): FilmResult {
  return {
    name,
    scores: { ...BASE_SCORES },
    vfx: 0,
    specific: 5,
    ap: 50,
    mp: 50,
    criticScore: 50,
    reviews: [],
    boxOffice: 100,
    reputationGain: 0,
    groupPerformance: [],
    week: 10,
    year: 1,
    revenue: 100,
    ...over,
  }
}

describe('TMA 颁奖', () => {
  function setup() {
    const s = createInitialState(41)
    // 对手片综合分更高 → 应拿最佳影片
    s.world.competitors[0].history.push({
      week: 10,
      year: 1,
      name: '对手神作',
      ap: 90,
      mp: 90,
      boxOffice: 5000,
    })
    // 我方片1：导演/表演强
    s.company.history.push(
      makeOurFilm('《我方佳片》', {
        scores: { story: 60, music: 50, edit: 55, acting: 85, shooting: 60, directing: 90 },
        ap: 75,
        mp: 60,
        groupPerformance: [
          { workerId: 'w-dir', role: 'director', performance: 90 },
          { workerId: 'w-act', role: 'actor', performance: 85 },
        ],
      }),
    )
    // 我方片2：摄影/剪辑/特效强
    s.company.history.push(
      makeOurFilm('《我方特效片》', {
        scores: { story: 55, music: 50, edit: 88, acting: 50, shooting: 90, directing: 50 },
        vfx: 22,
        groupPerformance: [
          { workerId: 'w-shoot', role: 'shooter', performance: 92 },
          { workerId: 'w-edit', role: 'editor', performance: 88 },
          { workerId: 'w-tech', role: 'technician', performance: 80 },
        ],
      }),
    )
    return s
  }

  it('评选结果：最佳影片对全体影片，个人奖从我方分项数据', () => {
    const s = setup()
    const ceremony = computeYearAwards(s, 1)
    const byCat = Object.fromEntries(ceremony.winners.map((w) => [w.category, w]))

    expect(byCat['最佳影片'].filmName).toBe('对手神作')
    expect(byCat['最佳影片'].ours).toBe(false)
    expect(byCat['最佳导演'].workerId).toBe('w-dir')
    expect(byCat['最佳演员'].workerId).toBe('w-act')
    expect(byCat['最佳摄影'].workerId).toBe('w-shoot')
    expect(byCat['最佳剪辑'].workerId).toBe('w-edit')
    expect(byCat['最佳特效'].workerId).toBe('w-tech')
    expect(byCat['最佳特效'].filmName).toBe('《我方特效片》')
  })

  it('颁奖效果：得奖员工 Fame+10、获奖履历、声誉提升', () => {
    const s = setup()
    s.workers['w-dir'] = generateWorker(createRng(1), 'director')
    s.workers['w-act'] = generateWorker(createRng(2), 'actor')
    const fameBefore = s.workers['w-dir'].basic.fame
    const repBefore = s.company.reputation
    const ceremony = computeYearAwards(s, 1)
    applyAwardEffects(s, ceremony)
    expect(s.workers['w-dir'].basic.fame).toBe(
      Math.min(100, fameBefore + TMA_CONFIG.workerFameGain),
    )
    expect(s.workers['w-dir'].awards.length).toBeGreaterThan(0)
    expect(s.workers['w-dir'].awards[0].award).toBe('最佳导演')
    expect(s.workers['w-dir'].awards[0].year).toBe(ceremony.year)
    // 我方获 5 个个人奖 + 声誉加成
    expect(s.company.reputation).toBeGreaterThan(repBefore)
  })

  it('累计获奖数：awardCount 按获奖累加到对应影片', () => {
    const s = setup()
    s.workers['w-dir'] = generateWorker(createRng(1), 'director')
    s.workers['w-act'] = generateWorker(createRng(2), 'actor')
    const ceremony = computeYearAwards(s, 1)
    applyAwardEffects(s, ceremony)
    // 我方个人奖影片各累加 1；重复颁奖（跨年）继续累加
    const film = s.company.history.find((h) => h.name === '《我方特效片》')
    expect(film?.awardCount).toBeGreaterThanOrEqual(1)
    applyAwardEffects(s, ceremony)
    expect(s.company.history.find((h) => h.name === '《我方特效片》')?.awardCount).toBeGreaterThanOrEqual(2)
  })

  it('获奖名单：awards 记录奖项类别、获奖者与年份', () => {
    const s = setup()
    s.workers['w-dir'] = generateWorker(createRng(1), 'director')
    s.workers['w-act'] = generateWorker(createRng(2), 'actor')
    const tech = generateWorker(createRng(3), 'technician')
    tech.id = 'w-tech'
    s.workers['w-tech'] = tech
    const techName = tech.name
    const ceremony = computeYearAwards(s, 1)
    applyAwardEffects(s, ceremony)
    const film = s.company.history.find((h) => h.name === '《我方特效片》')
    expect(film?.awards?.length).toBeGreaterThanOrEqual(1)
    const vfxAward = film!.awards!.find((a) => a.category === '最佳特效')
    expect(vfxAward).toBeDefined()
    expect(vfxAward!.workerName).toBe(techName)
    expect(vfxAward!.year).toBe(ceremony.year)
  })

  it('颁奖同步写回项目实时 result：详情页获奖 TAB / 项目卡片 🏆 徽标可见', () => {
    // 模拟真实流程：released 项目 + 其 result 的浅克隆进 history（finalizeFirstRun 的做法）
    const s = createInitialState(50)
    const result = makeOurFilm('《获奖片》', {
      scores: { story: 60, music: 50, edit: 90, acting: 50, shooting: 90, directing: 50 },
      vfx: 20,
      groupPerformance: [
        { workerId: 'w-x', role: 'shooter', performance: 90 },
        { workerId: 'w-y', role: 'editor', performance: 90 },
        { workerId: 'w-z', role: 'technician', performance: 90 },
      ],
    })
    const proj = {
      id: 'prj-a',
      name: '《获奖片》',
      scriptId: 'scr-a',
      stage: 'released' as const,
      team: { directorId: 'w-d', actorIds: [] as string[] },
      totalStages: 1,
      shotStages: 1,
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
      hype: 50,
      budget: 100,
      spent: 100,
      editStyle: 'market' as const,
      buffs: 0,
      apAdjust: 0,
      pendingEvents: [],
      channel: 'cinema' as const,
      cinemaCount: 100,
      webPlatforms: [],
      webWeeks: 0,
      dvdPrice: 0,
      freeAdPrice: 0,
      warmup: 0,
      shotGameBonus: 0,
      pendingShotGame: false,
      editGameDone: true,
      editGameBonus: 0,
      result,
    } as any
    s.projects.push(proj)
    s.company.history.push({ ...result })
    const ceremony = computeYearAwards(s, 1)
    applyAwardEffects(s, ceremony)
    // 项目详情页/卡片读取的 p.result 应有获奖记录
    expect(proj.result!.awards?.length).toBeGreaterThanOrEqual(1)
    expect(proj.result!.awardCount).toBeGreaterThanOrEqual(1)
    // 与历史快照保持一致
    const hist = s.company.history.find((h) => h.name === '《获奖片》')!
    expect(hist.awardCount).toBe(proj.result!.awardCount)
    expect(hist.awards!.length).toBe(proj.result!.awards!.length)
  })

  it('跨年集成：推进一整年产生颁奖典礼', () => {
    let s = createInitialState(43)
    s.company.cash = 10000
    // 快速拍一部片
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    const rng = createRng(44)
    const roles = ['director', 'actor', 'shooter', 'editor', 'market'] as const
    for (const role of roles) {
      const w = generateWorker(rng, role)
      w.id = `e-${role}`
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team: {
        directorId: 'e-director',
        actorIds: ['e-actor'],
        shooterId: 'e-shooter',
        editorId: 'e-editor',
        marketId: 'e-market',
      },
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
    for (let i = 0; i < 30 && s.projects[0].stage === 'shooting'; i++) {
      s = reduce(s, { type: 'advanceWeek' })
      for (const ev of [...s.projects[0].pendingEvents]) {
        s = reduce(s, { type: 'resolveEvent', projectId: pid, eventId: ev.id, optionIndex: 0 })
      }
      if (s.projects[0].pendingShotGame) {
        s = reduce(s, { type: 'applyShotGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
      }
    }
    s = reduce(s, { type: 'applyEditGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    s = reduce(s, { type: 'chooseEditStyle', projectId: pid, style: 'market' })
    s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
    s = reduce(s, { type: 'setCinemaCount', projectId: pid, count: 100 })
    s = reduce(s, { type: 'release', projectId: pid, weeks: 0 })
    // 推进到年底 + 跨年
    for (let i = 0; i < 60; i++) s = reduce(s, { type: 'advanceWeek' })
    expect(s.calendar.year).toBeGreaterThan(1)
    expect(s.lastCeremony).toBeDefined()
    expect(s.lastCeremony!.year).toBe(1)
    expect(s.lastCeremony!.winners.some((w) => w.ours)).toBe(true)
  })
})
