import type { Competitor, CompetitorFilm, CompetitorIp, FilmType, GameState, Worker } from '../types'
import { FILM_TYPES, type RoleId } from '../types'
import { SCRIPT_POOL } from '../config/scripts'
import { WORLD_CONFIG } from '../config/world'
import { ECONOMY } from '../config/economy'
import { SCORE_WEIGHTS } from '../config/weights'
import { FILM_TYPE_ZH } from '../config/events'
import { ROLES } from '../config/roles'
import { audienceFit } from './audience'
import { eventBoxOfficeFactor } from './events'
import { competitionPenalty } from './scoring'
import { generateWorker, type WorkerTier } from '../generators/workerGen'
import { pushNews, teamIds } from '../state/utils'
import type { Rng } from '../rng'
import { clamp, createRng, pick, randInt, round1 } from '../rng'

const SKILL_KEYS = ['act', 'direct', 'shoot', 'edit', 'market', 'technical', 'advertise', 'vfx'] as const

/** 按权重随机抽一个类型 */
function weightedPick(weights: Record<FilmType, number>, rng: Rng): FilmType {
  const total = FILM_TYPES.reduce((s, t) => s + Math.max(0, weights[t]), 0)
  let roll = rng() * Math.max(0.0001, total)
  for (const t of FILM_TYPES) {
    roll -= Math.max(0, weights[t])
    if (roll <= 0) return t
  }
  return FILM_TYPES[FILM_TYPES.length - 1]
}

/** 玩家上映窗口内的影片类型（本周/下周开映或正在放映，供狙击型决策） */
export function playerWindowTypes(state: GameState): FilmType[] {
  const cal = state.calendar
  const types: FilmType[] = []
  for (const p of state.projects) {
    if (p.stage !== 'released' || !p.run) continue
    const rs = p.run
    if (rs.status === 'running' && rs.currentRunId) {
      const run = rs.runs.find((x) => x.id === rs.currentRunId)
      if (run && run.weekly.length > 0) {
        const t = state.scripts[p.scriptId]?.type
        if (t && !types.includes(t)) types.push(t)
      }
    } else if (
      rs.status === 'presale' &&
      rs.releaseYear === cal.year &&
      rs.releaseWeek - cal.week <= 1 &&
      rs.releaseWeek >= cal.week
    ) {
      const t = state.scripts[p.scriptId]?.type
      if (t && !types.includes(t)) types.push(t)
    }
  }
  return types
}

/** 当前竞争拥挤度：本周+上周上映的片数（对手 + 玩家开映窗口） */
export function competitorCrowd(state: GameState): number {
  const cal = state.calendar
  const overlap = WORLD_CONFIG.competition.overlapWeeks
  let n = 0
  for (const c of state.world.competitors) {
    for (const f of c.history) {
      if (f.year === cal.year && f.week >= cal.week - overlap && f.week <= cal.week) n++
    }
  }
  for (const p of state.projects) {
    if (p.stage !== 'released' || !p.run) continue
    const rs = p.run
    if (rs.status === 'presale' && rs.releaseYear === cal.year && rs.releaseWeek === cal.week) {
      n++
    } else if (rs.status === 'running' && rs.currentRunId) {
      const run = rs.runs.find((x) => x.id === rs.currentRunId)
      if (run && run.weekly.length > 0 && run.weekly[0].year === cal.year && run.weekly[0].week >= cal.week - overlap) {
        n++
      }
    }
  }
  return n
}

/**
 * 档期决策：倒计时归零时是否本周上映。
 * 拥挤（≥3 部同窗口）时：狙击型照常撞档、快发型不断档，其余避让推迟 1–2 周。
 */
export function shouldCompetitorRelease(state: GameState, c: Competitor, rng: Rng): boolean {
  if (competitorCrowd(state) < 3) return true
  if (c.personality === 'sniper' || c.personality === 'volume') return true
  c.nextReleaseIn = randInt(rng, 1, 2)
  return false
}

