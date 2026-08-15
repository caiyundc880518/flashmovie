/** 存档版本：每次状态结构变更 +1，并在 migrate.ts 追加迁移 */
export const SAVE_VERSION = 1

/** IndexedDB 存档键 */
export const SAVE_KEY = `flashmovie-save-v${SAVE_VERSION}`
