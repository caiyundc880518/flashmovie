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

  it('接受 v4 存档（恒等迁移）', () => {
    const s = createInitialState(1)
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(4)
    expect(migrated.company.name).toBe('星光影业')
    expect(migrated.world.competitors.length).toBeGreaterThan(0)
    expect(migrated.world.publishers.length).toBeGreaterThan(0)
    expect(migrated.world.investors.length).toBeGreaterThan(0)
  })
})
