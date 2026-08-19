import type { AwardWinner, FilmAward, FilmResult, GameState, YearAwards } from '../types'
import { TMA_CONFIG } from '../config/company'
import { clamp } from '../rng'

interface PictureCandidate {
  name: string
  owner: string
  score: number
  ours: boolean
  result?: FilmResult
}

function bestPicture(state: GameState, year: number): PictureCandidate | undefined {
  const candidates: PictureCandidate[] = [
    ...state.company.history
      .filter((h) => h.year === year)
      .map((h) => ({
        name: h.name,
        owner: state.company.name,
        score: (h.ap + h.mp) / 2,
        ours: true,
        result: h,
      })),
    ...state.world.competitors.flatMap((c) =>
      c.history
        .filter((f) => f.year === year)
        .map((f) => ({
          name: f.name,
          owner: c.name,
          score: (f.ap + f.mp) / 2,
          ours: false,
        })),
    ),
  ]
  return candidates.reduce<PictureCandidate | undefined>(
    (best, c) => (!best || c.score > best.score ? c : best),
    undefined,
  )
}

/** 我方某年上映的成片中，分项最高者（用于个人奖项；vfx 为独立字段） */
type ScoreKey = keyof FilmResult['scores'] | 'vfx'

function filmScore(h: FilmResult, key: ScoreKey): number {
  return key === 'vfx' ? h.vfx : h.scores[key]
}

function bestOurFilm(state: GameState, year: number, key: ScoreKey): FilmResult | undefined {
  return state.company.history
    .filter((h) => h.year === year)
    .reduce<FilmResult | undefined>(
      (best, h) => (!best || filmScore(h, key) > filmScore(best, key) ? h : best),
      undefined,
    )
}

/** 从成片的成员成绩单中找某职位的最高表现者 */
function memberByRole(state: GameState, result: FilmResult, role: string): { workerId: string; name: string; performance: number } | undefined {
  const gp = result.groupPerformance
    .filter((g) => g.role === role)
    .sort((a, b) => b.performance - a.performance)[0]
  if (!gp) return undefined
  return { workerId: gp.workerId, name: state.workers[gp.workerId]?.name ?? '未知', performance: gp.performance }
}

/** 计算某年度 TMA 奖项（跨年结算用） */
export function computeYearAwards(state: GameState, year: number): YearAwards {
  const winners: AwardWinner[] = []

  // 最佳影片：我方与对手同台竞争
  const picture = bestPicture(state, year)
  if (picture) {
    winners.push({
      category: '最佳影片',
      filmName: picture.name,
      score: Math.round(picture.score),
      ours: picture.ours,
    })
  }

  // 个人奖项：仅我方成片有分项数据
  const individual: Array<[string, ScoreKey, string]> = [
    ['最佳导演', 'directing', 'director'],
    ['最佳演员', 'acting', 'actor'],
    ['最佳摄影', 'shooting', 'shooter'],
    ['最佳剪辑', 'edit', 'editor'],
    ['最佳特效', 'vfx', 'technician'],
  ]
  for (const [category, key, role] of individual) {
    const film = bestOurFilm(state, year, key)
    if (!film) continue
    const member = memberByRole(state, film, role)
    winners.push({
      category,
      filmName: film.name,
      workerId: member?.workerId,
      workerName: member?.name,
      score: Math.round(filmScore(film, key)),
      ours: true,
    })
  }

  return { year, winners }
}

/** 应用颁奖效果（声誉/Fame/获奖履历/新闻），state 为草稿可原地修改 */
export function applyAwardEffects(state: GameState, ceremony: YearAwards): void {
  for (const w of ceremony.winners) {
    if (!w.ours) continue
    if (w.category === '最佳影片') {
      state.company.reputation = clamp(
        state.company.reputation + TMA_CONFIG.pictureBonus,
        0,
        100,
      )
    } else {
      state.company.reputation = clamp(
        state.company.reputation + TMA_CONFIG.winnerRepBonus,
        0,
        100,
      )
    }
    if (w.workerId) {
      const worker = state.workers[w.workerId]
      if (worker) {
        worker.basic.fame = clamp(worker.basic.fame + TMA_CONFIG.workerFameGain, 0, 100)
        worker.awards.push({ week: state.calendar.week, award: w.category, projectName: w.filmName })
      }
    }
    // 累计该影片的获奖数 + 获奖名单（项目卡片展示 🏆×N，详情页展示获奖 TAB）
    const awardEntry: FilmAward = {
      category: w.category,
      workerName: w.workerName,
      year: state.calendar.year,
    }
    const film = state.company.history.find((h) => h.name === w.filmName)
    if (film) {
      film.awardCount = (film.awardCount ?? 0) + 1
      film.awards = [...(film.awards ?? []), awardEntry]
    }
    // 同步到项目实时 result（历史是下片时的浅克隆快照，不更新项目详情页/卡片读的 p.result）
    const proj = state.projects.find((p) => p.stage === 'released' && p.result?.name === w.filmName)
    if (proj?.result) {
      proj.result.awardCount = (proj.result.awardCount ?? 0) + 1
      proj.result.awards = [...(proj.result.awards ?? []), awardEntry]
    }
    pushAwardNews(state, w)
  }
}

function pushAwardNews(
  state: GameState,
  w: AwardWinner,
): void {
  const name = w.workerName ? ` · ${w.workerName}` : ''
  state.world.news.push({
    id: `award${state.idCounter++}`,
    week: state.calendar.week,
    text: `🏆 ${w.category}：《${w.filmName}》${name} 获奖！`,
    kind: 'hype',
    value: 0,
  })
  state.world.news = state.world.news.slice(-30)
}
