import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { CHANNEL_CONFIG } from '../config/channels'
import { lowerChannelsOf } from '../tick/distribution'
import { releaseAndFinish, advanceN } from './helpers'
import type { GameState, SkillKey } from '../types'

/** 构造一部「宣发中」的强项目（默认影院） */
function makeProject(seed = 42, channel: 'cinema' | 'web' | 'dvd' | 'free' = 'cinema'): GameState {
  let s = createInitialState(seed)
  s.company.cash = 100000
  s.company.reputation = 100
  const script = generateScript(createRng(seed + 1), 'company')
  script.id = 'scr-lt'
  script.type = 'action'
  script.scale = 10
  script.storyPoint = 90
  script.artPot = 90
  script.marketPot = 90
  s.scripts[script.id] = script
  s.company.ownedScriptIds.push(script.id)
  for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
    const w = generateWorker(createRng(seed + 2), role, 'pro')
    w.id = `w-${role}`
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 90
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  const p = {
    id: 'prj-lt',
    name: '《长尾测试片》',
    scriptId: script.id,
    stage: 'marketing' as const,
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
    hype: 90,
    budget: 1000,
    spent: 0,
    editStyle: 'market' as const,
    buffs: 0,
    apAdjust: 0,
    pendingEvents: [],
    channel,
    cinemaCount: channel === 'cinema' ? 800 : 0,
    webPlatforms: channel === 'web' ? ['腾讯视频', '爱奇艺'] : [],
    webWeeks: channel === 'web' ? 8 : 0,
    dvdPrice: channel === 'dvd' ? 20 : 0,
    freeAdPrice: channel === 'free' ? 30 : 0,
    warmup: 0,
    shotGameBonus: 0,
    pendingShotGame: false,
    editGameDone: true,
    editGameBonus: 0,
  }
  s.projects.push(p)
  return s
}

describe('定档与预售', () => {
  it('提前定档：进入待映，每周攒预售、热度衰减，到上映周开映并享受预售加成', () => {
    let s = makeProject(5)
    s = reduce(s, { type: 'release', projectId: 'prj-lt', weeks: 3 })
    expect(s.projects[0].run!.status).toBe('presale')
    expect(s.projects[0].run!.runs.length).toBe(0)
    const hype0 = s.projects[0].hype
    // 待映期间：每周预售累积 + 热度衰减
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.projects[0].run!.presale).toBeGreaterThan(0)
    expect(s.projects[0].hype).toBeLessThan(hype0)
    // 未到上映周：仍待映
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.projects[0].run!.status).toBe('presale')
    // 到上映周：开映，首周票房有预售加成
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.projects[0].run!.status).toBe('running')
    const run = s.projects[0].run!.runs[0]
    expect(run.weekly.length).toBe(1)
    // 预售加成生效：首周占比高于无预售的 1−decayRate
    expect(run.weekly[0].boxOffice).toBeGreaterThan(run.expectedTotal * (1 - CHANNEL_CONFIG.run.decayRate.cinema))
  })

  it('本周立即上映：无待映期，首周即开映', () => {
    let s = makeProject(6)
    s = reduce(s, { type: 'release', projectId: 'prj-lt', weeks: 0 })
    expect(s.projects[0].run!.status).toBe('running')
    expect(s.projects[0].run!.runs.length).toBe(1)
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.projects[0].run!.runs[0].weekly.length).toBe(1)
    expect(s.projects[0].run!.presale).toBe(0) // 无预售
  })
})

