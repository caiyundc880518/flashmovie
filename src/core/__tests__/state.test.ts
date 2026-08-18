import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import type { GameState, RoleId } from '../types'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'
import { releaseAndFinish } from './helpers'

/** 构造一个"买得起剧本、有齐全职位员工"的测试状态 */
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

describe('initial state', () => {
  it('新档有现金/市场剧本/候选人/趋势', () => {
    const s = createInitialState(1)
    expect(s.company.cash).toBeGreaterThan(0)
    expect(s.world.marketScripts.length).toBeGreaterThanOrEqual(3)
    expect(s.world.candidates.length).toBeGreaterThanOrEqual(4)
    expect(s.world.trend).not.toBeNull()
    expect(s.projects).toHaveLength(0)
  })
})

describe('reducer 基础动作', () => {
  it('购买剧本：扣款并入库', () => {
    let s = buildReadyState()
    const scriptId = s.world.marketScripts[0].id
    const price = s.world.marketScripts[0].price
    const cashBefore = s.company.cash
    s = reduce(s, { type: 'buyScript', scriptId })
    expect(s.company.cash).toBe(cashBefore - price)
    expect(s.company.ownedScriptIds).toContain(scriptId)
    expect(s.scripts[scriptId].owner).toBe('company')
    expect(s.world.marketScripts.find((x) => x.id === scriptId)).toBeUndefined()
  })

  it('现金不足无法购买', () => {
    let s = buildReadyState()
    s.company.cash = 1
    const scriptId = s.world.marketScripts[0].id
    const before = s.world.marketScripts.length
    s = reduce(s, { type: 'buyScript', scriptId })
    expect(s.world.marketScripts).toHaveLength(before)
  })

  it('出售剧本：回款并有保底价', () => {
    let s = buildReadyState()
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    const cashBefore = s.company.cash
    s = reduce(s, { type: 'sellScript', scriptId })
    expect(s.company.cash).toBeGreaterThan(cashBefore)
    expect(s.company.ownedScriptIds).not.toContain(scriptId)
    expect(s.scripts[scriptId]).toBeUndefined()
  })

  it('雇佣员工与签约编剧', () => {
    let s = buildReadyState()
    const candidateId = s.world.candidates[0].id
    s = reduce(s, { type: 'hireWorker', candidateId })
    expect(s.company.employeeIds).toContain(candidateId)
    expect(s.workers[candidateId]).toBeDefined()
    s = reduce(s, { type: 'hireWriter' })
    const writer = s.company.employeeIds
      .map((id) => s.workers[id])
      .find((w) => w?.role === 'writer' && s.writerQueues[w.id] !== undefined)
    expect(writer).toBeDefined()
  })

  it('贷款受额度上限约束', () => {
    let s = buildReadyState()
    s.company.cash = 100
    s = reduce(s, { type: 'takeLoan', amount: 100000 })
    expect(s.company.loans.length).toBe(1)
    expect(s.company.loans[0].principal).toBe(300) // cap = 100 × 3
  })
})

describe('tick 推进', () => {
  it('推进一周：日历前进、成本扣减', () => {
    let s = buildReadyState()
    const before = s.company.cash
    s = reduce(s, { type: 'advanceWeek' })
    expect(s.calendar.week).toBe(2)
    expect(s.company.cash).toBeLessThan(before)
  })

  it('推进 52 周跨年', () => {
    let s = buildReadyState()
    s.company.cash = 100000
    for (let i = 0; i < 52; i++) s = reduce(s, { type: 'advanceWeek' })
    expect(s.calendar.year).toBe(2)
    expect(s.calendar.week).toBe(1)
  })

  it('编剧按周产剧本', () => {
    let s = buildReadyState()
    s = reduce(s, { type: 'hireWriter' })
    const writer = s.company.employeeIds.map((id) => s.workers[id]).find((w) => s.writerQueues[w.id] !== undefined)!
    const maxWeeks = 8
    let produced = false
    for (let i = 0; i < maxWeeks; i++) {
      s = reduce(s, { type: 'advanceWeek' })
      if (s.company.ownedScriptIds.some((id) => s.scripts[id].writerId === writer.id)) {
        produced = true
        break
      }
    }
    expect(produced).toBe(true)
  })
})