/** 类型决策：专精锁定 / 追趋势 / 追观众 / 追类型热潮 / 狙击玩家窗口 */
export function decideCompetitorType(state: GameState, c: Competitor, rng: Rng): FilmType {
  const w: Record<FilmType, number> = {
    comedy: 0.5,
    horror: 0.5,
    action: 0.5,
    love: 0.5,
    war: 0.5,
    drama: 0.5,
  }
  const p = c.personality
  // 专精型：深耕 homeTypes
  if (p === 'specialist' && c.homeTypes?.length) {
    for (const t of c.homeTypes) w[t] += 3.5
  }
  // 趋势跟随（balanced 强、quality/sniper 中、volume 弱）
  if (state.world.trend) {
    w[state.world.trend.type] += p === 'balanced' ? 2.5 : p === 'quality' || p === 'sniper' ? 1.5 : 0.5
  }
  // 观众偏好（balanced 强跟随）
  const audK = p === 'balanced' ? 1.6 : 0.8
  for (const g of state.world.audience) {
    for (const t of FILM_TYPES) w[t] += g.size * g.focus[t] * audK
  }
  // 类型热潮事件
  for (const e of state.world.activeEvents) {
    if (e.kind === 'typeBoom' && e.type) w[e.type] += 2.5
  }
  // 狙击型：撞玩家窗口类型
  if (p === 'sniper') {
    for (const t of playerWindowTypes(state)) w[t] += 2.5
  }
  return weightedPick(w, rng)
}

/**
 * NPC 片口碑闭环：影评人评分 + 观众评分 + 复用玩家票房 gross 管线
 * （无宣发热度/IP 加成，但趋势/观众契合/事件/档期竞争惩罚全部生效，与玩家同量级）。
 */
export function scoreCompetitorFilm(
  state: GameState,
  type: FilmType,
  ap: number,
  mp: number,
  rng: Rng,
): { criticScore: number; audienceScore: number; boxOffice: number } {
  const reviews = state.world.critics.map((crit) => {
    let s = ap / 10
    if (crit.taste !== 'none') {
      s += crit.taste === type ? WORLD_CONFIG.tasteBonus : -WORLD_CONFIG.tasteMismatchPenalty
    }
    s += (rng() - 0.5) * 1.0
    return clamp(Math.round(s * 10) / 10, 0, 10)
  })
  const criticScore =
    reviews.length > 0 ? round1(reviews.reduce((a, b) => a + b, 0) / reviews.length) : round1(ap / 10)

  const fit = audienceFit(state, type)
  const audBase = (mp * 0.7 + ap * 0.3) / 10
  const audienceScore = clamp(
    Math.round((audBase + (fit - 1) * 5 + (rng() - 0.5) * 0.6) * 10) / 10,
    0,
    10,
  )

  const f = ECONOMY.boxOfficeFactor
  const base = 8 * ECONOMY.boxOfficeBasePerStage
  const mpFactor = f.mpMin + (mp / 100) * f.mpSpan
  const trendFactor = state.world.trend && type === state.world.trend.type ? 1 + f.trendSpan : 1
  const audFactor = fit
  const compFactor = 1 - competitionPenalty(state, state.calendar.week)
  const eventFactor = eventBoxOfficeFactor(state, type)
  const random = 1 + (rng() - 0.5) * 2 * SCORE_WEIGHTS.variance
  const boxOffice = Math.round(
    base * mpFactor * trendFactor * audFactor * compFactor * eventFactor * random,
  )
  return { criticScore, audienceScore, boxOffice }
}

/**
 * 对手上映一部影片（感知决策 + 口碑闭环 + 长线经营）：
 * 类型决策 → 续作决策 → 品质（声誉 + 性格投入 + 续作加成，拮据降档）→
 * 影评/观众/事件/竞争结算 → 收入/成本入资金池 → 高票房沉淀 IP → 入历史 + 声誉微调。
 */
