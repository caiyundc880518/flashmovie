import type {
  FilmProject,
  FilmResult,
  GameState,
  RoleId,
  SkillKey,
  Worker,
  WorkerSettlement,
} from '../types'
import { SKILL_KEYS } from '../types'
import { GROWTH } from '../config/growth'
import { clamp, round1 } from '../rng'
import type { Rng } from '../rng'

const MAIN_SKILL_BY_ROLE: Partial<Record<RoleId, SkillKey>> = {
  director: 'direct',
  actor: 'act',
  shooter: 'shoot',
  editor: 'edit',
  market: 'market',
  technician: 'technical',
}

/**
 * 重算 CA（与技能体系自洽）：
 * 有主技能的职位 CA = 主技能（生成时主技能 ≈ CA，结算/衰减不会突变）；
 * 无主技能（制片人/编剧/助理）用 技能均值×0.7 + 峰值×0.3。
 */
export function recalcCA(w: Worker): void {
  const main = MAIN_SKILL_BY_ROLE[w.role]
  if (main) {
    w.basic.ca = clamp(Math.round(w.skills[main]), 0, w.basic.pa)
  } else {
    const keys = Object.keys(w.skills) as SkillKey[]
    const avg = keys.reduce((s, k) => s + w.skills[k], 0) / keys.length
    const max = Math.max(...keys.map((k) => w.skills[k]))
    w.basic.ca = clamp(Math.round(avg * 0.7 + max * 0.3), 0, w.basic.pa)
  }
}

/**
 * 项目结算后员工成长（GDD §4.4 / §7.4）
 * - 经验 += 项目基准 × 职位权重
 * - 技能点 = 经验 × 学习系数 × (1 + Gift/Intelligence 修正)
 * - CA = 0.7×技能均值 + 0.3×技能峰值，上限 PA
 * - Fame 按个人成绩增长；履历追加一条
 * @returns 每位成员的属性变化结算明细（写入 FilmResult.settlement）
 */
export function applyProjectGrowth(
  state: GameState,
  project: FilmProject,
  result: FilmResult,
): WorkerSettlement[] {
  const team = project.team
  const ids: string[] = []
  if (team.producerId) ids.push(team.producerId)
  if (team.directorId) ids.push(team.directorId)
  if (team.writerId) ids.push(team.writerId)
  for (const id of team.actorIds) ids.push(id)
  if (team.shooterId) ids.push(team.shooterId)
  if (team.editorId) ids.push(team.editorId)
  if (team.technicianId) ids.push(team.technicianId)
  if (team.marketId) ids.push(team.marketId)
  if (team.assistantId) ids.push(team.assistantId)

  const settlements: WorkerSettlement[] = []

  for (const workerId of ids) {
    const w = state.workers[workerId]
    if (!w) continue
    const gp = result.groupPerformance.find((g) => g.workerId === workerId)
    const performance = gp?.performance ?? 50
    // 结算前快照
    const caBefore = w.basic.ca
    const skillsBefore = { ...w.skills }
    const fameBefore = w.basic.fame
    const moodBefore = w.active.mood

    const roleWeight = GROWTH.roleExperienceWeight[w.role] ?? 1
    const expGain = GROWTH.experiencePerProject * roleWeight
    w.experience += expGain

    const learnModifier =
      1 +
      (w.mental.gift / 100) * GROWTH.giftBonus * 100 +
      (w.mental.intelligence / 100) * GROWTH.intelBonus * 100
    // learnBase 0.5 → 每 100 经验约 0.5~1 技能点
    const skillGain = (expGain * GROWTH.learnBase * learnModifier) / 100

    const mainSkill = MAIN_SKILL_BY_ROLE[w.role]
    if (mainSkill) {
      w.skills[mainSkill] = clamp(w.skills[mainSkill] + skillGain, 0, 100)
      for (const key of Object.keys(w.skills) as SkillKey[]) {
        if (key !== mainSkill) {
          w.skills[key] = clamp(w.skills[key] + skillGain * 0.3, 0, 100)
        }
      }
    }

    // 重算 CA（与技能自洽：主技能职位 = 主技能）
    recalcCA(w)

    // Fame
    if (performance >= 75) w.basic.fame = clamp(w.basic.fame + 3, 0, 100)
    else if (performance >= 55) w.basic.fame = clamp(w.basic.fame + 1, 0, 100)

    // 心情
    w.active.mood = clamp(w.active.mood + (performance >= 60 ? 2 : -2), 10, 95)

    // 变化明细（只记录实际变化的技能）
    const skillChanges: { key: SkillKey; delta: number }[] = []
    for (const key of SKILL_KEYS) {
      const delta = round1(w.skills[key] - skillsBefore[key])
      if (delta !== 0) skillChanges.push({ key, delta })
    }
    const caGain = w.basic.ca - caBefore
    settlements.push({
      workerId,
      role: gp?.role ?? w.role,
      performance: round1(performance),
      caGain,
      expGain: round1(expGain),
      skillChanges,
      fameGain: round1(w.basic.fame - fameBefore),
      moodGain: round1(w.active.mood - moodBefore),
    })

    w.career.push({
      week: state.calendar.week,
      projectName: project.name,
      role: gp?.role ?? w.role,
      performance: round1(performance),
      caGain,
    })
  }

  return settlements
}

/** 每周员工状态推进：空闲累计与衰减（GDD §4.4） */
export function applyWeeklyWorkerState(w: Worker, inProject: boolean, rng: Rng): void {
  if (inProject) {
    w.idleWeeks = 0
    w.active.mood = clamp(w.active.mood + (rng() < 0.5 ? 1 : 0), 10, 95)
    w.active.volume = clamp(w.active.volume - 0.5, 10, 100)
  } else {
    w.idleWeeks += 1
    w.active.mood = clamp(w.active.mood - 1, 10, 95)
    w.active.volume = clamp(w.active.volume + 0.5, 10, 100)
    if (w.idleWeeks > GROWTH.decayAfterWeeks) {
      const keys = Object.keys(w.skills) as SkillKey[]
      for (const k of keys) {
        w.skills[k] = clamp(w.skills[k] * (1 - GROWTH.decayPerWeek), 0, 100)
      }
      // 同步重算 CA：让 CA 平时就反映真实状态，
      // 避免「空闲期技能衰减、结算时才一次性暴露导致 CA 暴跌」的体验断层
      recalcCA(w)
      w.basic.fame = clamp(w.basic.fame * (1 - GROWTH.fameDecayPerWeek), 0, 100)
    }
  }
}
