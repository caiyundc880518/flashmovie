import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { IP_CONFIG } from '../config/ip'
import type { FilmProject, GameState, IpAsset, SkillKey } from '../types'

/** 构造一个「宣发中」的强项目（票房/口碑必然达标） */
function makeStrongState(seed = 42, weak = false): GameState {
  let s = createInitialState(seed)
  s.company.cash = 100000
  s.company.reputation = weak ? 0 : 100
  s.world.trend = { type: 'drama', untilWeek: 9999 } // 避免 action 类型吃到趋势加成

  const script = generateScript(createRng(seed + 1), 'company')
  script.id = 'scr-test'
  script.type = 'action'
  script.scale = 12
  script.storyPoint = weak ? 10 : 100
  script.artPot = weak ? 10 : 100
  script.marketPot = weak ? 10 : 100
  s.scripts[script.id] = script
  s.company.ownedScriptIds.push(script.id)

  const roles = ['director', 'actor', 'shooter', 'editor', 'market'] as const
  for (const role of roles) {
    const w = generateWorker(createRng(seed + 2), role, 'pro')
    w.id = `w-${role}`
    w.basic.ca = weak ? 10 : 90
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = weak ? 10 : 90
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }

  const p: FilmProject = {
    id: 'prj-test',
    name: weak ? '《扑街之作》' : '《测试大片》',
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
    vfxPercent: 0,
    hasAd: false,
    hype: weak ? 0 : 100,
    marketingBudget: 0,
    budget: 1000,
    spent: 0,
    editStyle: 'market',
    buffs: weak ? -20 : 20,
    apAdjust: 0,
    pendingEvents: [],
    channels: ['cinema'],
  }
  s.projects.push(p)
  return s
}

/** 直接塞一个 IP 资产 */
function pushIp(s: GameState, over: Partial<IpAsset> = {}): IpAsset {
  const ip: IpAsset = {
    id: 'ip-test',
    name: '《测试系列》',
    type: 'action',
    entry: 1,
    originWeek: 10,
    originYear: 1,
    totalBoxOffice: 0,
    bestBoxOffice: 0,
    bestCriticScore: 0,
    level: 1,
    royaltyPerQuarter: 12,
    sequelBonus: 1.05,
    royaltyEarned: 0,
    films: [],
    ...over,
  }
  s.company.ips.push(ip)
  return ip
}

