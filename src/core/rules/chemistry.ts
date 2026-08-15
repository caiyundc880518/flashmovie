import type { FilmProject, GameState, Worker } from '../types'
import { CHEMISTRY } from '../config/company'
import { clamp } from '../rng'

/** 两人相性 0–100：性格相似度（70%）+ 共同合作经验（30%） */
export function pairAffinity(a: Worker, b: Worker): number {
  const sim =
    100 -
    CHEMISTRY.attrs.reduce((sum, k) => {
      const av = k in a.mental ? (a.mental[k as keyof typeof a.mental] as number) : (a.physical[k as keyof typeof a.physical] as number)
      const bv = k in b.mental ? (b.mental[k as keyof typeof b.mental] as number) : (b.physical[k as keyof typeof b.physical] as number)
      return sum + Math.abs(av - bv)
    }, 0) /
      CHEMISTRY.attrs.length
  const collab = Math.min(CHEMISTRY.collabCap, collaborations(a, b) * CHEMISTRY.collabPer)
  return clamp(sim * 0.7 + collab * 0.3, 0, 100)
}

/** 两人共同合作过的项目数（按项目名匹配履历） */
export function collaborations(a: Worker, b: Worker): number {
  const aNames = new Set(a.career.map((c) => c.projectName))
  return b.career.filter((c) => aNames.has(c.projectName)).length
}

/** 团队化学 0–100：所有成员两两相性的均值；不足两人取 50 */
export function teamChemistry(state: GameState, project: FilmProject): number {
  const members = teamMemberIds(project)
    .map((id) => state.workers[id])
    .filter((w): w is Worker => !!w)
  if (members.length < 2) return 50
  let total = 0
  let count = 0
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      total += pairAffinity(members[i], members[j])
      count += 1
    }
  }
  return count > 0 ? total / count : 50
}

/** 黄金组合：相性 ≥ 阈值 且 共同合作 ≥ 次数 的搭档 */
export function goldenCombos(state: GameState, project: FilmProject): Array<[string, string]> {
  const members = teamMemberIds(project)
    .map((id) => state.workers[id])
    .filter((w): w is Worker => !!w)
  const combos: Array<[string, string]> = []
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]
      const b = members[j]
      if (collaborations(a, b) >= CHEMISTRY.goldenComboTimes && pairAffinity(a, b) >= CHEMISTRY.goldenThreshold) {
        combos.push([a.id, b.id])
      }
    }
  }
  return combos
}

/** 化学对成片基础分的乘数：0–100 → 0.9–1.1 */
export function chemistryScoreFactor(state: GameState, project: FilmProject): number {
  const chem = teamChemistry(state, project)
  return 1 + ((chem - 50) / 50) * (CHEMISTRY.scoreEffect / 2)
}

/** 化学对拍摄速度的乘数：0–100 → 0.95–1.05 */
export function chemistrySpeedFactor(state: GameState, project: FilmProject): number {
  const chem = teamChemistry(state, project)
  return 1 + ((chem - 50) / 50) * (CHEMISTRY.speedEffect / 2)
}

export function teamMemberIds(project: FilmProject): string[] {
  const ids: string[] = []
  if (project.team.producerId) ids.push(project.team.producerId)
  if (project.team.directorId) ids.push(project.team.directorId)
  if (project.team.writerId) ids.push(project.team.writerId)
  ids.push(...project.team.actorIds)
  if (project.team.shooterId) ids.push(project.team.shooterId)
  if (project.team.editorId) ids.push(project.team.editorId)
  if (project.team.technicianId) ids.push(project.team.technicianId)
  if (project.team.marketId) ids.push(project.team.marketId)
  if (project.team.assistantId) ids.push(project.team.assistantId)
  return ids
}
