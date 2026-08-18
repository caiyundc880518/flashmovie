import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { channelRevenue } from '../rules/scoring'
import { CHANNEL_CONFIG, TOTAL_CINEMAS } from '../config/channels'
import { ECONOMY } from '../config/economy'
import type { FilmProject, GameState, RoleId } from '../types'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'

const GROSS = 2000

/** 构造宣发中项目（仅渠道参数可变） */
function proj(over: Partial<FilmProject> = {}): FilmProject {
  return {
    id: 'p',
    name: '《渠道测试片》',
    scriptId: 's',
    stage: 'marketing',
    team: { directorId: 'w1', actorIds: ['w2'], shooterId: 'w3', editorId: 'w4', marketId: 'w5' },
    totalStages: 6,
    shotStages: 0,
    budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
    vfxLevel: 0,
    adSponsorIds: [],
    hype: 50,
    warmup: 0,
    budget: 500,
    spent: 0,
    editStyle: null,
    buffs: 0,
    apAdjust: 0,
    pendingShotGame: false,
    shotGameBonus: 0,
    editGameDone: false,
    editGameBonus: 0,
    pendingEvents: [],
    channel: null,
    cinemaCount: 0,
    webPlatforms: [],
    webWeeks: 0,
    dvdPrice: 0,
    freeAdPrice: 0,
    ...over,
  }
}

