/**
 * IP 售后与续作配置（GDD §3.8）
 * 单位：票房/收入 万元
 */
export const IP_CONFIG = {
  /** 沉淀为 IP 的票房门槛（万，片方口径 = 结算 boxOffice） */
  originBoxOffice: 1500,
  /** 沉淀为 IP 的口碑门槛（影评人平均分，10 分制） */
  originCriticScore: 7,
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

/**
 * IP 长尾收益配置（热门度周边 + 版权交易；数值为平衡期初值）
 */
export const IP_LONGTAIL_CONFIG = {
  /** 热门度每周衰减保留率（0.98 ≈ 34 周腰斩） */
  hotnessDecay: 0.98,
  /** 旧档迁移：hotness = level × 此系数 */
  hotnessSeedPerLevel: 20,
  /** 续作抬升：hotness += (finalMp − 50) × 此系数 */
  hotnessSequelK: 0.6,
  /** 周边收入基础系数：周周边 = hotness × 此值 × 等级加成 × (1 + merchBonus/100)（万/周） */
  merchBasePerHotness: 0.15,
  /** 周边收入等级加成：每级 +20% */
  merchLevelK: 0.2,
  /** 版权交易 */
  copyright: {
    /** 合同总额基数（万）：tv / game */
    tvBase: 400,
    gameBase: 700,
    /** 合同期（周）：tv / game */
    tvWeeks: 12,
    gameWeeks: 20,
    /** 等级加成：× (1 + (level−1)×levelK) */
    levelK: 0.5,
    /** 热门度加成：× (hotnessK + hotness/100)，hotness 0 → 0.5，100 → 1.5 */
    hotnessK: 0.5,
  },
} as const
