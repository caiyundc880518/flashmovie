import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { migrateSave } from '../save/migrate'
import { WRITER_POOLS, WRITER_POOL_MAP, TEN_PULL_DISCOUNT, BOOM_RANGE } from '../config/writers'
import type { WriterPoolId } from '../config/writers'

describe('签约编剧抽卡（三档委托创作）', () => {
  it('单抽：扣单价，委托入队，周数在档位范围', () => {
    let s = createInitialState(7)
    s.company.cash = 1000
    s = reduce(s, { type: 'drawScripts', pool: 'common', count: 1 })
    expect(s.company.cash).toBe(1000 - WRITER_POOL_MAP.common.price)
    expect(s.scriptDrafts).toHaveLength(1)
    const d = s.scriptDrafts[0]
    expect(d.tier).toBe('common')
    expect(d.weeksLeft).toBeGreaterThanOrEqual(WRITER_POOL_MAP.common.produceWeeks[0])
    expect(d.weeksLeft).toBeLessThanOrEqual(WRITER_POOL_MAP.common.produceWeeks[1])
  })

  it('10 连抽：扣 9 折总价（单价×10×0.9），10 个委托', () => {
    let s = createInitialState(13)
    s.company.cash = 10000
    s = reduce(s, { type: 'drawScripts', pool: 'gold', count: 10 })
    const total = Math.round(WRITER_POOL_MAP.gold.price * 10 * TEN_PULL_DISCOUNT)
    expect(s.company.cash).toBe(10000 - total)
    expect(s.scriptDrafts).toHaveLength(10)
  })

  it('现金不足：拒绝委托，状态引用不变', () => {
    let s = createInitialState(11)
    s.company.cash = 10
    const before = s.scriptDrafts
    const rejected = reduce(s, { type: 'drawScripts', pool: 'gold', count: 1 })
    expect(rejected).toBe(s)
    expect(rejected.scriptDrafts).toBe(before)
  })

  it('委托到货：剧本进公司剧本库，属性落在档位范围内', () => {
    let s = createInitialState(17)
    s.company.cash = 10000
    s = reduce(s, { type: 'drawScripts', pool: 'pro', count: 1 })
    // 推进到货所需周数
    for (let i = 0; i < WRITER_POOL_MAP.pro.produceWeeks[1] + 1; i++) s = reduce(s, { type: 'advanceWeek' })
    expect(s.scriptDrafts).toHaveLength(0)
    expect(s.company.ownedScriptIds).toHaveLength(1)
    const script = s.scripts[s.company.ownedScriptIds[0]]
    expect(script.owner).toBe('company')
    // 普通属性在档位范围内（爆款只会更高，不会低于）
    expect(script.storyPoint).toBeGreaterThanOrEqual(WRITER_POOL_MAP.pro.storyRange[0])
    expect(script.artPot).toBeGreaterThanOrEqual(WRITER_POOL_MAP.pro.artRange[0])
    expect(script.marketPot).toBeGreaterThanOrEqual(WRITER_POOL_MAP.pro.marketRange[0])
  })

  it('三档质量分层：金牌均值 > 专业 > 一般（大量抽样）', () => {
    const avg = (pool: WriterPoolId): number => {
      const N = 60
      let s = createInitialState(23)
      s.company.cash = 100000
      let sum = 0
      for (let i = 0; i < N; i++) {
        s = reduce(s, { type: 'drawScripts', pool, count: 1 })
      }
      // 全部推进到货
      for (let i = 0; i < 12; i++) s = reduce(s, { type: 'advanceWeek' })
      for (const id of s.company.ownedScriptIds) {
        const sc = s.scripts[id]
        sum += sc.storyPoint * 0.3 + sc.marketPot * 0.4 + sc.artPot * 0.3
      }
      return sum / s.company.ownedScriptIds.length
    }
    const common = avg('common')
    const pro = avg('pro')
    const gold = avg('gold')
    expect(gold).toBeGreaterThan(pro)
    expect(pro).toBeGreaterThan(common)
  })

  it('爆款：一般编剧会爆 MP 超高（marketPot ≥ 92），专业编剧会爆 AP 超高', () => {
    // 一般编剧：200 次抽样应出现 MP 爆款
    const findBoom = (pool: WriterPoolId, attr: 'marketPot' | 'artPot'): boolean => {
      let s = createInitialState(29)
      s.company.cash = 1000000
      for (let i = 0; i < 200; i++) s = reduce(s, { type: 'drawScripts', pool, count: 1 })
      for (let i = 0; i < 12; i++) s = reduce(s, { type: 'advanceWeek' })
      return s.company.ownedScriptIds.some((id) => (s.scripts[id][attr] ?? 0) >= BOOM_RANGE[0])
    }
    expect(findBoom('common', 'marketPot')).toBe(true)
    expect(findBoom('pro', 'artPot')).toBe(true)
  })

  it('写作学校加成委托产出质量', () => {
    let s = createInitialState(31)
    s.company.cash = 100000
    s = reduce(s, { type: 'upgradeSchool' }) // 学校 1 级
    s = reduce(s, { type: 'drawScripts', pool: 'common', count: 1 })
    for (let i = 0; i < 6; i++) s = reduce(s, { type: 'advanceWeek' })
    const script = s.scripts[s.company.ownedScriptIds[0]]
    // 学校 1 级：质量 ×1.1（clamp 100）。一般编剧 artRange 上限 55 → ≤ 60.5
    expect(script.artPot).toBeLessThanOrEqual(60.5 + 1)
    void script
  })

  it('v9 旧档迁移：scriptDrafts 补为空数组', () => {
    const s = createInitialState(37)
    s.version = 9
    delete (s as { scriptDrafts?: unknown }).scriptDrafts
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(10)
    expect(migrated.scriptDrafts).toEqual([])
  })
})

describe('编剧档位配置', () => {
  it('三档价格递增、等待递增、质量递增', () => {
    const [common, pro, gold] = WRITER_POOLS
    expect(pro.price).toBeGreaterThan(common.price)
    expect(gold.price).toBeGreaterThan(pro.price)
    expect(pro.produceWeeks[0]).toBeGreaterThan(common.produceWeeks[0])
    expect(gold.produceWeeks[0]).toBeGreaterThan(pro.produceWeeks[0])
    expect(gold.artRange[0]).toBeGreaterThan(pro.artRange[0])
    expect(pro.artRange[0]).toBeGreaterThan(common.artRange[0])
  })
})
