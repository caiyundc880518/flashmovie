import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import type { GameState, RoleId } from '../types'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'

/** 构造"买得起剧本、有齐全职位员工"的测试状态 */
function buildReadyState(seed = 42): GameState {
  const s = createInitialState(seed)
  s.company.cash = 10000
  const rng = createRng(seed + 1)
  const roles: RoleId[] = ['director', 'actor', 'shooter', 'editor', 'market']
  for (const role of roles) {
    const w = generateWorker(rng, role, 'pro')
    w.id = `test-${role}`
    s.workers[w.id] = w
    s.company.employeeIds.push(w.id)
  }
  return s
}

const team = {
  directorId: 'test-director',
  actorIds: ['test-actor'],
  shooterId: 'test-shooter',
  editorId: 'test-editor',
  marketId: 'test-market',
}

/** 买剧本 → 立项 → 开拍，返回（状态, 项目 id） */
function startShooting(s: GameState) {
  const scriptId = s.world.marketScripts[0].id
  let st = reduce(s, { type: 'buyScript', scriptId })
  st = reduce(st, {
    type: 'startProject',
    scriptId,
    team,
    budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
    vfxLevel: 0,
    adSponsorIds: [],
  })
  const pid = st.projects[0].id
  st = reduce(st, { type: 'startShooting', projectId: pid })
  return { st, pid }
}

describe('取消未上映项目', () => {
  it('取消后项目移除、剧组人员释放回池、投入不退', () => {
    let s = buildReadyState(42)
    const { st, pid } = startShooting(s)
    s = st
    const p = s.projects[0]
    const cashAfterStart = s.company.cash
    // 立项后剧组员工均标记为当前项目
    for (const id of Object.values(p.team).flat()) {
      if (id) expect(s.workers[id].currentProjectId).toBe(pid)
    }
    s = reduce(s, { type: 'cancelProject', projectId: pid })
    expect(s.projects).toHaveLength(0)
    // 投入不退：现金不变
    expect(s.company.cash).toBe(cashAfterStart)
    // 人员释放：回到员工池
    expect(s.workers['test-director'].currentProjectId).toBeNull()
    expect(s.workers['test-actor'].currentProjectId).toBeNull()
    expect(s.workers['test-shooter'].currentProjectId).toBeNull()
    expect(s.workers['test-editor'].currentProjectId).toBeNull()
    expect(s.workers['test-market'].currentProjectId).toBeNull()
    // 新闻记录沉没投入
    expect(s.world.news.some((n) => n.text.includes('取消'))).toBe(true)
  })

  it('筹备阶段预热投入同样不退还', () => {
    let s = buildReadyState(43)
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team,
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'setWarmup', projectId: pid, amount: 100 })
    const cashAfterWarmup = s.company.cash
    s = reduce(s, { type: 'cancelProject', projectId: pid })
    expect(s.projects).toHaveLength(0)
    expect(s.company.cash).toBe(cashAfterWarmup)
  })

  it('已上映项目不能取消', () => {
    let s = buildReadyState(7)
    const { st, pid } = startShooting(s)
    s = st
    // 推进到剪辑
    for (let i = 0; i < 40 && s.projects[0].stage === 'shooting'; i++) {
      s = reduce(s, { type: 'advanceWeek' })
      for (const ev of [...s.projects[0].pendingEvents]) {
        s = reduce(s, { type: 'resolveEvent', projectId: pid, eventId: ev.id, optionIndex: 0 })
      }
      if (s.projects[0].pendingShotGame) {
        s = reduce(s, { type: 'applyShotGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
      }
    }
    expect(s.projects[0].stage).toBe('editing')
    // 剪辑 + 宣发 + 上映
    s = reduce(s, { type: 'applyEditGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    s = reduce(s, { type: 'chooseEditStyle', projectId: pid, style: 'market' })
    s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
    s = reduce(s, { type: 'setCinemaCount', projectId: pid, count: 100 })
    s = reduce(s, { type: 'release', projectId: pid })
    expect(s.projects[0].stage).toBe('released')
    // 已上映 → 取消被拒绝
    const before = s.projects.length
    s = reduce(s, { type: 'cancelProject', projectId: pid })
    expect(s.projects).toHaveLength(before)
    expect(s.projects[0].stage).toBe('released')
  })

  it('取消后同一剧本可再次立项', () => {
    let s = buildReadyState(11)
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team,
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'cancelProject', projectId: pid })
    expect(s.projects).toHaveLength(0)
    // 取消后剧本未被消耗，可再次立项
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team,
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    expect(s.projects).toHaveLength(1)
    expect(s.projects[0].scriptId).toBe(scriptId)
  })
})
