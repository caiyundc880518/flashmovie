import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import { generateWorker, generateCandidates } from '../generators/workerGen'
import { generateScript, generateMarketScripts } from '../generators/scriptGen'
import { ROLE_IDS, FILM_TYPES } from '../types'
import { SCRIPT_POOL } from '../config/scripts'
import { vfxTier, vfxTypeFactor } from '../rules/scoring'

describe('worker generator', () => {
  it('属性与技能在合法范围，CA ≤ PA', () => {
    const r = createRng(9)
    for (let i = 0; i < 50; i++) {
      const w = generateWorker(r, 'actor', 'rookie')
      expect(w.name.length).toBeGreaterThanOrEqual(2)
      expect(w.basic.pa).toBeGreaterThanOrEqual(0)
      expect(w.basic.pa).toBeLessThanOrEqual(100)
      expect(w.basic.ca).toBeLessThanOrEqual(w.basic.pa)
      expect(w.skills.act).toBeGreaterThanOrEqual(0)
      expect(w.skills.act).toBeLessThanOrEqual(100)
      expect(w.salary).toBeGreaterThan(0)
      expect(ROLE_IDS).toContain(w.role)
    }
  })

  it('pro 熟手 CA 高于 rookie 新人（同种子下按类型）', () => {
    const r1 = createRng(3)
    const rookie = generateWorker(r1, 'actor', 'rookie')
    const r2 = createRng(3)
    const pro = generateWorker(r2, 'actor', 'pro')
    // 新人 CA 上限 45，熟手下限 55，但都受 PA 约束；比较 avg
    const avg = (w: typeof rookie) =>
      (w.skills.act + w.skills.direct + w.skills.shoot + w.skills.edit + w.skills.market) / 5
    expect(avg(pro)).toBeGreaterThan(avg(rookie))
  })

  it('generateCandidates 返回指定数量且 id 占位', () => {
    const r = createRng(11)
    const list = generateCandidates(r, 6)
    expect(list).toHaveLength(6)
  })
})

describe('script generator', () => {
  it('属性在配置范围，市场价在 [20,150]', () => {
    const r = createRng(9)
    for (let i = 0; i < 50; i++) {
      const sc = generateScript(r, 'market')
      expect(sc.scale).toBeGreaterThanOrEqual(4)
      expect(sc.scale).toBeLessThanOrEqual(12)
      expect(sc.price).toBeGreaterThanOrEqual(20)
      expect(sc.price).toBeLessThanOrEqual(150)
      expect(sc.title.length).toBeGreaterThan(0)
    }
  })

  it('自有剧本价格为 0', () => {
    const r = createRng(1)
    const sc = generateScript(r, 'company')
    expect(sc.price).toBe(0)
    expect(sc.owner).toBe('company')
  })

  it('generateMarketScripts 数量正确', () => {
    const r = createRng(2)
    expect(generateMarketScripts(r, 4)).toHaveLength(4)
  })

  it('标题池扩容：每类型 ≥ 12 个，批量生成重名显著下降', () => {
    for (const t of FILM_TYPES) {
      expect(SCRIPT_POOL.titles[t].length).toBeGreaterThanOrEqual(12)
    }
    const r = createRng(7)
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) seen.add(generateScript(r, 'company').title)
    // 旧池每类型仅 5 个，40 次抽样唯一标题通常 < 6；扩容后应 ≥ 12
    expect(seen.size).toBeGreaterThanOrEqual(12)
  })
})

describe('VFX 分级', () => {
  it('技能越高特效等级越高', () => {
    expect(vfxTier(10).label).toBe('基础特效')
    expect(vfxTier(50).label).toBe('标准特效')
    expect(vfxTier(75).label).toBe('顶级特效')
    expect(vfxTier(90).max).toBeGreaterThan(vfxTier(10).max)
  })

  it('动作/战争类型特效加成更高', () => {
    expect(vfxTypeFactor('action')).toBeGreaterThan(vfxTypeFactor('drama'))
    expect(vfxTypeFactor('war')).toBe(1.2)
  })

  it('所有类型都有加成系数', () => {
    for (const t of FILM_TYPES) {
      expect(vfxTypeFactor(t)).toBeGreaterThan(0)
    }
  })
})