describe('每周动态票房与口碑/MP 反馈', () => {
  it('首周峰值、逐周递减，直至自动下片', () => {
    let s = makeProject(7)
    s = releaseAndFinish(s, 'prj-lt')
    const run = s.projects[0].run!.runs[0]
    expect(run.status).toBe('ended')
    expect(run.weekly.length).toBeGreaterThan(1)
    // 单调递减（首周最高）
    for (let i = 1; i < run.weekly.length; i++) {
      expect(run.weekly[i].boxOffice).toBeLessThan(run.weekly[i - 1].boxOffice)
    }
    expect(run.weekly[0].boxOffice).toBeGreaterThan(run.weekly[run.weekly.length - 1].boxOffice)
    // 自动下片：最后一周 < 地板，或达硬上限周数（影院 12 周）
    const last = run.weekly[run.weekly.length - 1]
    const hitFloor = last.boxOffice < CHANNEL_CONFIG.run.floorWan
    const hitCap = run.weekly.length >= CHANNEL_CONFIG.run.maxWeeks.cinema
    expect(hitFloor || hitCap).toBe(true)
  })

  it('口碑/MP 随票房表现动态变化：最终 MP 锁定供结算', () => {
    // 强片（高技能/高口碑）→ 口碑/MP 应 ≥ 初始或至少变化过
    let s = makeProject(8)
    s = releaseAndFinish(s, 'prj-lt')
    const p = s.projects[0]
    expect(p.finalMp).toBeGreaterThan(0)
    expect(p.run!.runs[0].weekly[0].mp).toBeGreaterThan(0)
    // 每周口碑记录存在
    const auds = p.run!.runs[0].weekly.map((w) => w.audience)
    expect(new Set(auds).size).toBeGreaterThan(1) // 口碑确实在变化
  })
})

describe('下片与再发行', () => {
  it('首轮下片：一次性结算只做一次（成员成长入账），随后可再发行', () => {
    let s = makeProject(9)
    s = releaseAndFinish(s, 'prj-lt')
    const p = s.projects[0]
    expect(p.run!.firstRunEnded).toBe(true)
    expect(p.run!.status).toBe('idle') // 影院后仍有更低档
    expect(p.result!.settlement).toBeDefined() // 成员成长已结算
    // 继续推进：不再重复结算
    const expBefore = s.workers['w-director'].experience
    s = advanceN(s, 3)
    expect(s.workers['w-director'].experience).toBe(expBefore)
  })

  it('再发行：只能往更低档，网络→DVD/免费；重复同档被拒', () => {
    let s = makeProject(10)
    s.projects[0].channel = 'web'
    s.projects[0].webPlatforms = ['腾讯视频']
    s.projects[0].webWeeks = 4
    s = releaseAndFinish(s, 'prj-lt')
    expect(s.projects[0].run!.status).toBe('idle')
    // 影院/网络（更高或同档）被拒
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'web' })
    expect(s.projects[0].run!.status).toBe('idle')
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'cinema' })
    expect(s.projects[0].run!.status).toBe('idle')
    // DVD 可再发行
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'dvd' })
    const p = s.projects[0]
    expect(p.run!.status).toBe('running')
    const run = p.run!.runs[p.run!.runs.length - 1]
    expect(run.isFirst).toBe(false)
    expect(run.channel).toBe('dvd')
    // 再发行纯赚钱：不更新口碑/MP
    const audBefore = p.currentAudience
    const mpBefore = p.currentMp
    s = advanceN(s, 2)
    expect(s.projects[0].currentAudience).toBe(audBefore)
    expect(s.projects[0].currentMp).toBe(mpBefore)
  })

  it('再发行：使用玩家设置的渠道参数（DVD 单价 / 免费广告单价）', () => {
    let s = makeProject(10)
    s = releaseAndFinish(s, 'prj-lt') // 首轮影院 → idle
    // DVD 再发行：自定义单价 55（默认 20）
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'dvd', config: { dvdPrice: 55 } })
    let run = s.projects[0].run!.runs[s.projects[0].run!.runs.length - 1]
    expect(run.config.dvdPrice).toBe(55)
    // 手动下片 → 免费再发行自定义广告单价 60（默认 30）
    s = reduce(s, { type: 'endRun', projectId: 'prj-lt' })
    expect(s.projects[0].run!.status).toBe('idle')
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'free', config: { freeAdPrice: 60 } })
    run = s.projects[0].run!.runs[s.projects[0].run!.runs.length - 1]
    expect(run.config.freeAdPrice).toBe(60)
  })

  it('再发行：不传 config 回落到渠道默认参数（网络平台/时长、DVD 单价）', () => {
    let s = makeProject(10)
    s = releaseAndFinish(s, 'prj-lt') // 首轮影院 → idle
    // 网络再发行缺省：默认平台+默认时长
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'web' })
    let run = s.projects[0].run!.runs[s.projects[0].run!.runs.length - 1]
    expect(run.config.webPlatforms).toEqual(['腾讯视频'])
    expect(run.config.webWeeks).toBe(CHANNEL_CONFIG.webDefaultWeeks)
    // 手动下片 → DVD 再发行缺省：默认单价
    s = reduce(s, { type: 'endRun', projectId: 'prj-lt' })
    expect(s.projects[0].run!.status).toBe('idle')
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'dvd' })
    run = s.projects[0].run!.runs[s.projects[0].run!.runs.length - 1]
    expect(run.config.dvdPrice).toBe(CHANNEL_CONFIG.dvdRefPrice)
  })

  it('免费档下片后 → 彻底完结', () => {
    let s = makeProject(11, 'free')
    s = releaseAndFinish(s, 'prj-lt')
    expect(s.projects[0].run!.status).toBe('finished')
    // 完结后不可再发行
    s = reduce(s, { type: 'rerelease', projectId: 'prj-lt', channel: 'dvd' })
    expect(s.projects[0].run!.status).toBe('finished')
  })

  it('手动下片：立即结束当前段', () => {
    let s = makeProject(12)
    s = reduce(s, { type: 'release', projectId: 'prj-lt', weeks: 0 })
    s = advanceN(s, 2) // 已结算 2 周
    const weeklyLen = s.projects[0].run!.runs[0].weekly.length
    s = reduce(s, { type: 'endRun', projectId: 'prj-lt' })
    const p = s.projects[0]
    expect(p.run!.runs[0].status).toBe('ended')
    expect(p.run!.runs[0].weekly.length).toBe(weeklyLen) // 已结算收入保留
    expect(p.run!.status).toBe('idle')
  })
})

