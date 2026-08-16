import { describe, expect, it } from 'vitest'
import { createInitialState } from '../state/initialState'
import { reduce } from '../state/reducer'
import type { ProjectEvent, Script } from '../types'
import { ECONOMY } from '../config/economy'
import { IPO_CONFIG } from '../config/company'

/**
 * 整局长线模拟（数值平衡冒烟）：
 * 纯核心层 headless 推进。两档策略：
 * - strong：成熟玩家上限（买好剧本/雇熟手/完美小游戏/全渠道/发行商/投资科技学校）
 * - weak：新手最差但合理的打法（只养编剧/雇新手/单渠道/不签约/不投资）
 * 用于检验：前期现金流安全、中期增长曲线、IPO 达成节奏、滚雪球上限。
 */

interface RunReport {
  seed: number
  weeks: number
  endReason: 'ipo' | 'bankrupt' | 'timeout'
  ipoWeek: number
  cash: number
  films: number
  totalBox: number
  employees: number
  ips: number
  techLevel: number
  schoolLevel: number
}

interface SimOptions {
  weak?: boolean
  debug?: boolean
}

const REQUIRED = ['director', 'actor', 'shooter', 'editor', 'market'] as const

function scriptQuality(sc: Script): number {
  return sc.storyPoint * 0.3 + sc.marketPot * 0.4 + sc.artPot * 0.3
}

