import { get, set, del } from 'idb-keyval'
import type { GameState } from '../types'
import { SAVE_KEY } from './schema'
import { migrateSave } from './migrate'

/** 读取存档（无存档返回 null） */
export async function loadSave(): Promise<GameState | null> {
  try {
    const raw = await get(SAVE_KEY)
    if (!raw) return null
    return migrateSave(raw)
  } catch {
    return null
  }
}

let timer: ReturnType<typeof setTimeout> | null = null

/** 防抖保存（2s） */
export function scheduleSave(state: GameState): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void set(SAVE_KEY, state)
  }, 2000)
}

/** 立即保存 */
export async function saveNow(state: GameState): Promise<void> {
  await set(SAVE_KEY, state)
}

/** 清除存档 */
export async function clearSave(): Promise<void> {
  await del(SAVE_KEY)
}
