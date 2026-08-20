import type { CompetitorPersonality, FilmType, RoleId, ProjectStage } from '../core/types'

export const TYPE_ZH: Record<FilmType, string> = {
  comedy: '喜剧',
  horror: '恐怖',
  action: '动作',
  love: '爱情',
  war: '战争',
  drama: '剧情',
}

/** NPC 性格中文名（竞对观察/挖角界面） */
export const PERSONALITY_ZH: Record<CompetitorPersonality, string> = {
  quality: '品质型',
  volume: '快发型',
  specialist: '专精型',
  sniper: '狙击型',
  balanced: '稳健型',
}

export const TYPE_COLOR: Record<FilmType, string> = {
  comedy: '#f5a623',
  horror: '#8a5cff',
  action: '#e05555',
  love: '#ff7ab8',
  war: '#7a8a9a',
  drama: '#4c8bf5',
}

export const ROLE_ZH: Record<RoleId, string> = {
  producer: '制片人',
  director: '导演',
  writer: '编剧',
  actor: '演员',
  shooter: '摄影',
  editor: '剪辑',
  technician: '技术',
  market: '市场',
  assistant: '助理',
}

export const SKILL_ZH: Record<string, string> = {
  act: '演技',
  direct: '导演',
  shoot: '摄影',
  edit: '剪辑',
  market: '市场',
  advertise: '广告',
  vfx: '特效',
  technical: '技术',
}

/** 有符号数字：正数带 +，负数带 -，整数不补 .0 */
export function signedDelta(v: number): string {
  const s = Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1)
  return v > 0 ? `+${s}` : s
}

/** 心情颜色：≥70 绿 / ≥45 金 / 红 */
export function moodColor(mood: number): string {
  if (mood >= 70) return 'var(--ok)'
  if (mood >= 45) return 'var(--gold)'
  return 'var(--danger)'
}

/** 10 分制显示：旧档 0–100 自动换算，一位小数 */
export function fmtScore10(score: number): string {
  const s = score > 10 ? score / 10 : score
  return s.toFixed(1)
}

/** 10 分制评分颜色：≥8 绿 / ≥6 金 / 红（兼容旧档 0–100） */
export function scoreColor10(score: number): string {
  const s = score > 10 ? score / 10 : score
  if (s >= 8) return 'var(--ok)'
  if (s >= 6) return 'var(--gold)'
  return 'var(--danger)'
}

export const STAGE_ZH: Record<ProjectStage, string> = {
  preparing: '筹备中',
  shooting: '拍摄中',
  editing: '剪辑中',
  marketing: '宣发中',
  released: '已上映',
}

export const SEASON_ZH = (week: number): string => {
  if (week <= 12) return '春季档'
  if (week <= 26) return '夏季档'
  if (week <= 39) return '秋季档'
  return '冬季档'
}

export function fmtWan(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10000) return `${(value / 10000).toFixed(2)}亿`
  return `${Math.round(value).toLocaleString()}万`
}

export function fmtWeek(week: number): string {
  return `第${week}周`
}