describe('完整电影闭环（立项→拍摄→剪辑→宣发→上映）', () => {
  it('端到端跑通一部电影', () => {
    let s = buildReadyState(42)
    // 买剧本
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    expect(s.company.ownedScriptIds).toHaveLength(1)

    // 立项
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team: {
        directorId: 'test-director',
        actorIds: ['test-actor'],
        shooterId: 'test-shooter',
        editorId: 'test-editor',
        marketId: 'test-market',
      },
      budgetAlloc: { story: 0, vfx: 20, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    expect(s.projects).toHaveLength(1)
    const pid = s.projects[0].id

    // 开拍
    s = reduce(s, { type: 'startShooting', projectId: pid })
    expect(s.projects[0].stage).toBe('shooting')

    // 推进至剪辑（处理沿途随机事件与被动小游戏）
    for (let i = 0; i < 30 && s.projects[0].stage === 'shooting'; i++) {
      s = reduce(s, { type: 'advanceWeek' })
      for (const ev of [...s.projects[0].pendingEvents]) {
        s = reduce(s, { type: 'resolveEvent', projectId: pid, eventId: ev.id, optionIndex: 0 })
      }
      if (s.projects[0].pendingShotGame) {
        s = reduce(s, { type: 'applyShotGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
      }
    }
    expect(s.projects[0].stage).toBe('editing')

    // 剪辑：先完成小游戏，再选取向
    s = reduce(s, { type: 'applyEditGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    s = reduce(s, { type: 'chooseEditStyle', projectId: pid, style: 'market' })
    expect(s.projects[0].stage).toBe('marketing')

    // 宣发 + 定档上映（本周）→ 推进到首轮下片（一次性结算）
    s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
    s = reduce(s, { type: 'setCinemaCount', projectId: pid, count: 100 })
    s = releaseAndFinish(s, pid)

    const p = s.projects[0]
    expect(p.stage).toBe('released')
    expect(p.result).toBeDefined()
    expect(p.result!.boxOffice).toBeGreaterThan(0)
    expect(p.run!.runs.length).toBeGreaterThan(0)
    expect(p.run!.firstRunEnded).toBe(true)
    expect(s.company.history).toHaveLength(1)
    expect(s.workers['test-director'].experience).toBeGreaterThan(0)
    expect(s.workers['test-actor'].career).toHaveLength(1)
    expect(s.workers['test-director'].currentProjectId).toBeNull()
  })

  it('小游戏 Buff 影响成片（质量判定）', () => {
    let s = buildReadyState(7)
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team: {
        directorId: 'test-director',
        actorIds: ['test-actor'],
        shooterId: 'test-shooter',
        editorId: 'test-editor',
        marketId: 'test-market',
      },
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
    const buffBefore = s.projects[0].buffs
    s = reduce(s, { type: 'applyShotBuff', projectId: pid, quality: 'perfect' })
    expect(s.projects[0].buffs).toBeGreaterThan(buffBefore)
    s = reduce(s, { type: 'applyShotBuff', projectId: pid, quality: 'miss' })
    expect(s.projects[0].buffs).toBe(buffBefore + 3 - 1)
  })

  it('剪辑小游戏仅在剪辑阶段生效', () => {
    let s = buildReadyState(8)
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team: {
        directorId: 'test-director',
        actorIds: ['test-actor'],
        shooterId: 'test-shooter',
        editorId: 'test-editor',
        marketId: 'test-market',
      },
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
    // 拍摄阶段剪辑 Buff 无效
    s = reduce(s, { type: 'applyEditBuff', projectId: pid, quality: 'perfect' })
    expect(s.projects[0].buffs).toBe(0)
  })

  it('同一剧本不能重复立项（含已上映后）', () => {
    let s = buildReadyState(11)
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    const team = {
      directorId: 'test-director',
      actorIds: ['test-actor'],
      shooterId: 'test-shooter',
      editorId: 'test-editor',
      marketId: 'test-market',
    }
    s = reduce(s, { type: 'startProject', scriptId, team, budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 }, vfxLevel: 0, adSponsorIds: [] })
    expect(s.projects).toHaveLength(1)
    // 第二次立项同一剧本 → 拒绝
    s = reduce(s, { type: 'startProject', scriptId, team, budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 }, vfxLevel: 0, adSponsorIds: [] })
    expect(s.projects).toHaveLength(1)
  })
})

const RELEASE_TEAM = {
  directorId: 'test-director',
  actorIds: ['test-actor'],
  shooterId: 'test-shooter',
  editorId: 'test-editor',
  marketId: 'test-market',
}

describe('发行渠道（单选四渠道）', () => {
  /** 走完 立项→开拍→剪辑→宣发阶段，返回 marketing 阶段状态 */
  function setupFilm(seed: number) {
    let s = buildReadyState(seed)
    const scriptId = s.world.marketScripts[0].id
    s = reduce(s, { type: 'buyScript', scriptId })
    s = reduce(s, {
      type: 'startProject',
      scriptId,
      team: RELEASE_TEAM,
      budgetAlloc: { story: 0, vfx: 0, acting: 0, edit: 0 },
      vfxLevel: 0,
      adSponsorIds: [],
    })
    const pid = s.projects[0].id
    s = reduce(s, { type: 'startShooting', projectId: pid })
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
    return { s, pid }
  }

  it('影院渠道：投放影院越多收入越高，成本按家数计', () => {
    const mk = (seed: number, count: number) => {
      let { s, pid } = setupFilm(seed)
      s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
      s = reduce(s, { type: 'setCinemaCount', projectId: pid, count })
      s = reduce(s, { type: 'release', projectId: pid, weeks: 0 })
      s = reduce(s, { type: 'advanceWeek' }) // 首周结算
      const run = s.projects[0].run!.runs[0]
      return { run, cash: s.company.cash, s, pid }
    }
    const small = mk(21, 100)
    const big = mk(22, 300)
    expect(big.run.weekly[0].revenue).toBeGreaterThan(small.run.weekly[0].revenue)
    // 成本 = 家数 × 单价（开映当周从现金扣）
    expect(small.run.channelCost).toBeCloseTo(100 * 0.2, 1)
    expect(big.run.channelCost).toBeCloseTo(300 * 0.2, 1)
  })

  it('宣发阶段之外不能改渠道', () => {
    let { s, pid } = setupFilm(24)
    s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
    s = reduce(s, { type: 'release', projectId: pid, weeks: 0 })
    const r = s.projects[0].result!
    // 已上映后改渠道 → 拒绝
    s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'dvd' })
    expect(s.projects[0].result!.channel).toBe('cinema')
    expect(s.projects[0].result!.channels).toEqual(['cinema'])
    void r
  })
})
