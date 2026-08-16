import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import { createRng } from '../rng'
import { competitionPenalty, computeCriticScore } from '../rules/scoring'
import { generateScript } from '../generators/scriptGen'
import { migrateSave } from '../save/migrate'
import { WORLD_CONFIG } from '../config/world'
import type { FilmProject, GameState } from '../types'

describe('世界模拟', () => {
  it('新档生成对手/影评人/发行商', () => {
    const s = createInitialState(5)
    expect(s.world.competitors.length).toBeGreaterThanOrEqual(WORLD_CONFIG.competitorCount[0])
    expect(s.world.competitors.length).toBeLessThanOrEqual(WORLD_CONFIG.competitorCount[1])
    expect(s.world.critics).toHaveLength(5) // 影评人固定 5 位
    expect(s.world.publishers.length).toBeGreaterThan(0)
  })

  it('推进一段时间后对手上映影片', () => {
    let s = createInitialState(7)
    for (let i = 0; i < 40; i++) s = reduce(s, { type: 'advanceWeek' })
    const totalFilms = s.world.competitors.reduce((a, c) => a + c.history.length, 0)
    expect(totalFilms).toBeGreaterThan(0)
  })

  it('同周对手上映产生档期竞争惩罚（有上限）', () => {
    let s = createInitialState(9)
    const c = s.world.competitors[0]
    c.history.push({
      week: s.calendar.week,
      year: s.calendar.year,
      name: '对手片',
      ap: 50,
      mp: 50,
      boxOffice: 1000,
    })
    const penalty = competitionPenalty(s, s.calendar.week)
    expect(penalty).toBeGreaterThan(0)
    expect(penalty).toBeLessThanOrEqual(WORLD_CONFIG.competition.maxPenalty)
  })

  it('上周的对手片也算档期重叠', () => {
    let s = createInitialState(10)
    const c = s.world.competitors[0]
    c.history.push({
      week: s.calendar.week - 1,
      year: s.calendar.year,
      name: '上周对手片',
      ap: 50,
      mp: 50,
      boxOffice: 1000,
    })
    expect(competitionPenalty(s, s.calendar.week)).toBeGreaterThan(0)
  })

  it('影评人类型偏好影响打分', () => {
    let s = createInitialState(11)
    s.world.critics = [{ id: 'c1', name: '甲', taste: 'action', influence: 60 }]
    const script = generateScript(createRng(3), 'company')
    script.type = 'action'
    s.scripts[script.id] = script
    const project = { id: 'p1', scriptId: script.id } as unknown as FilmProject
    const score = computeCriticScore(s, project, 60, createRng(1))
    expect(score).toBeGreaterThan(6) // 10 分制：ap/10=6，偏好 +1.0
  })

  it('v1 存档迁移到最新并自动补生成世界实体', () => {
    const s = createInitialState(13)
    const v1 = JSON.parse(JSON.stringify(s)) as GameState
    v1.version = 1
    delete (v1.world as { competitors?: unknown }).competitors
    delete (v1.world as { critics?: unknown }).critics
    delete (v1.world as { publishers?: unknown }).publishers
    for (const p of v1.projects) delete (p as { channels?: unknown }).channels
    const migrated = migrateSave(v1)
    expect(migrated.version).toBe(9)
    expect(migrated.world.competitors.length).toBeGreaterThanOrEqual(
      WORLD_CONFIG.competitorCount[0],
    )
    expect(migrated.world.critics.length).toBeGreaterThanOrEqual(WORLD_CONFIG.criticCount[0])
    expect(migrated.world.audience.length).toBeGreaterThan(0)
    expect(migrated.world.publishers.length).toBeGreaterThan(0)
    expect(migrated.world.investors.length).toBeGreaterThan(0)
    expect(migrated.company.ips).toEqual([])
    expect(migrated.company.tech).toEqual({})
  })

  it('v2 空世界档也能补生成（兼容早期 v2）', () => {
    const s = createInitialState(17)
    s.version = 2
    s.world.competitors = []
    s.world.critics = []
    delete (s.world as { publishers?: unknown }).publishers
    delete (s.world as { investors?: unknown }).investors
    const migrated = migrateSave(s)
    expect(migrated.version).toBe(9)
    expect(migrated.world.competitors.length).toBeGreaterThan(0)
    expect(migrated.world.critics).toHaveLength(5)
    expect(migrated.world.publishers.length).toBeGreaterThan(0)
    expect(migrated.world.investors.length).toBeGreaterThan(0)
  })

  it('旧档影评人不足 5 位时迁移补足', () => {
    const s = createInitialState(19)
    s.world.critics = [
      { id: 'crit1', name: '陆离', taste: 'comedy', influence: 70 },
      { id: 'crit2', name: '白墨', taste: 'action', influence: 60 },
      { id: 'crit3', name: '苏晚', taste: 'none', influence: 50 },
    ]
    const migrated = migrateSave(s)
    expect(migrated.world.critics).toHaveLength(5)
    const names = migrated.world.critics.map((c) => c.name)
    expect(new Set(names).size).toBe(5) // 名字不重复
    const ids = migrated.world.critics.map((c) => c.id)
    expect(new Set(ids).size).toBe(5) // id 不冲突
  })
})
