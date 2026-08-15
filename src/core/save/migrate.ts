import type { Competitor, Critic, FilmProject, GameState, Publisher, World } from '../types'
import { createRng } from '../rng'
import {
  generateCompetitors,
  generateCritics,
  generatePublishers,
} from '../generators/worldGen'
import { SAVE_VERSION } from './schema'

/**
 * 存档迁移链：按版本逐级升级到最新。
 * v2：世界新增 competitors / critics（AI 对手 + 影评人）。
 * v3：世界新增 publishers（发行商）；项目新增 channels（发行渠道）。
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

/** 世界实体为空时，用存档种子派生确定性生成 */
function ensureWorldPopulated(s: GameState): GameState {
  const world = s.world as World & {
    competitors?: Competitor[]
    critics?: Critic[]
    publishers?: Publisher[]
  }
  const needAll = !Array.isArray(world.competitors) || world.competitors.length === 0
  const needCritics = !Array.isArray(world.critics) || world.critics.length === 0
  const needPubs = !Array.isArray(world.publishers) || world.publishers.length === 0
  if (needAll || needCritics || needPubs) {
    const rng = createRng((s.seed ^ 0x51a7) >>> 0)
    let n = 1
    const uid = (p: string) => `${p}${(n++).toString(36)}`
    if (needAll) world.competitors = generateCompetitors(rng, uid)
    if (needCritics) world.critics = generateCritics(rng, uid)
    if (needPubs) world.publishers = generatePublishers(rng, uid)
  }
  return s
}