function pickEventOption(ev: ProjectEvent): number {
  let best = 0
  let bestScore = -Infinity
  ev.options.forEach((o, i) => {
    const score =
      (o.cash ?? 0) * 0.6 +
      (o.buff ?? 0) * 18 +
      (o.hype ?? 0) * 10 +
      (o.ap ?? 0) * 10 +
      (o.morale ?? 0) * 2
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}

function simulateRun(seed: number, maxWeeks = 260, opts: SimOptions = {}): RunReport {
  const weak = !!opts.weak
  let s = createInitialState(seed)
  const report: RunReport = {
    seed,
    weeks: 0,
    endReason: 'timeout',
    ipoWeek: 0,
    cash: 0,
    films: 0,
    totalBox: 0,
    employees: 0,
    ips: 0,
    techLevel: 0,
    schoolLevel: 0,
  }

  for (let w = 1; w <= maxWeeks; w++) {
    if (s.company.cash < -4000) {
      report.endReason = 'bankrupt'
      break
    }

    if (opts.debug && (w === 1 || w % 10 === 0)) {
      const emp = s.company.employeeIds.map((id) => s.workers[id]).filter((x): x is NonNullable<typeof x> => !!x)
      const used = new Set(s.projects.map((p) => p.scriptId))
      const owned = s.company.ownedScriptIds.map((id) => s.scripts[id]).filter((sc) => sc && !used.has(sc.id))
      console.log(
        `[w${w}] cash=${Math.round(s.company.cash)} emp=${emp.map((e) => e.role[0]).join('')} owned=${owned.length} proj=${s.projects.length}`,
      )
    }

    // ===== 项目推进 =====
    for (const p of [...s.projects]) {
      if (p.stage === 'preparing' && s.company.cash > p.budget * 0.2) {
        s = reduce(s, { type: 'startShooting', projectId: p.id })
      }
      if (p.stage === 'shooting') {
        for (const ev of [...p.pendingEvents]) {
          s = reduce(s, { type: 'resolveEvent', projectId: p.id, eventId: ev.id, optionIndex: pickEventOption(ev) })
        }
        if (s.projects.some((x) => x.id === p.id && x.stage === 'shooting')) {
          s = reduce(s, { type: 'applyShotBuff', projectId: p.id, quality: weak ? 'good' : 'perfect' })
        }
      }
      if (s.projects.some((x) => x.id === p.id && x.stage === 'editing')) {
        s = reduce(s, { type: 'chooseEditStyle', projectId: p.id, style: 'market' })
      }
      if (s.projects.some((x) => x.id === p.id && x.stage === 'marketing')) {
        const mp = s.projects.find((x) => x.id === p.id)!
        const budget = weak ? 60 : 120
        if (mp.hype < 60 && s.company.cash > budget + 20) {
          s = reduce(s, { type: 'setMarketingBudget', projectId: p.id, budget })
          if (s.company.cash > 20) s = reduce(s, { type: 'launchMarketing', projectId: p.id })
        }
        if (mp.channels.length === 0) {
          s = reduce(
            s,
            { type: 'setChannels', projectId: p.id, channels: weak ? ['cinema', 'web'] : ['cinema', 'web', 'streaming'] },
          )
        }
        if (!mp.publisherId && !weak && s.world.publishers.length > 0) {
          s = reduce(s, { type: 'selectPublisher', projectId: p.id, publisherId: s.world.publishers[0].id })
        }
        const hypeNeed = weak ? 30 : 45
        if (mp.hype >= hypeNeed) {
          s = reduce(s, { type: 'release', projectId: p.id })
        }
      }
    }

    // ===== 人才：补缺岗位 =====
    const employees = s.company.employeeIds.map((id) => s.workers[id]).filter((x): x is NonNullable<typeof x> => !!x)
    const roles = new Set(employees.map((e) => e.role))
    const wantTech = !weak && s.company.cash > 1500
    for (const role of [...REQUIRED, ...(wantTech ? (['technician'] as const) : [])]) {
      if (role === 'actor') {
        const actorCount = employees.filter((e) => e.role === 'actor').length
        if (actorCount >= (weak ? 1 : 2)) continue
      } else if (roles.has(role)) {
        continue
      }
      if (s.company.cash < ECONOMY.hireWorkerSignFee + 100) break
      // strong：挑 CA 最高的 pro；weak：挑 CA 最低的（便宜新手）
      const cand = [...s.world.candidates]
        .filter((c) => c.role === role)
        .sort((a, b) => (weak ? a.basic.ca - b.basic.ca : b.basic.ca - a.basic.ca))[0]
      if (cand) s = reduce(s, { type: 'hireWorker', candidateId: cand.id })
    }

    // ===== 剧本供给 =====
    const usedNow = new Set(s.projects.map((p) => p.scriptId))
    const availCount = s.company.ownedScriptIds.filter((id) => !usedNow.has(id)).length
    const draftedCount = s.scriptDrafts.length
    if (weak) {
      // 新手：开局买 1 个剧本起步，之后靠一般编剧委托补充（便宜、到货快）
      if (availCount === 0 && draftedCount === 0 && s.company.cash > 200) {
        const best = [...s.world.marketScripts].sort((a, b) => scriptQuality(b) - scriptQuality(a))[0]
        if (best && best.price <= s.company.cash * 0.4) s = reduce(s, { type: 'buyScript', scriptId: best.id })
      }
      if (availCount === 0 && draftedCount === 0 && s.company.cash > 60) {
        s = reduce(s, { type: 'drawScripts', pool: 'common', count: 1 })
      }
    } else {
      if (s.company.cash > 350) {
        const best = [...s.world.marketScripts].sort((a, b) => scriptQuality(b) - scriptQuality(a))[0]
        if (best && best.price <= s.company.cash * 0.25 && scriptQuality(best) >= 50) {
          s = reduce(s, { type: 'buyScript', scriptId: best.id })
        }
      }
      // strong：金牌编剧稳定高质供给
      if (availCount < 3 && draftedCount < 6 && s.company.cash > 500) {
        s = reduce(s, { type: 'drawScripts', pool: 'gold', count: 1 })
      }
    }

    // ===== 立项 =====
    const busy = s.projects.filter((p) => p.stage !== 'released')
    const usedScripts = new Set(s.projects.map((p) => p.scriptId))
    const owned = s.company.ownedScriptIds
      .map((id) => s.scripts[id])
      .filter((sc) => sc && !usedScripts.has(sc.id))
      .sort((a, b) => scriptQuality(b) - scriptQuality(a))
    const cur = employees.filter((e) => !busy.some((p) => Object.values(p.team).flat().includes(e.id)))
    const hasCore =
      cur.some((e) => e.role === 'director') &&
      cur.filter((e) => e.role === 'actor').length >= 1 &&
      cur.some((e) => e.role === 'shooter') &&
      cur.some((e) => e.role === 'editor') &&
      cur.some((e) => e.role === 'market')
    const tech = cur.find((e) => e.role === 'technician')
    if (busy.length === 0 && hasCore && owned.length > 0) {
      const script = owned[0]
      const vfx = tech ? (weak ? 0 : 40) : 0
      const budget = script.scale * ECONOMY.costPerStage * (1 + (vfx / 100) * ECONOMY.vfxCostFactor)
      const reserve = weak ? 1.2 : 1.6
      if (s.company.cash >= budget * reserve) {
        const director = cur.find((e) => e.role === 'director')!
        const actors = cur.filter((e) => e.role === 'actor').slice(0, 2).map((e) => e.id)
        const shooter = cur.find((e) => e.role === 'shooter')!
        const editor = cur.find((e) => e.role === 'editor')!
        const market = cur.find((e) => e.role === 'market')!
        s = reduce(s, {
          type: 'startProject',
          scriptId: script.id,
          team: {
            directorId: director.id,
            actorIds: actors,
            shooterId: shooter.id,
            editorId: editor.id,
            marketId: market.id,
            technicianId: tech?.id,
          },
          vfxPercent: vfx,
          hasAd: s.company.cash < (weak ? 500 : 800),
        })
      }
    }

    // ===== 资金：现金告急时贷款（weak 更晚才贷） =====
    const loanThreshold = weak ? -200 : 200
    if (s.company.cash < loanThreshold) {
      const cap = Math.max(0, s.company.cash * (s.company.public ? IPO_CONFIG.loanCapFactorAfter : ECONOMY.loanCapFactor))
      if (cap > 0) s = reduce(s, { type: 'takeLoan', amount: Math.min(weak ? 800 : 1500, cap) })
    }

    // ===== IPO =====
    if (!s.company.public && s.company.reputation >= IPO_CONFIG.minReputation) {
      const totalRev = s.company.history.reduce((sum, r) => sum + (r.revenue ?? r.boxOffice * ECONOMY.cinemaShare), 0)
      if (totalRev >= IPO_CONFIG.minTotalRevenue) {
        s = reduce(s, { type: 'ipo' })
        if (s.company.public) report.ipoWeek = w
      }
    }

    // ===== 长线投资（strong 玩家） =====
    if (!weak) {
      if (s.company.schoolLevel < 3 && s.company.cash > 3000) {
        s = reduce(s, { type: 'upgradeSchool' })
      }
      if (s.company.cash > 6000) {
        const techLines = ['render', 'studio', 'mocap', 'comp'] as const
        const nextLine = techLines.find((l) => (s.company.tech[l] ?? 0) < 300)
        if (nextLine) s = reduce(s, { type: 'investTech', lineId: nextLine })
      }
    }

    s = reduce(s, { type: 'advanceWeek' })

    report.weeks = w
    report.cash = s.company.cash
    if (s.company.public && report.endReason === 'timeout') report.endReason = 'ipo'
  }

  report.films = s.company.history.length
  report.totalBox = Math.round(s.company.history.reduce((sum, r) => sum + r.boxOffice, 0))
  report.employees = s.company.employeeIds.length
  report.ips = s.company.ips.length
  report.techLevel = Object.values(s.company.tech).reduce((s2, v) => s2 + Math.floor(v / 100), 0)
  report.schoolLevel = s.company.schoolLevel
  return report
}

function printTable(title: string, reports: RunReport[]): void {
  console.log(`\n===== ${title} =====`)
  console.log('种子 | 结束 | IPO周 | 现金(万) | 片数 | 累计票房(万) | 员工 | IP | 科技 | 学校')
  for (const r of reports) {
    console.log(
      `${String(r.seed).padEnd(4)} | ${r.endReason.padEnd(8)} | ${String(r.ipoWeek).padEnd(5)} | ${String(Math.round(r.cash)).padEnd(8)} | ${r.films} | ${r.totalBox} | ${r.employees} | ${r.ips} | ${r.techLevel} | ${r.schoolLevel}`,
    )
  }
  const ipoCount = reports.filter((r) => r.endReason === 'ipo').length
  const bankrupt = reports.filter((r) => r.endReason === 'bankrupt').length
  const avgCash = Math.round(reports.reduce((s2, r) => s2 + r.cash, 0) / reports.length)
  const ipoAvg = reports.filter((r) => r.ipoWeek > 0).reduce((s2, r) => s2 + r.ipoWeek, 0) / Math.max(1, ipoCount)
  console.log(
    `IPO ${ipoCount}/${reports.length} 局 · 破产 ${bankrupt}/${reports.length} · 平均 IPO 周 ${Math.round(ipoAvg)} · 平均现金 ${avgCash} 万`,
  )
}

describe('整局长线模拟（数值平衡）', () => {
  it('strong 策略 12 局：上限曲线', { timeout: 90000 }, () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 17, 19]
    const reports = seeds.map((seed) => simulateRun(seed, 260, {}))
    printTable('strong 策略（12 局 × 260 周）', reports)
    expect(reports.length).toBe(12)
  })

  it('weak 策略 8 局：新手最差可玩性', { timeout: 90000 }, () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8]
    const reports = seeds.map((seed) => simulateRun(seed, 260, { weak: true }))
    printTable('weak 策略（8 局 × 260 周）', reports)
    const bankrupt = reports.filter((r) => r.endReason === 'bankrupt').length
    // 新手最差打法：允许个别局破产（影片类型/市场运气），但应少于半数
    expect(bankrupt).toBeLessThan(reports.length / 2)
    // 至少一半的局能活过 2 年（104 周）
    const survived = reports.filter((r) => r.weeks >= 104).length
    expect(survived).toBeGreaterThanOrEqual(reports.length / 2)
  })
})
