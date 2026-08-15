import type { Competitor, Critic, GameState, World } from '../types'
import { createRng } from '../rng'
import { generateCompetitors, generateCritics } from '../generators/worldGen'
import { SAVE_VERSION } from './schema'

/**
 * 存档迁移链：按版本逐级升级到最新。
 * v2：世界新增 competitors / critics（AI 对手 + 影评人）。
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
  // 兼容修复：世界实体为空时按种子补生成（覆盖 v1 迁移与 v2 早期空档）
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

/** 世界实体为空时，用存档种子派生确定性生成 */
function ensureWorldPopulated(s: GameState): GameState {
  const world = s.world as World & { competitors?: Competitor[]; critics?: Critic[] }
  if (!Array.isArray(world.competitors) || world.competitors.length === 0) {
    const rng = createRng((s.seed ^ 0x51a7) >>> 0)
    let n = 1
    world.competitors = generateCompetitors(rng, (p) => `${p}${(n++).toString(36)}`)
    world.critics = generateCritics(rng, (p) => `${p}${(n++).toString(36)}`)
  } else if (!Array.isArray(world.critics) || world.critics.length === 0) {
    const rng = createRng((s.seed ^ 0x51a7) >>> 0)
    let n = 1
    world.critics = generateCritics(rng, (p) => `${p}${(n++).toString(36)}`)
  }
  return s
}
