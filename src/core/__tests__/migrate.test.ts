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
    expect(migrated.version).toBe(13)
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
    expect(migrated.version).toBe(13)
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
    expect(migrated.version).toBe(13)
    const p = migrated.projects[0]
    expect(p.budgetAlloc).toEqual({ story: 0, vfx: 40, acting: 0, edit: 0 })
    expect(p.vfxLevel).toBe(0)
    expect(p.adSponsorIds).toEqual(['ad_tea'])
    expect(migrated.company.ips[0].merchBonus).toBe(0)
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
    expect(migrated.version).toBe(13)
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
