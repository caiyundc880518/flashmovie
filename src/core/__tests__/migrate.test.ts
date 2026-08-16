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

  it('接受 v9 存档（恒等迁移）', () => {
    const s = createInitialState(1)
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(9)
    expect(migrated.company.name).toBe('星光影业')
    expect(migrated.company.ips).toEqual([])
    expect(migrated.company.tech).toEqual({})
    expect(migrated.world.competitors.length).toBeGreaterThan(0)
    expect(migrated.world.audience.length).toBeGreaterThan(0)
    expect(migrated.world.activeEvents).toEqual([])
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
    expect(migrated.version).toBe(9)
    expect(migrated.company.tech).toEqual({})
    expect(migrated.world.audience.length).toBeGreaterThan(0)
    expect(migrated.world.activeEvents).toEqual([])
  })
})
