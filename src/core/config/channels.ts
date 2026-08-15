import type { Channel } from '../types'

/** 渠道信息：片方所得 = 票房 × factor（免费渠道收入为 0） */
export const CHANNEL_INFO: Record<Channel, { label: string; factor: number }> = {
  cinema: { label: '影院', factor: 0.45 },
  web: { label: '网络', factor: 0.35 },
  dvd: { label: 'DVD', factor: 0.2 },
  streaming: { label: '流媒体', factor: 0.3 },
  free: { label: '免费', factor: 0 },
}

export const CHANNEL_ORDER: Channel[] = ['cinema', 'web', 'dvd', 'streaming', 'free']

/** 发行商配置（GDD §3.6 Publish Contract） */
export const PUBLISHER_CONFIG = {
  /** 数量范围 */
  count: [2, 4] as const,
  /** 发行商名池 */
  names: ['环球发行', '时代影业发行部', '星光院线发行', '大都会传媒', '远东发行', '天穹影发'],
  /** 后端分成比例范围 0–1 */
  shareRateRange: [0.15, 0.35] as const,
  /** 预付款基数范围（万） */
  prepayBaseRange: [120, 250] as const,
  /** 预付款 = prepayBase + 声誉 × prepayPerRep */
  prepayPerRep: 2,
} as const