export function releaseCompetitorFilm(state: GameState, c: Competitor, rng: Rng): CompetitorFilm {
  const cfg = WORLD_CONFIG.competitor
  const type = decideCompetitorType(state, c, rng)

  // 续作决策：已有同类型 IP 且抽中性格续作概率 → 拍续作
  let sequel: CompetitorIp | undefined
  const candidates = c.ips.filter((ip) => ip.type === type)
  if (candidates.length > 0 && rng() < cfg.economy.sequelChance[c.personality]) {
    sequel = [...candidates].sort((a, b) => b.totalBoxOffice - a.totalBoxOffice)[0]
  }
  const title = sequel ? `${sequel.name} ${sequel.films + 1}` : pick(rng, SCRIPT_POOL.titles[type])

  // 品质投入：性格 investMul；拮据（cash < 阈值）时降档；团队平均技能加成
  const poor = c.cash < cfg.economy.poorThreshold
  const invest = cfg.investMul[c.personality] * (poor ? cfg.economy.downshiftMul : 1)
  const qualityBonus = Math.round((invest - 1) * 25)
  const sequelBonus = sequel ? (sequel.films - 1) * cfg.economy.sequelQualityBonus : 0
  const teamSkill = avgWorkerSkill(state, c)
  const ap = clamp(
    Math.round(
      randInt(rng, 20, 60) +
        c.reputation * 0.4 +
        qualityBonus +
        sequelBonus +
        (teamSkill - 40) * 0.4,
    ),
    0,
    100,
  )
  const mp = clamp(
    Math.round(
      randInt(rng, 25, 65) +
        c.reputation * 0.5 +
        qualityBonus * 0.6 +
        sequelBonus * 0.6 +
        (teamSkill - 40) * 0.3,
    ),
    0,
    100,
  )

  let { criticScore, audienceScore, boxOffice } = scoreCompetitorFilm(state, type, ap, mp, rng)
  if (sequel) {
    boxOffice = Math.round(
      boxOffice * (1 + sequel.films * cfg.economy.sequelBoxOfficePerFilm),
    )
    sequel.films += 1
    const prevTotal = sequel.totalBoxOffice
    sequel.totalBoxOffice = round1(sequel.totalBoxOffice + boxOffice)
    // 系列 IP 累计票房里程碑：跨过即上报纸
    const milestone = cfg.news.milestoneThreshold
    if (prevTotal < milestone && sequel.totalBoxOffice >= milestone) {
      pushNews(
        state,
        `竞争对手「${c.name}」的系列 IP《${sequel.name}》累计票房突破 ${milestone.toLocaleString()} 万，载入行业史册！`,
      )
    }
  }

  // 资金经营：收入 = 票房 × 分账；成本 = 基准 × 投入倍率 × 声誉系数
  const cost = Math.round(cfg.economy.costBase * invest * (0.8 + c.reputation / 100))
  c.cash = round1(c.cash + boxOffice * cfg.economy.share - cost)

  // 高票房新片沉淀为 IP（续作不重复沉淀）
  if (!sequel && boxOffice >= cfg.economy.ipThreshold) {
    c.ips.push({
      id: `${c.id}-ip${c.ips.length + 1}`,
      name: title,
      type,
      films: 1,
      totalBoxOffice: boxOffice,
    })
  }

  const film: CompetitorFilm = {
    week: state.calendar.week,
    year: state.calendar.year,
    name: title,
    type,
    ap,
    mp,
    criticScore,
    audienceScore,
    boxOffice,
  }
  c.history.push(film)
  c.history = c.history.slice(-30)
  c.reputation = clamp(c.reputation + (mp >= 50 ? 1 : -1), 0, 100)
  c.nextType = type
  return film
}

