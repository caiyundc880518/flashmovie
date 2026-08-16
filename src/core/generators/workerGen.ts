import type { Gender, RoleId, SkillMap, Worker } from '../types'
import { FILM_TYPES, SKILL_KEYS } from '../types'
import { BASE_SALARY_BY_ROLE, ROLES } from '../config/roles'
import { ECONOMY } from '../config/economy'
import { RECRUIT_POOL_MAP, type RecruitPoolId } from '../config/recruit'
import { generateName } from '../config/names'
import type { Rng } from '../rng'
import { clamp, pick, randInt, round1, weightedPick } from '../rng'

export type WorkerTier = 'rookie' | 'pro'

/** PA/CA 生成区间覆盖（招聘档位用） */
export interface PoolOverrides {
  pa: [number, number]
  ca: [number, number]
}

/**
 * 职位生成权重（招聘市场人才结构，GDD §4.4）
 * 每部电影需 1–3 名演员（其他职位各 1 名），因此演员权重最高；
 * 制片人/助理为可选辅助职位，权重较低。
 */
const ROLE_WEIGHTS: ReadonlyArray<readonly [number, RoleId]> = [
  [3.0, 'actor'],
  [1.2, 'director'],
  [1.2, 'shooter'],
  [1.2, 'editor'],
  [1.2, 'market'],
  [0.8, 'technician'],
  [0.8, 'writer'],
  [0.6, 'producer'],
  [0.6, 'assistant'],
]

/**
 * 生成员工（V1 基础属性与技能，来源 GDD §4.2/§4.3）
 * @param tier rookie=高潜力新人（PA 高 CA 低），pro=熟手（CA 高）
 * @param overrides 可选：用指定区间生成 PA/CA（招聘市场档位）
 */
export function generateWorker(
  rng: Rng,
  role?: RoleId,
  tier: WorkerTier = 'rookie',
  overrides?: PoolOverrides,
): Worker {
  const gender: Gender = rng() < 0.5 ? 'male' : 'female'
  const roleId = role ?? weightedPick(rng, ROLE_WEIGHTS)
  const age = randInt(rng, 20, 45)
  const height = gender === 'male' ? randInt(rng, 168, 188) : randInt(rng, 158, 176)
  const weight = gender === 'male' ? randInt(rng, 58, 85) : randInt(rng, 45, 65)

  // 潜力与当前能力
  const pa = overrides ? randInt(rng, overrides.pa[0], overrides.pa[1]) : randInt(rng, 40, 95)
  const ca = overrides
    ? Math.min(pa, randInt(rng, overrides.ca[0], overrides.ca[1]))
    : tier === 'rookie'
      ? Math.min(pa, randInt(rng, 15, 45))
      : Math.min(pa, randInt(rng, 55, 85))

  const fame = tier === 'rookie' ? randInt(rng, 0, 20) : randInt(rng, 30, 70)
  const hype = randInt(rng, 0, 30)

  // 精神/身体属性
  const mental = {
    intelligence: randInt(rng, 30, 80),
    focus: randInt(rng, 30, 80),
    gift: randInt(rng, 30, 85),
    dedication: randInt(rng, 30, 85),
    leader: randInt(rng, 20, 80),
    adaptability: randInt(rng, 30, 80),
    versatility: randInt(rng, 20, 70),
  }
  const physical = {
    strong: randInt(rng, 30, 80),
    agility: randInt(rng, 30, 80),
    initiative: randInt(rng, 30, 80),
    disease: randInt(rng, 40, 90),
    charisma: randInt(rng, 30, 85),
    sexy: randInt(rng, 20, 80),
  }

  // 技能：主职位技能接近 CA，其余为 CA 的一定比例
  const skills: SkillMap = { act: 0, direct: 0, shoot: 0, edit: 0, market: 0, technical: 0, advertise: 0, vfx: 0 }
  const mainSkill = ROLES[roleId].skill
  for (const key of SKILL_KEYS) {
    if (mainSkill === key) {
      skills[key] = clamp(Math.round(ca * randInt(rng, 80, 110) / 100), 0, 100)
    } else {
      skills[key] = clamp(Math.round(ca * randInt(rng, 30, 60) / 100), 0, 100)
    }
  }

  const avgSkill = SKILL_KEYS.reduce((s, k) => s + skills[k], 0) / SKILL_KEYS.length
  const salary = round1(BASE_SALARY_BY_ROLE[roleId] + avgSkill * ECONOMY.salaryPerSkillPoint)

  const mainType = rng() < 0.3 ? 'none' : pick(rng, FILM_TYPES)

  return {
    id: '',
    name: generateName(rng),
    role: roleId,
    gender,
    age,
    basic: { pa, ca, fame, hype, mainType, height, weight },
    mental,
    physical,
    active: { mood: randInt(rng, 55, 85), volume: randInt(rng, 55, 90) },
    skills,
    salary,
    currentProjectId: null,
    idleWeeks: 0,
    career: [],
    awards: [],
    experience: 0,
  }
}

/** 生成一批候选人（招聘市场） */
export function generateCandidates(rng: Rng, count: number, pool?: RecruitPoolId): Worker[] {
  const out: Worker[] = []
  for (let i = 0; i < count; i++) {
    if (!pool) {
      // 常规市场刷新：默认 7:3 新人/熟手
      out.push(generateWorker(rng, undefined, rng() < 0.7 ? 'rookie' : 'pro'))
      continue
    }
    // 三档抽卡式刷新：按档位概率决定 CA/PA 区间
    const cfg = RECRUIT_POOL_MAP[pool]
    const highPa = rng() < cfg.highPaChance
    const highCa = rng() < cfg.highCaChance
    out.push(
      generateWorker(rng, undefined, highCa ? 'pro' : 'rookie', {
        pa: highPa ? cfg.paHigh : cfg.paLow,
        ca: highCa ? cfg.caHigh : cfg.caLow,
      }),
    )
  }
  return out
}
