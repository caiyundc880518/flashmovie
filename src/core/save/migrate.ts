import type { Competitor, Critic, GameState, World } from '../types'
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
  return state
}

/** v1 → v2：世界补上空的对手与影评人列表 */
function migrateV1toV2(s: GameState): GameState {
  const world = s.world as World & { competitors?: Competitor[]; critics?: Critic[] }
  world.competitors = world.competitors ?? []
  world.critics = world.critics ?? []
  return { ...s, version: 2 }
}