describe('IP 长尾：周边与版权交易', () => {
  it('版权交易：签合同后每周分期入账，满期 done，可再签；同类型重复被拒', () => {
    let s = makeProject(13)
    s = releaseAndFinish(s, 'prj-lt')
    const ipId = s.company.ips[0].id
    expect(ipId).toBeDefined()
    s = reduce(s, { type: 'sellCopyright', ipId, kind: 'tv' })
    let ip = s.company.ips[0]
    expect(ip.deals!.length).toBe(1)
    expect(ip.deals![0].status).toBe('active')
    expect(ip.deals![0].total).toBeGreaterThan(0)
    // 同类型 active 重复被拒
    s = reduce(s, { type: 'sellCopyright', ipId, kind: 'tv' })
    ip = s.company.ips[0]
    expect(ip.deals!.length).toBe(1)
    // 游戏版权可并行签
    s = reduce(s, { type: 'sellCopyright', ipId, kind: 'game' })
    ip = s.company.ips[0]
    expect(ip.deals!.length).toBe(2)
    // 每周分期入账
    const paidBefore = ip.deals![0].paid
    s = reduce(s, { type: 'advanceWeek' })
    ip = s.company.ips[0]
    expect(ip.deals![0].paid).toBeGreaterThan(paidBefore)
    // 满期 done（快进合同期）
    for (let i = 0; i < 30 && s.company.ips[0].deals!.some((d) => d.status === 'active'); i++) {
      s = reduce(s, { type: 'advanceWeek' })
    }
    expect(s.company.ips[0].deals![0].status).toBe('done')
  })

  it('热门度驱动周边收入：新片上映抬升热门度，每周衰减', () => {
    let s = makeProject(14)
    s = releaseAndFinish(s, 'prj-lt')
    let ip = s.company.ips[0]
    expect(ip.hotness).toBeGreaterThan(50) // 强片 MP 高 → 热门度起跳高
    const h1 = ip.hotness!
    s = reduce(s, { type: 'advanceWeek' })
    ip = s.company.ips[0]
    expect(ip.hotness!).toBeLessThan(h1) // 每周衰减
    const earned1 = ip.royaltyEarned
    s = reduce(s, { type: 'advanceWeek' })
    ip = s.company.ips[0]
    expect(ip.royaltyEarned).toBeGreaterThan(earned1) // 每周周边入账
  })
})

describe('渠道单调约束（辅助函数）', () => {
  it('lowerChannelsOf：影院→网络/DVD/免费；免费→空', () => {
    expect(lowerChannelsOf('cinema')).toEqual(['web', 'dvd', 'free'])
    expect(lowerChannelsOf('web')).toEqual(['dvd', 'free'])
    expect(lowerChannelsOf('dvd')).toEqual(['free'])
    expect(lowerChannelsOf('free')).toEqual([])
  })
})
