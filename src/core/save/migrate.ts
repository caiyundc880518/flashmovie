import type { GameState } from '../types'
import { SAVE_VERSION } from './schema'

/**
 * 存档迁移链：按版本逐级升级到最新。
 * v1 为初始结构，暂无迁移。
 */
export function migrateSave(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('存档损坏：不是有效对象')
  }
  const s = raw as { version?: unknown }
  if (typeof s.version !== 'number' || s.version <= 0 || s.version > SAVE_VERSION) {
    throw new Error(`存档版本不受支持：${String(s.version)}`)
  }
  // 未来：if (version < 2) raw = migrateV1toV2(raw)
  return raw as GameState
}
