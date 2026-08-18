import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { generateScript } from '../generators/scriptGen'
import { generateWorker } from '../generators/workerGen'
import { computeFilmResult, availableVfxTiers, vfxTierAt } from '../rules/scoring'
import { BUDGET_CONFIG, allocBonus, allocTotal } from '../config/budget'
import { AD_CONFIG, AD_SPONSORS, AD_SPONSOR_MAP } from '../config/ads'
import { ECONOMY } from '../config/economy'
import type { FilmProject, GameState, SkillKey } from '../types'

/** 构造宣发中项目：可控预算占比/特效档位/广告商 */
function makeProjectState(
  over: Partial<FilmProject> = {},
  opts: { seed?: number; techVfx?: number; actorFame?: number; skillLevel?: number } = {},
): GameState {
  const { seed = 9, techVfx = 80, actorFame = 60, skillLevel = 60 } = opts
  let s = createInitialState(seed)
  s.company.cash = 100000
  const script = generateScript(createRng(seed + 1), 'company')
  script.id = 'scr-ba'
  script.type = 'action'
  script.scale = 8
  s.scripts[script.id] = script
  s.company.ownedScriptIds.push(script.id)

  const roles = ['director', 'actor', 'shooter', 'editor', 'market'] as const
  for (const role of roles) {
    const w = generateWorker(createRng(seed + 2), role, 'pro')
    w.id = `w-${role}`
    for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = skillLevel
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  const tech = generateWorker(createRng(seed + 3), 'technician', 'pro')
  tech.id = 'w-tech'
  tech.skills.vfx = techVfx
  s.workers['w-tech'] = tech
  s.company.employeeIds.push('w-tech')
  const actor = s.workers['w-actor']
  if (actor) actor.basic.fame = actorFame

  // 预算按占比/档位推导（与 reducer startProject 公式一致）
  const alloc = over.budgetAlloc ?? { story: 0, vfx: 0, acting: 0, edit: 0 }
  const vfxLevel = over.vfxLevel ?? 0
  const tier = { costMul: 1.0 }
  if (vfxLevel >= 2) tier.costMul = 1.5
  else if (vfxLevel >= 1) tier.costMul = 1.2
  const base = script.scale * ECONOMY.costPerStage
  const budget = Math.round(
    base +
      base * (alloc.vfx / 100) * ECONOMY.vfxCostFactor * tier.costMul +
      base * ((alloc.story + alloc.acting + alloc.edit) / 100) * BUDGET_CONFIG.allocCostFactor,
  )

  const p: FilmProject = {
    id: 'prj-ba',
    name: '《预算测试片》',
    scriptId: script.id,
    stage: 'marketing',
    team: {
      directorId: 'w-director',
      actorIds: ['w-actor'],
      shooterId: 'w-shooter',
      editorId: 'w-editor',
      marketId: 'w-market',
      technicianId: 'w-tech',
    },
    totalStages: script.scale,
    shotStages: script.scale,
    budgetAlloc: alloc,
    vfxLevel,
    adSponsorIds: [],
    hype: 60,
    budget,
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
    ...over,
  }
  // over 可能覆盖了 budget，若显式传 budget 则用传入值
  s.projects.push(p)
  return s
}

/** 同条件重复评分（固定种子 rng=0），比较预算占比差异 */
function scoreStory(a: Partial<FilmProject>, b: Partial<FilmProject>) {
  const sa = makeProjectState(a)
  const sb = makeProjectState(b)
  const pa = sa.projects[0]
  const pb = sb.projects[0]
  const ra = computeFilmResult(sa, pa, createRng(0))
  const rb = computeFilmResult(sb, pb, createRng(0))
  return { ra, rb }
}

describe('预算占比（Budget Alloc）', () => {
  it('配置：四项总和上限 100，100% 侧重加成 maxBonus 分', () => {
    expect(allocBonus(100)).toBe(BUDGET_CONFIG.maxBonus)
    expect(allocBonus(50)).toBeCloseTo(BUDGET_CONFIG.maxBonus / 2)
    expect(allocBonus(0)).toBe(0)
    expect(allocTotal({ story: 30, vfx: 30, acting: 30, edit: 10 })).toBe(100)
  })

  it('着重剧情提升成片故事分', () => {
    const { ra, rb } = scoreStory(
      { budgetAlloc: { story: 100, vfx: 0, acting: 0, edit: 0 } },
      { budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 } },
    )
    // 无侧重 vs 100% 剧情 → story 至少差 maxBonus - 波动（variance 相同种子）
    expect(ra.scores.story).toBeGreaterThanOrEqual(rb.scores.story + BUDGET_CONFIG.maxBonus - 1)
  })

  it('着重表演提升成片表演分（拉高 MP）', () => {
    const { ra, rb } = scoreStory(
      { budgetAlloc: { story: 0, vfx: 0, acting: 100, edit: 0 } },
      { budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 } },
    )
    expect(ra.scores.acting).toBeGreaterThanOrEqual(rb.scores.acting + BUDGET_CONFIG.maxBonus - 1)
    expect(ra.mp).toBeGreaterThanOrEqual(rb.mp - 0.5)
  })

  it('着重剪辑提升成片剪辑分', () => {
    const { ra, rb } = scoreStory(
      { budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 100 } },
      { budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 } },
    )
    expect(ra.scores.edit).toBeGreaterThanOrEqual(rb.scores.edit + BUDGET_CONFIG.maxBonus - 1)
  })

  it('startProject 拒绝总占比 > 100 的立项', () => {
    let s = createInitialState(11)
    s.company.cash = 100000
    const script = generateScript(createRng(12), 'company')
    script.id = 'scr-x'
    s.scripts[script.id] = script
    s.company.ownedScriptIds.push(script.id)
    for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
      const w = generateWorker(createRng(13), role, 'pro')
      w.id = `w-${role}`
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    const before = s.projects.length
    s = reduce(s, {
      type: 'startProject',
      scriptId: script.id,
      team: {
        directorId: 'w-director',
        actorIds: ['w-actor'],
        shooterId: 'w-shooter',
        editorId: 'w-editor',
        marketId: 'w-market',
      },
      budgetAlloc: { story: 40, vfx: 40, acting: 40, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    expect(s.projects.length).toBe(before)
    // 合法占比可立项
    s = reduce(s, {
      type: 'startProject',
      scriptId: script.id,
      team: {
        directorId: 'w-director',
        actorIds: ['w-actor'],
        shooterId: 'w-shooter',
        editorId: 'w-editor',
        marketId: 'w-market',
      },
      budgetAlloc: { story: 40, vfx: 30, acting: 20, edit: 10 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    expect(s.projects.length).toBe(before + 1)
    expect(s.projects[before].budgetAlloc).toEqual({ story: 40, vfx: 30, acting: 20, edit: 10 })
  })

  it('预算成本：VFX 占比与特效档位共同抬高预算', () => {
    const base = makeProjectState({ budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 }, vfxLevel: 0 })
    const vfxHigh = makeProjectState({ budgetAlloc: { story: 0, vfx: 100, acting: 0, edit: 0 }, vfxLevel: 0 })
    const vfxTop = makeProjectState({ budgetAlloc: { story: 0, vfx: 100, acting: 0, edit: 0 }, vfxLevel: 2 })
    const b0 = base.projects[0].budget
    const b1 = vfxHigh.projects[0].budget
    const b2 = vfxTop.projects[0].budget
    expect(b1).toBeGreaterThan(b0)
    expect(b2).toBeGreaterThan(b1)
  })
})

describe('特效档位（VFX Level）', () => {
  it('技能解锁档位：80 技能解锁全部三档', () => {
    expect(availableVfxTiers(80).map((t) => t.label)).toEqual(['基础特效', '标准特效', '顶级特效'])
    expect(availableVfxTiers(30).map((t) => t.label)).toEqual(['基础特效'])
    expect(availableVfxTiers(60).map((t) => t.label)).toEqual(['基础特效', '标准特效'])
  })

  it('档位越高 VFX 分上限越高', () => {
    const s1 = makeProjectState({ budgetAlloc: { story: 0, vfx: 100, acting: 0, edit: 0 }, vfxLevel: 0 })
    const s2 = makeProjectState({ budgetAlloc: { story: 0, vfx: 100, acting: 0, edit: 0 }, vfxLevel: 2 })
    const r1 = computeFilmResult(s1, s1.projects[0], createRng(0))
    const r2 = computeFilmResult(s2, s2.projects[0], createRng(0))
    expect(vfxTierAt(80, 2).max).toBeGreaterThan(vfxTierAt(80, 0).max)
    expect(r2.vfx).toBeGreaterThanOrEqual(r1.vfx)
  })
})

describe('植入广告（Ad Sponsors）', () => {
  it('广告商配置：赞助费与知名度正相关，高知名度带周边加成', () => {
    const sorted = [...AD_SPONSORS].sort((a, b) => a.popularity - b.popularity)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].sponsorFee).toBeGreaterThanOrEqual(sorted[i - 1].sponsorFee)
    }
    const top = AD_SPONSORS.find((a) => a.popularity >= 70)!
    expect(top.merchBonus).toBeGreaterThan(0)
    const low = AD_SPONSORS.find((a) => a.popularity < 40)!
    expect(low.merchBonus).toBe(0)
  })

  it('上映结算：达标广告商到账赞助费，未达标不予以赞助费', () => {
    // 高技能片（影评 ≥7.0 达标瑞格腕表）：演员 Fame 60 → 茶语奶茶/瑞格腕表达标，皇家珠宝（Fame≥80）未达标
    let s = makeProjectState(
      { budgetAlloc: { story: 100, vfx: 0, acting: 100, edit: 0 }, adSponsorIds: ['ad_tea', 'ad_watch', 'ad_luxury'] },
      { techVfx: 80, actorFame: 60, skillLevel: 85 },
    )
    s = reduce(s, { type: 'release', projectId: 'prj-ba' })
    const result = s.projects[0].result!
    const settled = result.adSettlement!
    const tea = settled.find((a) => a.id === 'ad_tea')!
    const watch = settled.find((a) => a.id === 'ad_watch')!
    const luxury = settled.find((a) => a.id === 'ad_luxury')!
    expect(tea.met).toBe(true)
    expect(watch.met).toBe(true)
    expect(luxury.met).toBe(false)
    expect(result.adIncome).toBe(tea.fee + watch.fee)
    // 赞助费是现金追加；票房收入另计，因此用 adIncome 断言到账金额
    expect(result.adIncome).toBe(AD_SPONSOR_MAP.ad_tea.sponsorFee + AD_SPONSOR_MAP.ad_watch.sponsorFee)
  })

  it('影评要求不满足 → 该广告商不予以赞助费', () => {
    // 制造低分片：全零侧重 + 低技能 → 影评分低，恒信银行（需 7.5）未达标
    let s = makeProjectState(
      { budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 }, adSponsorIds: ['ad_bank'] },
      { techVfx: 80, actorFame: 80 },
    )
    // 压制成片质量：演员/导演技能全部拉低
    for (const id of ['w-director', 'w-actor', 'w-shooter', 'w-editor', 'w-market']) {
      const w = s.workers[id]
      if (w) for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 5
    }
    const r = computeFilmResult(s, s.projects[0], createRng(0))
    expect(r.criticScore).toBeLessThan(7.5)
    const s2 = reduce(s, { type: 'release', projectId: 'prj-ba' })
    const result = s2.projects[0].result!
    expect(result.adIncome ?? 0).toBe(0)
    expect(result.adSettlement?.[0].met).toBe(false)
  })

  it('高知名度广告商提升所属 IP 周边收入（累计）', () => {
    // 达标片：沉淀新 IP + 瑞格腕表（merch 15%）
    let s = makeProjectState(
      { budgetAlloc: { story: 100, vfx: 0, acting: 100, edit: 0 }, adSponsorIds: ['ad_watch'] },
      { techVfx: 80, actorFame: 80 },
    )
    s = reduce(s, { type: 'release', projectId: 'prj-ba' })
    const ip = s.company.ips[0]
    expect(ip).toBeDefined()
    expect(ip.merchBonus).toBe(AD_SPONSOR_MAP.ad_watch.merchBonus)
  })

  it('周边加成提升季度授权收入', () => {
    let s = makeProjectState()
    const ip = {
      id: 'ip-merch',
      name: '《周边测试》',
      type: 'action' as const,
      entry: 1,
      originWeek: 1,
      originYear: 1,
      totalBoxOffice: 2000,
      bestBoxOffice: 2000,
      bestCriticScore: 75,
      level: 1,
      royaltyPerQuarter: 12,
      sequelBonus: 1.05,
      merchBonus: 50,
      royaltyEarned: 0,
      films: [],
    }
    s.company.ips = [ip]
    s.company.employeeIds = []
    s.company.cash = 1000
    s.calendar = { year: 1, week: 12 }
    s = reduce(s, { type: 'advanceWeek' })
    // 1000 − 5 办公 = 995；+12 × 1.5 = 18 → 1013
    expect(s.company.cash).toBe(1013)
  })

  it('startProject 拒绝超过上限的广告商数量', () => {
    let s = createInitialState(21)
    s.company.cash = 100000
    const script = generateScript(createRng(22), 'company')
    script.id = 'scr-ad'
    s.scripts[script.id] = script
    s.company.ownedScriptIds.push(script.id)
    for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
      const w = generateWorker(createRng(23), role, 'pro')
      w.id = `w-${role}`
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    const tooMany = AD_SPONSORS.slice(0, AD_CONFIG.maxSponsors + 1).map((a) => a.id)
    const before = s.projects.length
    s = reduce(s, {
      type: 'startProject',
      scriptId: script.id,
      team: {
        directorId: 'w-director',
        actorIds: ['w-actor'],
        shooterId: 'w-shooter',
        editorId: 'w-editor',
        marketId: 'w-market',
      },
      budgetAlloc: { story: 25, vfx: 25, acting: 25, edit: 25 },
      vfxLevel: 0,
      adSponsorIds: tooMany,
    })
    expect(s.projects.length).toBe(before)
  })

  it('续作立项继承旧档迁移：广告商列表与预算占比写入项目', () => {
    let s = createInitialState(31)
    s.company.cash = 100000
    const script = generateScript(createRng(32), 'company')
    script.id = 'scr-ip'
    script.type = 'drama'
    s.scripts[script.id] = script
    s.company.ownedScriptIds.push(script.id)
    for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
      const w = generateWorker(createRng(33), role, 'pro')
      w.id = `w-${role}`
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    const tech = generateWorker(createRng(34), 'technician', 'pro')
    tech.id = 'w-tech'
    tech.skills.vfx = 80
    s.workers['w-tech'] = tech
    s.company.employeeIds.push('w-tech')
    const ip = {
      id: 'ip-x',
      name: '《老IP》',
      type: 'drama' as const,
      entry: 2,
      originWeek: 1,
      originYear: 1,
      totalBoxOffice: 5000,
      bestBoxOffice: 3000,
      bestCriticScore: 78,
      level: 2,
      royaltyPerQuarter: 24,
      sequelBonus: 1.1,
      merchBonus: 0,
      royaltyEarned: 0,
      films: ['p-old'],
    }
    s.company.ips = [ip]
    s = reduce(s, {
      type: 'startProject',
      scriptId: script.id,
      team: {
        directorId: 'w-director',
        actorIds: ['w-actor'],
        shooterId: 'w-shooter',
        editorId: 'w-editor',
        marketId: 'w-market',
        technicianId: 'w-tech',
      },
      budgetAlloc: { story: 50, vfx: 20, acting: 20, edit: 10 },
      vfxLevel: 1,
      adSponsorIds: ['ad_phone'],
      ipId: 'ip-x',
    })
    const p = s.projects[s.projects.length - 1]
    expect(p.budgetAlloc).toEqual({ story: 50, vfx: 20, acting: 20, edit: 10 })
    expect(p.vfxLevel).toBe(1)
    expect(p.adSponsorIds).toEqual(['ad_phone'])
    expect(p.ipId).toBe('ip-x')
    expect(p.name).toBe('《老IP》 3')
  })
})

