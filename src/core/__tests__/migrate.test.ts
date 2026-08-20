import { describe, expect, it } from 'vitest'
import { migrateSave } from '../save/migrate'
import { createInitialState } from '../state/initialState'

describe('存档迁移', () => {
  it('拒绝损坏存档', () => {
    expect(() => migrateSave(null)).toThrow()
    expect(() => migrateSave(undefined)).toThrow()
    expect(() => migrateSave('str')).toThrow()
    expect(() => migrateSave({ version: 99 })).toThrow()
    expect(() => migrateSave({ version: -1 })).toThrow()
  })

  it('接受最新 v11 存档（恒等迁移）', () => {
    const s = createInitialState(1)
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(15)
    expect(migrated.company.name).toBe('星光影业')
    expect(migrated.company.ips).toEqual([])
    expect(migrated.company.tech).toEqual({})
    expect(migrated.world.competitors.length).toBeGreaterThan(0)
    expect(migrated.world.audience.length).toBeGreaterThan(0)
    expect(migrated.world.activeEvents).toEqual([])
    expect(migrated.scriptDrafts).toEqual([])
    expect(migrated.world.publishers.length).toBeGreaterThan(0)
    expect(migrated.world.investors.length).toBeGreaterThan(0)
  })

  it('v5 存档迁移到最新并补 tech / audience', () => {
    const s = createInitialState(2)
    s.version = 5
    delete (s.company as { tech?: unknown }).tech
    delete (s.world as { audience?: unknown }).audience
    delete (s.world as { activeEvents?: unknown }).activeEvents
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(15)
    expect(migrated.company.tech).toEqual({})
    expect(migrated.world.audience.length).toBeGreaterThan(0)
    expect(migrated.world.activeEvents).toEqual([])
  })

  it('v10 存档迁移到 v11：项目补预算占比/特效档位/广告商，IP 补周边加成', () => {
    const s = createInitialState(3)
    s.version = 10
    // 模拟旧档项目（v10 无 budgetAlloc/vfxLevel/adSponsorIds）
    const project = {
      id: 'prj-old',
      name: '《旧档片》',
      scriptId: 'scr-1',
      stage: 'released',
      team: { directorId: 'w1', actorIds: ['w2'], shooterId: 'w3', editorId: 'w4', marketId: 'w5' },
      totalStages: 8,
      shotStages: 8,
      vfxPercent: 40,
      hasAd: true,
      hype: 60,
      budget: 1000,
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
    s.projects = [project as never]
    // IP：补默认周边加成
    const ip = {
      id: 'ip-mig',
      name: '《迁移IP》',
      type: 'drama' as const,
      entry: 1,
      originWeek: 1,
      originYear: 1,
      totalBoxOffice: 2000,
      bestBoxOffice: 2000,
      bestCriticScore: 76,
      level: 1,
      royaltyPerQuarter: 12,
      sequelBonus: 1.05,
      royaltyEarned: 0,
      films: [],
    }
    s.company.ips = [ip as never]
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(15)
    const p = migrated.projects[0]
    expect(p.budgetAlloc).toEqual({ story: 0, vfx: 40, acting: 0, edit: 0 })
    expect(p.vfxLevel).toBe(0)
    expect(p.adSponsorIds).toEqual(['ad_tea'])
    expect(migrated.company.ips[0].merchBonus).toBe(0)
  })

  it('v13 存档迁移到 v14：员工获奖履历 week→year（旧档 week 恒为 1，年份按 1 兜底）', () => {
    const s = createInitialState(5)
    s.version = 13
    s.workers['w1'] = {
      ...(createInitialState(6).workers['w1'] ?? {
        id: 'w1',
        name: '测试',
        role: 'director' as const,
        gender: 'male' as const,
        age: 30,
        basic: { pa: 1, ca: 1, fame: 1, hype: 1 },
        mental: { intelligence: 1, focus: 1, gift: 1, dedication: 1, leader: 1, adaptability: 1, versatility: 1 },
        physical: { strong: 1, agility: 1, initiative: 1, disease: 1, charisma: 1, sexy: 1 },
        active: { mood: 1, volume: 1 },
        skills: { acting: 1, directing: 1, shooting: 1, editing: 1, marketing: 1, tech: 1, advertising: 1, vfx: 1 },
        salary: 1,
        currentProjectId: null,
        idleWeeks: 0,
        career: [],
        experience: 0,
      }),
      awards: ([
        { week: 1, award: '最佳导演', projectName: '《旧片》' },
        { week: 1, award: '最佳摄影', projectName: '《旧片2》' },
      ] as unknown) as import('../../core/types').AwardEntry[],
    }
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(15)
    const awards = migrated.workers['w1'].awards
    expect(awards).toHaveLength(2)
    expect(awards[0].year).toBe(1)
    expect(awards[0].award).toBe('最佳导演')
    expect(awards[0].projectName).toBe('《旧片》')
    expect(awards[1].year).toBe(1)
    expect((awards[0] as unknown as Record<string, unknown>).week).toBeUndefined()
  })

  it('v14 存档迁移到 v15：对手补性格/资金池/团队/IP（确定性派生，重复迁移结果一致）', () => {
    const s = createInitialState(7)
    s.version = 14
    s.world.competitors = [
      { id: 'comp-1', name: '远东影业', reputation: 55, nextReleaseIn: 3, history: [] },
      { id: 'comp-2', name: '银河制片', reputation: 40, nextReleaseIn: 6, history: [] },
    ] as unknown as import('../../core/types').Competitor[]
    const first = migrateSave(JSON.parse(JSON.stringify(s)))
    const second = migrateSave(JSON.parse(JSON.stringify(s)))
    expect(first.version).toBe(15)
    expect(second.version).toBe(15)
    for (const c of first.world.competitors) {
      expect(['quality', 'volume', 'specialist', 'sniper', 'balanced']).toContain(c.personality)
      expect(typeof c.cash).toBe('number')
      expect(c.cash).toBeGreaterThan(0)
      // 阶段 4：迁移后自动补团队（3–6 人，员工在 workers 表）
      expect(c.team.length).toBeGreaterThanOrEqual(3)
      for (const id of c.team) expect(first.workers[id]).toBeDefined()
      expect(c.ips).toEqual([])
      if (c.personality === 'specialist') {
        expect(c.homeTypes?.length).toBeGreaterThan(0)
      }
    }
    // 确定性：同档两次迁移结果一致
    expect(JSON.stringify(first.world.competitors)).toBe(JSON.stringify(second.world.competitors))
  })

  it('v11 存档迁移到 v12：渠道改单选、流媒体映射 web、发行商/宣发预算移除', () => {
    const s = createInitialState(4)
    s.version = 11
    const project = {
      id: 'prj-v11',
      name: '《旧渠道片》',
      scriptId: 'scr-2',
      stage: 'marketing',
      team: { directorId: 'w1', actorIds: ['w2'], shooterId: 'w3', editorId: 'w4', marketId: 'w5' },
      totalStages: 8,
      shotStages: 8,
      budgetAlloc: { story: 0, vfx: 20, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
      hype: 60,
      marketingBudget: 100,
      budget: 1000,
      spent: 0,
      editStyle: 'market',
      buffs: 0,
      apAdjust: 0,
      pendingEvents: [],
      channels: ['cinema', 'streaming'],
      publisherId: 'pub1',
      ipId: 'ip-x',
      ipEntry: 1,
    }
    s.projects = [project as never]
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(15)
    const p = migrated.projects[0]
    expect(p.channel).toBe('cinema')
    expect((p as unknown as Record<string, unknown>).channels).toBeUndefined()
    expect((p as unknown as Record<string, unknown>).publisherId).toBeUndefined()
    expect((p as unknown as Record<string, unknown>).marketingBudget).toBeUndefined()
    expect(p.cinemaCount).toBe(0)
    expect(p.warmup).toBe(0)
    expect(p.shotGameBonus).toBe(0)
    expect(p.editGameBonus).toBe(0)
  })
})