/** NPC 上映开画新闻（合并：档期公告 + 首周票房 + 口碑评价，替代原来的纯上映公告） */
export function competitorReleaseNews(state: GameState, c: Competitor, film: CompetitorFilm): void {
  const cfg = WORLD_CONFIG.competitor
  const typeText = film.type ? FILM_TYPE_ZH[film.type] : ''
  const big = film.boxOffice >= cfg.economy.ipThreshold
  const flop = film.boxOffice < cfg.economy.ipThreshold * cfg.news.flopRatio
  const criticScore = film.criticScore ?? 7 // 旧档无口碑分：按中性处理
  const praise = criticScore >= cfg.news.praiseCritic
  const slam = criticScore < cfg.news.slamCritic
  if (big) {
    pushNews(
      state,
      `竞争对手「${c.name}」本周上映《${film.name}》${typeText ? `（${typeText}）` : ''}，首周票房 ${film.boxOffice.toLocaleString()} 万${praise ? '，影评人盛赞' : ''}，市场大爆！`,
    )
  } else if (flop) {
    pushNews(
      state,
      `竞争对手「${c.name}」本周上映《${film.name}》${typeText ? `（${typeText}）` : ''}遭冷遇，首周仅 ${film.boxOffice.toLocaleString()} 万${slam ? '，影评人差评如潮' : ''}。`,
    )
  } else {
    pushNews(
      state,
      `竞争对手「${c.name}」本周上映《${film.name}》${typeText ? `（${typeText}）` : ''}，首周票房 ${film.boxOffice.toLocaleString()} 万，市场反响平平。`,
    )
  }
}

/** NPC 破产救急新闻：资金链断裂 → 注资歇业（上报纸） */
export function competitorBailoutNews(state: GameState, c: Competitor, pauseWeeks: number): void {
  pushNews(state, `【风波】竞争对手「${c.name}」资金链告急，宣布停业整顿 ${pauseWeeks} 周，暂别影市。`)
}

/**
 * 运行期团队补员：被玩家挖角挖到低于下限时，对手低概率签回新人（每周一次检查）。
 * 用「种子 + 竞对 id + 年/周」派生的确定性 rng，不消耗主随机序列（不扰动世界确定性）。
 */
export function maybeCompetitorRefill(draft: GameState): void {
  const cfg = WORLD_CONFIG.competitor.news
  const roles: RoleId[] = ['director', 'actor', 'shooter', 'editor', 'market', 'technician']
  const cal = draft.calendar
  for (const c of draft.world.competitors) {
    if (c.team.length >= cfg.teamMin || c.cash <= 0) continue
    const hash = c.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)
    const rng = createRng(
      ((draft.seed ^ 0xf00d ^ hash * 104729 + cal.year * 7919 + cal.week * 104729) >>> 0) + 1,
    )
    if (rng() >= cfg.refillChance) continue
    const tier: WorkerTier = c.reputation >= 60 ? 'pro' : 'rookie'
    const w = generateWorker(rng, roles[c.team.length % roles.length], tier)
    // id 避开全局 workers 表（被挖走的员工仍留在表内，防止覆盖玩家手里的同名员工）
    let id = `${c.id}-n${randInt(rng, 1000, 9999)}`
    while (draft.workers[id]) id = `${c.id}-n${randInt(rng, 1000, 9999)}`
    w.id = id
    draft.workers[id] = w
    c.team.push(id)
    pushNews(
      draft,
      `竞争对手「${c.name}」签下新人「${w.name}」（${ROLES[w.role].nameZh}），充实制作团队。`,
    )
  }
}

/** NPC 每周运营成本（万） */
export function weeklyCompetitorOverhead(c: Competitor): number {
  const e = WORLD_CONFIG.competitor.economy
  return round1(e.weeklyOverheadBase + c.reputation * e.weeklyOverheadPerRep)
}

/** NPC 团队每周薪资（万） */
export function weeklyTeamSalary(state: GameState, c: Competitor): number {
  return round1(c.team.reduce((s, id) => s + (state.workers[id]?.salary ?? 0), 0))
}