describe('拍摄流程大修（预热/小游戏/单渠道）', () => {
  it('筹备预热：投入越多 MP 加成越多（无上限）', () => {
    let s = createInitialState(61)
    s.company.cash = 100000
    const script = generateScript(createRng(62), 'company')
    script.id = 'scr-wu'
    s.scripts[script.id] = script
    s.company.ownedScriptIds.push(script.id)
    for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
      const w = generateWorker(createRng(63), role, 'pro')
      w.id = `w-${role}`
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    s = reduce(s, {
      type: 'startProject',
      scriptId: script.id,
      team: {
        directorId: 'w-director',
        actorIds: ['w-actor'],
        shooterId: 'w-shooter',
        editorId: 'w-editor',
        marketId: 'w-market',
      },
      budgetAlloc: { story: 25, vfx: 25, acting: 25, edit: 25 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    const cashBefore = s.company.cash
    s = reduce(s, { type: 'setWarmup', projectId: pid, amount: ECONOMY.warmupPerMp * 3 })
    expect(s.company.cash).toBe(cashBefore - ECONOMY.warmupPerMp * 3)
    expect(s.projects[0].warmup).toBe(ECONOMY.warmupPerMp * 3)
    // MP 加成 = warmup / warmupPerMp = 3
    const p = s.projects[0]
    expect(Math.floor(p.warmup / ECONOMY.warmupPerMp)).toBe(3)
  })

  it('拍摄小游戏：三次完美大幅加 AP/MP，全失败无加成', () => {
    let s = createInitialState(71)
    s.company.cash = 100000
    const script = generateScript(createRng(72), 'company')
    script.id = 'scr-gm'
    s.scripts[script.id] = script
    s.company.ownedScriptIds.push(script.id)
    for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
      const w = generateWorker(createRng(73), role, 'pro')
      w.id = `w-${role}`
      for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 60
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    s = reduce(s, {
      type: 'startProject',
      scriptId: script.id,
      team: {
        directorId: 'w-director',
        actorIds: ['w-actor'],
        shooterId: 'w-shooter',
        editorId: 'w-editor',
        marketId: 'w-market',
      },
      budgetAlloc: { story: 25, vfx: 25, acting: 25, edit: 25 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
    // 手动触发拍摄小游戏
    s.projects[0].pendingShotGame = true
    s = reduce(s, { type: 'applyShotGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    expect(s.projects[0].shotGameBonus).toBe(6)
    expect(s.projects[0].pendingShotGame).toBe(false)
    // 全失败：无加成
    s.projects[0].pendingShotGame = true
    s = reduce(s, { type: 'applyShotGame', projectId: pid, qualities: ['miss', 'miss', 'miss'] })
    expect(s.projects[0].shotGameBonus).toBe(6)
    // 剪辑小游戏：全完美 +6，完成标记
    s.projects[0].stage = 'editing'
    s = reduce(s, { type: 'applyEditGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    expect(s.projects[0].editGameBonus).toBe(6)
    expect(s.projects[0].editGameDone).toBe(true)
  })

  it('渠道单选：影院收入随影院数增加，网络按平台/时长', () => {
    let s = createInitialState(81)
    s.company.cash = 100000
    const script = generateScript(createRng(82), 'company')
    script.id = 'scr-ch'
    s.scripts[script.id] = script
    s.company.ownedScriptIds.push(script.id)
    for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as const) {
      const w = generateWorker(createRng(83), role, 'pro')
      w.id = `w-${role}`
      for (const k of Object.keys(w.skills) as SkillKey[]) w.skills[k] = 80
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }
    s = reduce(s, {
      type: 'startProject',
      scriptId: script.id,
      team: {
        directorId: 'w-director',
        actorIds: ['w-actor'],
        shooterId: 'w-shooter',
        editorId: 'w-editor',
        marketId: 'w-market',
      },
      budgetAlloc: { story: 25, vfx: 25, acting: 25, edit: 25 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
    s.projects[0].pendingShotGame = false
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
    // 影院 100 家 vs 1000 家
    const base = structuredClone(s)
    s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
    s = reduce(s, { type: 'setCinemaCount', projectId: pid, count: 100 })
    s = reduce(s, { type: 'release', projectId: pid })
    const rA = s.projects[0].result!
    let s2 = structuredClone(base)
    s2 = reduce(s2, { type: 'setChannel', projectId: pid, channel: 'cinema' })
    s2 = reduce(s2, { type: 'setCinemaCount', projectId: pid, count: 1000 })
    s2 = reduce(s2, { type: 'release', projectId: pid })
    const rB = s2.projects[0].result!
    expect(rB.revenue!).toBeGreaterThan(rA.revenue!)
    // 网络渠道：平台/时长为空时也能结算
    let s3 = structuredClone(base)
    s3 = reduce(s3, { type: 'setChannel', projectId: pid, channel: 'web' })
    s3 = reduce(s3, { type: 'setWebConfig', projectId: pid, platforms: ['腾讯视频', '爱奇艺'], weeks: 6 })
    s3 = reduce(s3, { type: 'release', projectId: pid })
    expect(s3.projects[0].result!.channel).toBe('web')
  })
})
