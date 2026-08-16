import type {
  AudienceGroup,
  Competitor,
  Critic,
  FilmProject,
  GameState,
  Investor,
  IpAsset,
  Publisher,
  World,
} from '../types'
import { createRng } from '../rng'
import {
  generateAudienceGroups,
  generateCompetitors,
  generateCritics,
  generateInvestors,
  generatePublishers,
} from '../generators/worldGen'
import { SAVE_VERSION } from './schema'

/**
 * 存档迁移链：按版本逐级升级到最新。
 * v2：世界新增 competitors / critics（AI 对手 + 影评人）。
 * v3：世界新增 publishers（发行商）；项目新增 channels（发行渠道）。
 * v4：世界新增 investors（投资人）；公司新增 schoolLevel。
 * v5：公司新增 ips（IP 资产，GDD §3.8）。
 * v6：公司新增 tech（科技树研发进度）。
 * v7：世界新增 audience（观众群体，GDD §6）。
 */
export function migrateSave(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('存档损坏：不是有效对象')
  }
  const s = raw as { version?: unknown }
  if (typeof s.version !== 'number' || s.version <= 0 || s.version > SAVE_VERSION) {
    throw new Error(`存档版本不受支持：${String(s.version)}`)
  }

  let state = raw as GameState
  if (state.version === 1) state = migrateV1toV2(state)
  if (state.version === 2) state = migrateV2toV3(state)
  if (state.version === 3) state = migrateV3toV4(state)
  if (state.version === 4) state = migrateV4toV5(state)
  if (state.version === 5) state = migrateV5toV6(state)
  if (state.version === 6) state = migrateV6toV7(state)
  // 兼容修复：世界实体为空时按种子补生成（覆盖迁移与早期空档）
  state = ensureWorldPopulated(state)
  return state
}

/** v1 → v2：世界补上空的对手与影评人列表（由 ensureWorldPopulated 实际生成） */
function migrateV1toV2(s: GameState): GameState {
  const world = s.world as World & { competitors?: Competitor[]; critics?: Critic[] }
  world.competitors = world.competitors ?? []
  world.critics = world.critics ?? []
  return { ...s, version: 2 }
}

/** v2 → v3：世界补发行商；项目补发行渠道（空 = 默认影院） */
function migrateV2toV3(s: GameState): GameState {
  const world = s.world as World & { publishers?: Publisher[] }
  world.publishers = world.publishers ?? []
  for (const p of s.projects) {
    const project = p as FilmProject & { channels?: FilmProject['channels'] }
    if (!Array.isArray(project.channels)) project.channels = []
  }
  return { ...s, version: 3 }
}

/** v3 → v4：世界补投资人；公司补写作学校等级 */
function migrateV3toV4(s: GameState): GameState {
  const world = s.world as World & { investors?: Investor[] }
  world.investors = world.investors ?? []
  if (typeof s.company.schoolLevel !== 'number') {
    ;(s.company as { schoolLevel?: number }).schoolLevel = 0
  }
  return { ...s, version: 4 }
}

/** v4 → v5：公司补 IP 资产列表 */
function migrateV4toV5(s: GameState): GameState {
  const company = s.company as { ips?: IpAsset[] }
  if (!Array.isArray(company.ips)) company.ips = []
  return { ...s, version: 5 }
}

/** v5 → v6：公司补科技树研发进度 */
function migrateV5toV6(s: GameState): GameState {
  const company = s.company as { tech?: Record<string, number> }
  if (!company.tech || typeof company.tech !== 'object') company.tech = {}
  return { ...s, version: 6 }
}

/** v6 → v7：世界补观众群体（由 ensureWorldPopulated 实际生成） */
function migrateV6toV7(s: GameState): GameState {
  const world = s.world as World & { audience?: AudienceGroup[] }
  if (!Array.isArray(world.audience)) world.audience = []
  return { ...s, version: 7 }
}

/** 世界实体为空时，用存档种子派生确定性生成 */
function ensureWorldPopulated(s: GameState): GameState {
  const world = s.world as World & {
    competitors?: Competitor[]
    critics?: Critic[]
    audience?: AudienceGroup[]
    publishers?: Publisher[]
    investors?: Investor[]
  }
  const needAll = !Array.isArray(world.competitors) || world.competitors.length === 0
  const needCritics = !Array.isArray(world.critics) || world.critics.length === 0
  const needAudience = !Array.isArray(world.audience) || world.audience.length === 0
  const needPubs = !Array.isArray(world.publishers) || world.publishers.length === 0
  const needInvs = !Array.isArray(world.investors) || world.investors.length === 0
  if (needAll || needCritics || needAudience || needPubs || needInvs) {
    const rng = createRng((s.seed ^ 0x51a7) >>> 0)
    let n = 1
    const uid = (p: string) => `${p}${(n++).toString(36)}`
    if (needAll) world.competitors = generateCompetitors(rng, uid)
    if (needCritics) world.critics = generateCritics(rng, uid)
    if (needAudience) world.audience = generateAudienceGroups(rng, uid)
    if (needPubs) world.publishers = generatePublishers(rng, uid)
    if (needInvs) world.investors = generateInvestors(rng, uid)
  }
  return s
}
