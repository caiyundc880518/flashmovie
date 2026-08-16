import { IP_CONFIG } from '../config/ip'
import type { IpAsset } from '../types'
import { round1 } from '../rng'

/** IP 等级：按系列累计票房取最大满足档位（1–5） */
export function ipLevel(totalBoxOffice: number): number {
  let lv = 1
  for (let i = 1; i < IP_CONFIG.levelThresholds.length; i += 1) {
    if (totalBoxOffice >= IP_CONFIG.levelThresholds[i]) lv = i + 1
  }
  return Math.min(lv, IP_CONFIG.maxLevel)
}

/** 由等级推导的衍生收入（万/季度） */
export function royaltyPerQuarter(level: number): number {
  return round1(level * IP_CONFIG.royaltyPerLevel)
}

/** 由等级推导的续作票房加成（×） */
export function sequelBonusFactor(level: number): number {
  return round1(1 + level * IP_CONFIG.sequelBonusPerLevel)
}

/** 由累计票房生成/刷新一个 IP 的等级相关派生值（原地写回） */
export function refreshIpDerived(ip: IpAsset): IpAsset {
  ip.level = ipLevel(ip.totalBoxOffice)
  ip.royaltyPerQuarter = royaltyPerQuarter(ip.level)
  ip.sequelBonus = sequelBonusFactor(ip.level)
  return ip
}
