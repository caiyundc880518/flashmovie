/**
 * IP 售后与续作配置（GDD §3.8）
 * 单位：票房/收入 万元
 */
export const IP_CONFIG = {
  /** 沉淀为 IP 的票房门槛（万，片方口径 = 结算 boxOffice） */
  originBoxOffice: 1500,
  /** 沉淀为 IP 的口碑门槛（影评人平均分 0–100） */
  originCriticScore: 70,
  /** IP 等级档位：按系列累计票房（万）取最大满足档 → 等级 = 下标 + 1 */
  levelThresholds: [0, 4000, 8000, 14000, 22000],
  /** 等级上限 */
  maxLevel: 5,
  /** 每级续作票房加成（×，Lv5 时 +25%） */
  sequelBonusPerLevel: 0.05,
  /** 续作初始热度 = base + 等级 × perLevel（0–100） */
  sequelHypeBase: 20,
  sequelHypePerLevel: 4,
  /** 每级季度衍生授权收入（万 / 13 周） */
  royaltyPerLevel: 12,
  /** 衍生授权结算间隔（周） */
  quarterWeeks: 13,
  /** 续作向发行商争取的预付款加成（每级 ×，Lv5 时 +20%） */
  publisherPrepayPerLevel: 0.04,
} as const