describe('IP 售后与续作', () => {
  it('首作票房口碑双达标 → 沉淀为 IP，结果记录系列信息', () => {
    let s = makeStrongState()
    s = reduce(s, { type: 'release', projectId: 'prj-test' })
    expect(s.company.ips.length).toBe(1)
    const ip = s.company.ips[0]
    expect(ip.entry).toBe(1)
    expect(ip.level).toBeGreaterThanOrEqual(1)
    expect(ip.sequelBonus).toBeGreaterThan(1)
    expect(ip.royaltyPerQuarter).toBeGreaterThan(0)
    expect(ip.films).toContain('prj-test')
    const result = s.projects[0].result!
    expect(result.boxOffice).toBeGreaterThanOrEqual(IP_CONFIG.originBoxOffice)
    expect(result.criticScore).toBeGreaterThanOrEqual(IP_CONFIG.originCriticScore)
    expect(result.ipName).toBe('《测试大片》')
    expect(result.ipEntry).toBe(1)
  })

  it('票房或口碑不达标 → 不沉淀 IP', () => {
    let s = makeStrongState(7, true)
    s = reduce(s, { type: 'release', projectId: 'prj-test' })
    expect(s.company.ips.length).toBe(0)
    expect(s.projects[0].result?.ipName).toBeUndefined()
  })

  it('续作上映 → IP 部数/累计票房/口碑成长，可升级等级', () => {
    let s = makeStrongState(11)
    const ip = pushIp(s, {
      totalBoxOffice: 5000,
      bestBoxOffice: 3200,
      bestCriticScore: 80,
      level: 2,
      royaltyPerQuarter: 24,
      sequelBonus: 1.1,
    })
    const p = s.projects[0]
    p.ipId = ip.id
    p.ipEntry = 2
    p.name = '《测试系列 2》'
    const cashBefore = s.company.cash
    s = reduce(s, { type: 'release', projectId: 'prj-test' })

    const grown = s.company.ips[0]
    expect(grown.entry).toBe(2)
    expect(grown.totalBoxOffice).toBeGreaterThan(5000)
    expect(grown.bestCriticScore).toBeGreaterThanOrEqual(80)
    expect(grown.films).toEqual(['prj-test'])
    // 续作票房加成 ≥ 1.1，收入入账
    expect(s.company.cash).toBeGreaterThan(cashBefore)
    expect(s.projects[0].result?.ipName).toBe('《测试系列》')
    expect(s.projects[0].result?.ipEntry).toBe(2)
  })

  it('续作票房显著高于同配置原创（IP 加成生效）', () => {
    const orig = makeStrongState(3)
    const sequel = makeStrongState(3) // 同种子，仅差 IP
    const ip = pushIp(sequel, {
      totalBoxOffice: 9000,
      level: 3,
      royaltyPerQuarter: 36,
      sequelBonus: 1.15,
    })
    sequel.projects[0].ipId = ip.id
    sequel.projects[0].ipEntry = 2
    sequel.projects[0].name = '《测试系列 2》'

    const r1 = reduce(orig, { type: 'release', projectId: 'prj-test' })
    const r2 = reduce(sequel, { type: 'release', projectId: 'prj-test' })
    expect(r2.projects[0].result!.boxOffice).toBeGreaterThan(r1.projects[0].result!.boxOffice)
    expect(r2.projects[0].result!.boxOffice).toBeGreaterThanOrEqual(
      Math.round(r1.projects[0].result!.boxOffice * 1.1),
    )
  })

  it('续作立项：类型匹配成功（带初始热度），类型不匹配被拒绝', () => {
    let s = createInitialState(19)
    const script = generateScript(createRng(20), 'company')
    script.id = 'scr-ip'
    script.type = 'action'
    s.scripts[script.id] = script
    s.company.ownedScriptIds.push(script.id)
    const ip = pushIp(s, { type: 'action', entry: 2, level: 2 })
    const team = {
      directorId: 'w-director',
      actorIds: ['w-actor'],
      shooterId: 'w-shooter',
      editorId: 'w-editor',
      marketId: 'w-market',
    }

    // 匹配类型 → 立项成功，进入项目列表
    let ok = reduce(s, { type: 'startProject', scriptId: script.id, team, vfxPercent: 0, hasAd: false, ipId: ip.id })
    expect(ok.projects.length).toBe(1)
    const proj = ok.projects[0]
    expect(proj.ipId).toBe(ip.id)
    expect(proj.ipEntry).toBe(3)
    expect(proj.hype).toBeGreaterThan(0)

    // 类型不匹配 → 拒绝（状态引用不变）
    script.type = 'comedy'
    const before = s.projects.length
    const rejected = reduce(s, { type: 'startProject', scriptId: script.id, team, vfxPercent: 0, hasAd: false, ipId: ip.id })
    expect(rejected).toBe(s)
    expect(rejected.projects.length).toBe(before)
  })

  it('季度结算：到达第 13 周发放衍生授权收入，非结算周不发', () => {
    let s = createInitialState(23)
    s.company.cash = 1000
    s.company.employeeIds = []
    pushIp(s, { royaltyPerQuarter: 36, royaltyEarned: 0 })

    // 非结算周：第 11 周 → 12 周
    s.calendar = { year: 1, week: 11 }
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.calendar.week).toBe(12)
    expect(s.company.cash).toBe(1000 - 5) // 只有办公成本，无授权
    expect(s.company.ips[0].royaltyEarned).toBe(0)

    // 结算周：第 12 周 → 13 周，发放 36
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.calendar.week).toBe(13)
    expect(s.company.cash).toBe(1000 - 5 - 5 + 36)
    expect(s.company.ips[0].royaltyEarned).toBe(36)
    expect(s.world.news.some((n) => n.text.includes('IP 衍生授权'))).toBe(true)

    // 第 13 周 → 14 周：非结算周不再发
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.company.cash).toBe(1000 - 5 - 5 + 36 - 5)
    expect(s.company.ips[0].royaltyEarned).toBe(36)
  })

  it('续作向发行商争取预付款溢价', () => {
    let s = makeStrongState(29)
    pushIp(s, { level: 2 })
    s.projects[0].ipId = 'ip-test'
    s.projects[0].ipEntry = 2
    const pub = s.world.publishers[0]
    const basePrepay = Math.round(pub.prepayBase + pub.reputation * pub.prepayPerRep)
    const cashBefore = s.company.cash
    s = reduce(s, { type: 'selectPublisher', projectId: 'prj-test', publisherId: pub.id })
    const gained = s.company.cash - cashBefore
    expect(gained).toBe(Math.round(basePrepay * (1 + 2 * IP_CONFIG.publisherPrepayPerLevel)))
    expect(gained).toBeGreaterThan(basePrepay)
  })
})