/** 团队平均技能（0–100；无团队回退 40） */
export function avgWorkerSkill(state: GameState, c: Competitor): number {
  if (c.team.length === 0) return 40
  let sum = 0
  let n = 0
  for (const id of c.team) {
    const w = state.workers[id]
    if (!w) continue
    for (const k of SKILL_KEYS) {
      sum += w.skills[k] ?? 0
      n += 1
    }
  }
  return n > 0 ? sum / n : 40
}

/**
 * 补齐 NPC 团队（新档与旧档统一入口）：3–6 名员工进全局 workers 表，team 挂 id。
 * 员工质量随声誉（≥60 熟手，否则新人）；用种子确定性派生，不扰动主随机序列。
 */
export function ensureCompetitorTeams(state: GameState): void {
  const roles: RoleId[] = ['director', 'actor', 'shooter', 'editor', 'market', 'technician']
  for (const c of state.world.competitors) {
    if (c.team.length > 0) continue
    const hash = c.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)
    const rng = createRng(((state.seed ^ 0xbeef ^ hash * 104729) >>> 0) + 1)
    const count = randInt(rng, 3, 6)
    const tier = c.reputation >= 60 ? ('pro' as const) : ('rookie' as const)
    for (let i = 0; i < count; i++) {
      const w = generateWorker(rng, roles[i % roles.length], tier)
      w.id = `${c.id}-t${i + 1}`
      state.workers[w.id] = w
      c.team.push(w.id)
    }
  }
}

/** 玩家空闲员工（不在任何项目组） */
export function idlePlayerWorkers(state: GameState): Worker[] {
  const busy = new Set<string>()
  for (const p of state.projects) {
    for (const id of teamIds(p.team)) busy.add(id)
  }
  return state.company.employeeIds
    .map((id) => state.workers[id])
    .filter((w): w is Worker => !!w && !busy.has(w.id))
}

/** 玩家挖角成功率（纯函数，UI 预估与 reducer 结算共用） */
export function poachSuccessChance(
  state: GameState,
  competitor: Competitor,
  worker: Worker,
  offer: number,
): number {
  const cfg = WORLD_CONFIG.competitor.poach
  const repDiff = state.company.reputation - competitor.reputation
  const premium = Math.max(0, offer - worker.salary * 4)
  const chance = cfg.baseSuccess + premium * cfg.successPerOfferOver + repDiff * cfg.successPerRepDiff
  return clamp(chance, cfg.minSuccess, cfg.maxSuccess)
}

/**
 * 每周 NPC 挖角检查：对玩家高价值空闲员工发起挖角（一次一个）。
 * 用「种子 + 年/周」派生的确定性 rng，不消耗主随机序列（不扰动玩家世界的确定性）。
 */
export function maybeNpcPoach(draft: GameState): void {
  if (draft.world.pendingPoach) return
  const cfg = WORLD_CONFIG.competitor.poach
  const cal = draft.calendar
  const rng = createRng(((draft.seed ^ 0xcafe ^ cal.year * 104729 + cal.week * 7919) >>> 0) + 1)
  if (rng() >= cfg.chance) return
  const targets = idlePlayerWorkers(draft).filter(
    (w) =>
      w.basic.fame >= cfg.targetFameMin ||
      Math.max(...SKILL_KEYS.map((k) => w.skills[k] ?? 0)) >= cfg.targetSkillMin,
  )
  if (targets.length === 0) return
  const competitors = draft.world.competitors.filter((c) => c.cash > 0)
  if (competitors.length === 0) return
  const target = targets[Math.floor(rng() * targets.length)]
  const comp = competitors[Math.floor(rng() * competitors.length)]
  const offer = Math.round(
    (target.salary * randInt(rng, cfg.offerMul[0], cfg.offerMul[1])) / 10,
  )
  draft.world.pendingPoach = { competitorId: comp.id, workerId: target.id, offer }
}
