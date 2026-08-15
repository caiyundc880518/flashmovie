import type { GameState, TeamAssignments } from '../types'

/** 基于 idCounter 生成全局唯一 id */
export function uid(state: GameState, prefix: string): string {
  const id = `${prefix}${state.idCounter.toString(36)}`
  state.idCounter += 1
  return id
}

/** 剧组全员 id（用于发薪/士气/成长遍历） */
export function teamIds(team: TeamAssignments): string[] {
  const ids: string[] = []
  if (team.producerId) ids.push(team.producerId)
  if (team.directorId) ids.push(team.directorId)
  if (team.writerId) ids.push(team.writerId)
  ids.push(...team.actorIds)
  if (team.shooterId) ids.push(team.shooterId)
  if (team.editorId) ids.push(team.editorId)
  if (team.technicianId) ids.push(team.technicianId)
  if (team.marketId) ids.push(team.marketId)
  if (team.assistantId) ids.push(team.assistantId)
  return ids
}

/** 追加一条新闻（保留最近 30 条） */
export function pushNews(state: GameState, text: string): void {
  state.world.news.push({
    id: uid(state, 'news'),
    week: state.calendar.week,
    text,
    kind: 'hype',
    value: 0,
  })
  state.world.news = state.world.news.slice(-30)
}