function buildReadyState(seed = 42): GameState {
  const s = createInitialState(seed)
  s.company.cash = 10000
  const rng = createRng(seed + 1)
  const roles: RoleId[] = ['director', 'actor', 'shooter', 'editor', 'market']
  for (const role of roles) {
    const w = generateWorker(rng, role, 'pro')
    w.id = `test-${role}`
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  return s
}

describe('宣发渠道对票房的影响（权重：影院 > 网络 > DVD > 免费）', () => {
  it('影院：影院数越多票房越高，全国铺满可达数倍增幅', () => {
    const small = channelRevenue(proj({ channel: 'cinema', cinemaCount: 100 }), GROSS).boxOffice
    const mid = channelRevenue(proj({ channel: 'cinema', cinemaCount: 1000 }), GROSS).boxOffice
    const full = channelRevenue(proj({ channel: 'cinema', cinemaCount: TOTAL_CINEMAS }), GROSS).boxOffice
    expect(mid).toBeGreaterThan(small)
    expect(full).toBeGreaterThan(mid)
    // 满覆盖 = 基础 × 4，比 100 家影院高几倍
    expect(full).toBeGreaterThan(small * 3)
    expect(full).toBeCloseTo(GROSS * CHANNEL_CONFIG.cinemaMaxMul, 6)
  })

  it('影院：观影人次 = 票房 ÷ 平均票价', () => {
    const r = channelRevenue(proj({ channel: 'cinema', cinemaCount: 5178 }), GROSS)
    expect(r.admissions!).toBeCloseTo(r.boxOffice / CHANNEL_CONFIG.cinemaAvgTicket, 6)
    expect(r.revenue).toBeCloseTo(r.boxOffice * ECONOMY.cinemaShare, 6)
  })

  it('网络：播放时长越长票房越高（时长是主要驱动）', () => {
    const short = channelRevenue(proj({ channel: 'web', webPlatforms: ['腾讯视频'], webWeeks: 4 }), GROSS).boxOffice
    const long = channelRevenue(proj({ channel: 'web', webPlatforms: ['腾讯视频'], webWeeks: 12 }), GROSS).boxOffice
    expect(long).toBeGreaterThan(short)
    // 时长加成有上限（超长投不再无限加成）
    const veryLong = channelRevenue(proj({ channel: 'web', webPlatforms: ['腾讯视频'], webWeeks: 30 }), GROSS).boxOffice
    expect(veryLong).toBe(long)
    // 平台数也有加成
    const multi = channelRevenue(
      proj({ channel: 'web', webPlatforms: ['腾讯视频', '爱奇艺', '优酷'], webWeeks: 6 }),
      GROSS,
    ).boxOffice
    const single = channelRevenue(proj({ channel: 'web', webPlatforms: ['腾讯视频'], webWeeks: 6 }), GROSS).boxOffice
    expect(multi).toBeGreaterThan(single)
  })

  it('DVD：单价越高总票房越高，单价越低卖出张数越多；票房 = 张数 × 单价', () => {
    const cheap = channelRevenue(proj({ channel: 'dvd', dvdPrice: 10 }), GROSS)
    const dear = channelRevenue(proj({ channel: 'dvd', dvdPrice: 30 }), GROSS)
    expect(dear.boxOffice).toBeGreaterThan(cheap.boxOffice)
    expect(cheap.dvdUnits!).toBeGreaterThan(dear.dvdUnits!)
    // 张数 × 单价 = 票房
    expect(cheap.dvdUnits! * 10).toBeCloseTo(cheap.boxOffice, 4)
    expect(dear.dvdUnits! * 30).toBeCloseTo(dear.boxOffice, 4)
  })

  it('免费：广告收入就是票房，单价越高收入越高', () => {
    const r30 = channelRevenue(proj({ channel: 'free', freeAdPrice: 30, hype: 50 }), GROSS)
    const r80 = channelRevenue(proj({ channel: 'free', freeAdPrice: 80, hype: 50 }), GROSS)
    expect(r80.boxOffice).toBeGreaterThan(r30.boxOffice)
    // freeShare = 1：广告收入全部归片方
    expect(r80.revenue).toBe(r80.boxOffice)
    expect(r80.freeViews).toBeDefined()
  })

  it('渠道权重排序：满覆盖影院 > 充分网络 > DVD > 免费', () => {
    const cinema = channelRevenue(proj({ channel: 'cinema', cinemaCount: TOTAL_CINEMAS }), GROSS).boxOffice
    const web = channelRevenue(
      proj({ channel: 'web', webPlatforms: ['腾讯视频', '爱奇艺', '优酷', '哔哩哔哩'], webWeeks: 12 }),
      GROSS,
    ).boxOffice
    const dvd = channelRevenue(proj({ channel: 'dvd', dvdPrice: 20 }), GROSS).boxOffice
    const free = channelRevenue(proj({ channel: 'free', freeAdPrice: 30, hype: 0 }), GROSS).boxOffice
    expect(cinema).toBeGreaterThan(web)
    expect(web).toBeGreaterThan(dvd)
    expect(dvd).toBeGreaterThan(free)
  })
})

describe('上映结算：渠道驱动最终票房并存储渠道指标', () => {
  it('上映后 result.boxOffice 为渠道驱动票房，并记录观影人次', () => {
    let s = buildReadyState(42)
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team: {
        directorId: 'test-director',
        actorIds: ['test-actor'],
        shooterId: 'test-shooter',
        editorId: 'test-editor',
        marketId: 'test-market',
      },
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
    for (let i = 0; i < 40 && s.projects[0].stage === 'shooting'; i++) {
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
    s = reduce(s, { type: 'setCinemaCount', projectId: pid, count: 800 })
    s = reduce(s, { type: 'release', projectId: pid })
    const r = s.projects[0].result!
    expect(r.channel).toBe('cinema')
    expect(r.admissions).toBeGreaterThan(0)
    // 影院 800 家：票房系数 > 1，最终票房高于未渠道化的基础票房
    expect(r.boxOffice).toBeGreaterThan(r.admissions! * CHANNEL_CONFIG.cinemaAvgTicket - 0.001)
    expect(r.revenue).toBeLessThan(r.boxOffice)
    // 片方收入 = 票房 × 影院分账
    expect(r.revenue).toBeCloseTo(r.boxOffice * ECONOMY.cinemaShare, 0)
  })

  it('DVD 渠道上映：记录卖出张数', () => {
    const r = channelRevenue(proj({ channel: 'dvd', dvdPrice: 20 }), GROSS)
    expect(r.dvdUnits).toBeGreaterThan(0)
    expect(r.boxOffice).toBeCloseTo(r.dvdUnits! * 20, 4)
  })
})
