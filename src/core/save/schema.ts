/** 存档版本：每次状态结构变更 +1，并在 migrate.ts 追加迁移 */
export const SAVE_VERSION = 2

/** IndexedDB 存档键（跨版本共用，便于升级读取旧档） */
export const SAVE_KEY = 'flashmovie-save'

/** v1 时代的旧存档键（读取兼容） */
export const LEGACY_SAVE_KEY = 'flashmovie-save-v1'
