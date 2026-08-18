import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import type { GameState, RoleId } from '../types'
import { createRng } from '../rng'
import { generateWorker } from '../generators/workerGen'

const TEAM = {
  directorId: 'e-director',
  actorIds: ['e-actor'],
  shooterId: 'e-shooter',
  editorId: 'e-editor',
  marketId: 'e-market',
}

function playOneFilm(s: GameState, scriptId: string): GameState {
  s = reduce(s, { type: 'buyScript', scriptId })
  s = reduce(s, { type: 'startProject', scriptId, team: TEAM, budgetAlloc: { story: 0, vfx: 20, acting: 0, edit: 0 }, vfxLevel: 0, adSponsorIds: [] })
  const pid = s.projects[s.projects.length - 1].id
  s = reduce(s, { type: 'startShooting', projectId: pid })
  for (let i = 0; i < 40; i++) {
    const p = s.projects.find((x) => x.id === pid)
    if (!p || p.stage === 'released') break
    // 拍摄阶段：处理随机事件 + 被动小游戏（不处理则无法推进）
    if (p.stage === 'shooting') {
      for (const ev of [...p.pendingEvents]) {
        s = reduce(s, { type: 'resolveEvent', projectId: pid, eventId: ev.id, optionIndex: 0 })
      }
      const cur = s.projects.find((x) => x.id === pid)!
      if (cur.pendingShotGame) {
        s = reduce(s, { type: 'applyShotGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
      }
    }
    // 剪辑阶段：必须完成小游戏才能推进/选取向
    const cur = s.projects.find((x) => x.id === pid)!
    if (cur.stage === 'editing' && !cur.editGameDone) {
      s = reduce(s, { type: 'applyEditGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    }
    s = reduce(s, { type: 'advanceWeek' })
    const after = s.projects.find((x) => x.id === pid)!
    if (after.stage === 'editing' && !after.editGameDone) {
      s = reduce(s, { type: 'applyEditGame', projectId: pid, qualities: ['perfect', 'perfect', 'perfect'] })
    }
    // 剪辑完成 → 选取向 → marketing
    if (after.stage === 'editing' && after.editGameDone) {
      s = reduce(s, { type: 'chooseEditStyle', projectId: pid, style: 'market' })
    }
  }
  s = reduce(s, { type: 'setChannel', projectId: pid, channel: 'cinema' })
  s = reduce(s, { type: 'setCinemaCount', projectId: pid, count: 100 })
  s = reduce(s, { type: 'release', projectId: pid })
  return s
}

describe('经济平衡冒烟', () => {
  it('连续拍摄三部电影后公司现金流健康', () => {
    let s = createInitialState(2024)
    s.company.cash = 5000
    const rng = createRng(9)
    for (const role of ['director', 'actor', 'shooter', 'editor', 'market'] as RoleId[]) {
      const w = generateWorker(rng, role, 'rookie')
      w.id = `e-${role}`
      s.workers[w.id] = w
      s.company.employeeIds.push(w.id)
    }

    for (let i = 0; i < 3; i++) {
      let scriptId = s.world.marketScripts[0]?.id
      let guard = 0
      while (!scriptId && guard < 12) {
        s = reduce(s, { type: 'advanceWeek' })
        scriptId = s.world.marketScripts[0]?.id
        guard += 1
      }
      if (!scriptId) throw new Error('剧本市场一直为空')
      s = playOneFilm(s, scriptId)
    }

    expect(s.company.history).toHaveLength(3)
    const avgBox = s.company.history.reduce((a, h) => a + h.boxOffice, 0) / 3
    expect(avgBox).toBeGreaterThan(300) // 平均票房不至于崩盘
    expect(s.company.cash).toBeGreaterThan(0) // 不破产
  })
})
