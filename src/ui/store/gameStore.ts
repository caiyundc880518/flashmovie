import { create } from 'zustand'
import type { GameState } from '../../core/types'
import type { Action } from '../../core/state/actions'
import { reduce } from '../../core/state/reducer'
import { createInitialState } from '../../core/state/initialState'
import { clearSave, loadSave, saveNow, scheduleSave } from '../../core/save/storage'

interface GameStore {
  state: GameState | null
  booted: boolean
  dispatch: (action: Action) => void
  newGame: () => void
  boot: () => Promise<void>
  resetSave: () => Promise<void>
}

/** zustand 桥接：core 纯状态 → React 响应式 */
export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  booted: false,

  dispatch: (action) => {
    const s = get().state
    if (!s) return
    const next = reduce(s, action)
    set({ state: next })
    scheduleSave(next)
  },

  newGame: () => {
    const s = createInitialState()
    set({ state: s })
    void saveNow(s)
  },

  boot: async () => {
    const saved = await loadSave()
    set({ state: saved ?? createInitialState(), booted: true })
  },

  resetSave: async () => {
    await clearSave()
    const s = createInitialState()
    set({ state: s })
    void saveNow(s)
  },
}))
