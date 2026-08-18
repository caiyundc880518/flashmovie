import type {
  Channel,
  FilmProject,
  FilmRun,
  FilmRunState,
  GameState,
  IpAsset,
  RunChannelConfig,
} from '../types'
import { clamp, round1 } from '../rng'
import { CHANNEL_CONFIG, CHANNEL_INFO, TOTAL_CINEMAS } from '../config/channels'
import { ECONOMY } from '../config/economy'
import { IPO_CONFIG } from '../config/company'
import { IP_CONFIG, IP_LONGTAIL_CONFIG } from '../config/ip'
import { AD_CONFIG, AD_SPONSOR_MAP } from '../config/ads'
import { ipLevel, refreshIpDerived, royaltyPerQuarter, sequelBonusFactor } from '../rules/ip'
import { applyProjectGrowth } from '../rules/growth'
import { pushNews, uid } from '../state/utils'

/**
 * 发行放映 + 长尾收益（每周动态结算，GDD §3.6/§3.8 大修）
 * 上映 → 放映期（每周票房/口碑/MP 动态结算）→ 下片 → 再发行(渠道单调向下) → 长尾(IP 周边 + 版权交易)
 */

/** 渠道等级：影院3 > 网络2 > DVD1 > 免费0 */
const CH_RANK: Record<Channel, number> = { cinema: 3, web: 2, dvd: 1, free: 0 }

/** 渠道严格单调向下（再发行约束） */
export function isLowerChannel(next: Channel, last: Channel): boolean {
  return CH_RANK[next] < CH_RANK[last]
}

/** 某渠道之后的全部更低档渠道（按等级降序，供再发行面板） */
export function lowerChannelsOf(last: Channel): Channel[] {
  return (['cinema', 'web', 'dvd', 'free'] as Channel[]).filter((c) => isLowerChannel(c, last))
}

/** 渠道倍数（复用现有 channelRevenue 倍数逻辑；free 含热度） */
export function channelMulFactor(ch: Channel, cfg: RunChannelConfig, hype = 50): number {
  const c = CHANNEL_CONFIG
  switch (ch) {
    case 'cinema': {
      const count = Math.min(cfg.cinemaCount || c.cinemaDefaultCount, TOTAL_CINEMAS)
      const cover = Math.min(1, count / TOTAL_CINEMAS)
      return c.cinemaBaseMul + cover * (c.cinemaMaxMul - c.cinemaBaseMul)
    }
    case 'web': {
      const platforms = cfg.webPlatforms.length > 0 ? cfg.webPlatforms.length : 1
      const weeks = cfg.webWeeks || c.webDefaultWeeks
      const weeksEff = Math.min(weeks, c.webWeeksCap + 1)
      return (
        c.webBaseMul * (1 + (platforms - 1) * c.webBonusPerPlatform) * (1 + (weeksEff - 1) * c.webBonusPerWeek)
      )
    }
    case 'dvd': {
      const price = cfg.dvdPrice || c.dvdRefPrice
      return c.dvdBaseMul * Math.pow(price / c.dvdRefPrice, c.dvdPricePower)
    }
    case 'free': {
      const price = cfg.freeAdPrice || 30
      return c.freeViewFactor * (1 + hype * c.freeViewHypePer) * price
    }
  }
}

/** 渠道投放成本（万，一次性） */
export function channelCostFor(ch: Channel, cfg: RunChannelConfig): number {
  const c = CHANNEL_CONFIG
  switch (ch) {
    case 'cinema':
      return Math.min(cfg.cinemaCount || c.cinemaDefaultCount, TOTAL_CINEMAS) * c.cinemaCostPerUnit
    case 'web': {
      const platforms = cfg.webPlatforms.length > 0 ? cfg.webPlatforms.length : 1
      const weeks = cfg.webWeeks || c.webDefaultWeeks
      return platforms * c.webCostPerPlatform + weeks * c.webCostPerWeek
    }
    case 'dvd':
      return c.dvdSetupCost
    case 'free':
      return 0
  }
}

/** 渠道指标换算：票房 → 人次/播放量/张数 + 片方分账 */
export function channelMetrics(
  ch: Channel,
  cfg: RunChannelConfig,
  boxOffice: number,
): { revenue: number; admissions?: number; traffic?: number; units?: number } {
  const c = CHANNEL_CONFIG
  switch (ch) {
    case 'cinema':
      return { revenue: boxOffice * ECONOMY.cinemaShare, admissions: boxOffice / c.cinemaAvgTicket }
    case 'web':
      return { revenue: boxOffice * c.webShare, traffic: boxOffice / c.run.webPerView }
    case 'dvd': {
      const price = cfg.dvdPrice || c.dvdRefPrice
      return { revenue: boxOffice * c.dvdShare, units: Math.max(0, boxOffice / price) }
    }
    case 'free': {
      const price = cfg.freeAdPrice || 30
      return { revenue: boxOffice, traffic: boxOffice / price }
    }
  }
}

/** 从项目的宣发配置构建渠道配置快照 */
export function createRunConfig(p: FilmProject): RunChannelConfig {
  return {
    cinemaCount: p.cinemaCount,
    webPlatforms: p.webPlatforms,
    webWeeks: p.webWeeks,
    dvdPrice: p.dvdPrice,
    freeAdPrice: p.freeAdPrice,
  }
}

/** 再发行渠道的默认配置（简化：不定档不预售，按渠道合理默认跑） */
export function createRunConfigForChannel(ch: Channel): RunChannelConfig {
  return {
    cinemaCount: 0,
    webPlatforms: ch === 'web' ? ['腾讯视频'] : [],
    webWeeks: ch === 'web' ? CHANNEL_CONFIG.webDefaultWeeks : 0,
    dvdPrice: ch === 'dvd' ? CHANNEL_CONFIG.dvdRefPrice : 0,
    freeAdPrice: ch === 'free' ? 30 : 0,
  }
}

/** 创建一段放映 run（expectedTotal 由调用方按 isFirst 决定系数后设置） */
export function createRun(
  state: GameState,
  p: FilmProject,
  ch: Channel,
  isFirst: boolean,
  cfg: RunChannelConfig,
  basePotentialOverride?: number,
): FilmRun {
  const basePotential = basePotentialOverride ?? p.run?.basePotential ?? p.result?.boxOffice ?? 0
  const factor = isFirst ? 1 : CHANNEL_CONFIG.run.rereleaseFactor
  const hype = p.hype ?? 50
  return {
    id: uid(state, 'run'),
    channel: ch,
    isFirst,
    config: cfg,
    expectedTotal: round1(basePotential * channelMulFactor(ch, cfg, hype) * factor),
    startWeek: state.calendar.week,
    startYear: state.calendar.year,
    status: 'running',
    weekly: [],
    channelCost: 0,
  }
}

/** 定档时建立发行状态（reducer 调用） */
export function initRunState(
  state: GameState,
  p: FilmProject,
  weeks: number,
  basePotential: number,
): FilmRunState {
  const totalWeek = state.calendar.week + weeks
  const weeksPerYear = ECONOMY.weeksPerYear
  const releaseYear = state.calendar.year + Math.floor((totalWeek - 1) / weeksPerYear)
  const releaseWeek = ((totalWeek - 1) % weeksPerYear) + 1
  const runState: FilmRunState = {
    status: weeks > 0 ? 'presale' : 'running',
    currentRunId: null,
    runs: [],
    releaseWeek,
    releaseYear,
    presale: 0,
    firstRunEnded: false,
    basePotential,
  }
  if (weeks === 0) {
    // 本周立即上映：立刻建首轮 run（首周票房在下一推进结算）
    const run = createRun(state, p, p.channel ?? 'cinema', true, createRunConfig(p), basePotential)
    runState.runs.push(run)
    runState.currentRunId = run.id
  }
  return runState
}

/** 投资人分成：每周随收入按比例扣，回收完毕退出 */
function applyInvestorShare(draft: GameState, revenue: number): void {
  const investor = draft.company.investor
  if (!investor || revenue <= 0) return
  const income = revenue * investor.share
  draft.company.cash = round1(draft.company.cash - income)
  investor.remainingToCollect = round1(investor.remainingToCollect - income)
  if (investor.remainingToCollect <= 0) {
    draft.company.investor = undefined
    pushNews(draft, `投资人「${investor.name}」已回收全部投资，退出公司。`)
  }
}

/**
 * 结算一段放映的一周（advanceWeek 内调用，calendar 已推进到当周）。
 * 首周 = expectedTotal × week1Share × (1+预售加成)；随后逐周衰减 × hold，
 * 口碑/MP 走"向影评回归 + 票房表现扰动"的反馈环（仅首轮；再发行固定输入）。
 */
export function settleRunWeek(draft: GameState, p: FilmProject, run: FilmRun): void {
  const cfg = CHANNEL_CONFIG.run
  const n = run.weekly.length
  const isFirst = run.isFirst
  const baseMp = p.result?.mp ?? 0
  const baseAud = p.result?.audienceScore ?? 0
  // 首轮用动态值；再发行用锁定终值（不更新）
  const curMp = isFirst ? (p.currentMp ?? baseMp) : (p.finalMp ?? baseMp)
  const curAud = isFirst ? (p.currentAudience ?? baseAud) : (p.finalAudience ?? baseAud)

  let boxOffice: number
  if (n === 0) {
    // 首周（即峰值）
    const w1Share = 1 - cfg.decayRate[run.channel]
    let week1 = run.expectedTotal * w1Share
    if (isFirst && p.run && p.run.presale > 0) {
      const bonus = Math.min(cfg.presaleCapRatio, p.run.presale / Math.max(1, run.expectedTotal))
      week1 *= 1 + bonus
      p.run.presale = 0
    }
    boxOffice = week1
  } else {
    const prev = run.weekly[n - 1]
    const expectedN = prev.boxOffice * cfg.decayRate[run.channel]
    // hold：口碑/MP 偏离基础的衰减修正（首轮反馈；再发行 hold=1 固定输入）
    let hold = 1
    if (isFirst) {
      const dev = (curAud - baseAud) + (curMp - baseMp) / 8
      hold = clamp(1 + cfg.feedback.holdK * dev, cfg.feedback.holdMin, cfg.feedback.holdMax)
    }
    boxOffice = expectedN * hold
    // 反馈更新（首轮）：口碑向影评评分回归 + 票房表现扰动 → 下周 hold 变化
    if (isFirst) {
      const critic = p.result?.criticScore ?? 5
      const drift = cfg.feedback.criticPull * (critic - curAud)
      const perf = ((boxOffice - expectedN) / Math.max(1, expectedN)) * cfg.feedback.perfK
      const nextAud = clamp(curAud + drift + perf, 0, 10)
      const nextMp = clamp(curMp + (nextAud - curAud) * cfg.feedback.mpStep, 0, 100)
      p.currentAudience = round1(nextAud)
      p.currentMp = round1(nextMp)
    }
  }

  const metrics = channelMetrics(run.channel, run.config, boxOffice)
  const revenue = metrics.revenue

  // 开映当周一次性扣渠道成本
  if (n === 0) {
    run.channelCost = round1(channelCostFor(run.channel, run.config))
    draft.company.cash -= run.channelCost
    pushNews(draft, `《${p.name}》首周上映，票房 ${Math.round(boxOffice)} 万（渠道投放成本 ${run.channelCost} 万）。`)
  }

  // 入账 + 投资人分成
  draft.company.cash = round1(draft.company.cash + revenue)
  applyInvestorShare(draft, revenue)

  // 记录本周
  const record = {
    week: draft.calendar.week,
    year: draft.calendar.year,
    boxOffice: round1(boxOffice),
    revenue: round1(revenue),
    admissions: metrics.admissions !== undefined ? round1(metrics.admissions) : undefined,
    traffic: metrics.traffic !== undefined ? round1(metrics.traffic) : undefined,
    units: metrics.units !== undefined ? round1(metrics.units) : undefined,
    mp: round1(curMp),
    audience: round1(curAud),
  }
  run.weekly.push(record)

  // 累计 result（全渠道累计快照）
  const r = p.result
  if (r) {
    r.boxOffice = round1((r.boxOffice ?? 0) + boxOffice)
    r.revenue = round1((r.revenue ?? 0) + revenue)
    if (metrics.admissions !== undefined) r.admissions = round1((r.admissions ?? 0) + metrics.admissions)
    if (metrics.units !== undefined) r.dvdUnits = round1((r.dvdUnits ?? 0) + metrics.units)
    if (metrics.traffic !== undefined) r.freeViews = round1((r.freeViews ?? 0) + metrics.traffic)
  }

  // IP 累计票房持续累加（影响等级；续作与再发行都算）
  if (p.ipId) {
    const ip = draft.company.ips.find((x) => x.id === p.ipId)
    if (ip) {
      ip.totalBoxOffice = round1(ip.totalBoxOffice + boxOffice)
      refreshIpDerived(ip)
    }
  }

  // 下片判定：当周票房 < 地板 或 达到硬上限
  if (boxOffice < cfg.floorWan || n + 1 >= cfg.maxWeeks[run.channel]) {
    endRun(draft, p, run)
  }
}

/** 结束一段放映（自动/手动）：首轮下片做一次性结算，随后转 idle/finished */
export function endRun(draft: GameState, p: FilmProject, run: FilmRun): void {
  if (run.status !== 'running') return
  run.status = 'ended'
  run.endWeek = draft.calendar.week
  run.endYear = draft.calendar.year
  if (!p.run) return
  p.run.currentRunId = null
  if (run.isFirst && !p.run.firstRunEnded) {
    finalizeFirstRun(draft, p)
    p.run.firstRunEnded = true
  }
  const lower = lowerChannelsOf(run.channel)
  p.run.status = lower.length > 0 ? 'idle' : 'finished'
  pushNews(
    draft,
    `《${p.name}》${CHANNEL_INFO[run.channel].label}档放映${run.isFirst ? '（首轮）' : ''}结束，共 ${run.weekly.length} 周。${
      lower.length > 0 ? '可再发行到更低档渠道。' : '该片已彻底完结。'
    }`,
  )
}

/** 首轮下片的一次性结算：锁定最终 MP/口碑 → 成员成长 → 广告达标 → 声誉 → IP 沉淀/续作成长 */
function finalizeFirstRun(draft: GameState, p: FilmProject): void {
  const r = p.result
  if (!r) return
  const finalMp = round1(p.currentMp ?? r.mp)
  const finalAud = round1(p.currentAudience ?? r.audienceScore ?? 0)
  p.finalMp = finalMp
  p.finalAudience = finalAud

  // 成员成长（用最终 MP/口碑）
  const finalResult = { ...r, mp: finalMp, audienceScore: finalAud }
  const settlements = applyProjectGrowth(draft, p, finalResult)
  r.settlement = settlements.length > 0 ? settlements : undefined

  // 广告达标结算（影评固定）
  const maxActorFame = Math.max(0, ...p.team.actorIds.map((id) => draft.workers[id]?.basic.fame ?? 0))
  const adSettlement = (p.adSponsorIds ?? [])
    .map((id) => {
      const ad = AD_SPONSOR_MAP[id]
      if (!ad) return null
      const met = (r.criticScore ?? 0) >= ad.minCriticScore && maxActorFame >= ad.requiredFame
      return { id: ad.id, name: ad.name, fee: ad.sponsorFee, met }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
  const adIncome = adSettlement.reduce((s, a) => s + (a.met ? a.fee : 0), 0)
  if (adIncome > 0) draft.company.cash = round1(draft.company.cash + adIncome)
  r.adSettlement = adSettlement.length > 0 ? adSettlement : undefined
  r.adIncome = adIncome > 0 ? round1(adIncome) : undefined

  // 声誉变化（免费渠道 +2 换口碑）
  const repGain = clamp((r.reputationGain ?? 0) + (r.channel === 'free' ? 2 : 0), -3, 6)
  draft.company.reputation = clamp((draft.company.reputation ?? 0) + repGain, 0, 100)

  // 高知名度广告商 → IP 周边加成
  const maxMerch = Math.max(0, ...(p.adSponsorIds ?? []).map((id) => AD_SPONSOR_MAP[id]?.merchBonus ?? 0))

  // IP 沉淀 / 续作成长
  const ipInfo = settleIpForProject(draft, p, r, maxMerch)
  if (ipInfo) {
    r.ipName = ipInfo.name
    r.ipEntry = ipInfo.entry
  }

  // 推入公司历史（排行榜/颁奖兼容；克隆快照避免后续再发行改动）
  draft.company.history.push({ ...r })
  pushNews(
    draft,
    `《${p.name}》首轮放映结算完成：总票房 ${Math.round(r.boxOffice ?? 0)} 万，成员成长与广告/IP 结算已入账。`,
  )
}

/** IP 沉淀（首作）或续作成长（累计票房已在每周累加，这里只做等级/热门度/加成） */
function settleIpForProject(
  draft: GameState,
  p: FilmProject,
  r: FilmResultLike,
  maxMerch: number,
): { name: string; entry: number } | undefined {
  const sequelIp = p.ipId ? draft.company.ips.find((x) => x.id === p.ipId) : undefined
  if (sequelIp) {
    sequelIp.entry = Math.max(sequelIp.entry, p.ipEntry ?? sequelIp.entry + 1)
    sequelIp.bestBoxOffice = Math.max(sequelIp.bestBoxOffice, r.boxOffice ?? 0)
    sequelIp.bestCriticScore = Math.max(sequelIp.bestCriticScore, r.criticScore ?? 0)
    if (!sequelIp.films.includes(p.id)) sequelIp.films.push(p.id)
    const prevLevel = sequelIp.level
    refreshIpDerived(sequelIp)
    if (maxMerch > 0) sequelIp.merchBonus = clamp(sequelIp.merchBonus + maxMerch, 0, AD_CONFIG.merchBonusCap)
    // 热门度抬升：新片 MP 越高抬得越多（低于 50 小降）
    const finalMp = p.finalMp ?? r.mp ?? 50
    sequelIp.hotness = round1(
      clamp((sequelIp.hotness ?? 0) + (finalMp - 50) * IP_LONGTAIL_CONFIG.hotnessSequelK, 0, 100),
    )
    if (sequelIp.level > prevLevel) {
      pushNews(
        draft,
        `《${sequelIp.name}》系列累计票房突破 ${Math.round(sequelIp.totalBoxOffice)} 万，IP 升级至 Lv.${sequelIp.level}！`,
      )
    }
    return { name: sequelIp.name, entry: sequelIp.entry }
  }
  if ((r.boxOffice ?? 0) >= IP_CONFIG.originBoxOffice && (r.criticScore ?? 0) >= IP_CONFIG.originCriticScore) {
    const type = draft.scripts[p.scriptId]?.type ?? 'drama'
    const lv = ipLevel(r.boxOffice ?? 0)
    const newIp: IpAsset = {
      id: uid(draft, 'ip'),
      name: p.name,
      type,
      entry: 1,
      originWeek: draft.calendar.week,
      originYear: draft.calendar.year,
      totalBoxOffice: round1(r.boxOffice ?? 0),
      bestBoxOffice: round1(r.boxOffice ?? 0),
      bestCriticScore: r.criticScore ?? 0,
      level: lv,
      royaltyPerQuarter: royaltyPerQuarter(lv),
      sequelBonus: sequelBonusFactor(lv),
      merchBonus: clamp(maxMerch, 0, AD_CONFIG.merchBonusCap),
      royaltyEarned: 0,
      films: [p.id],
      hotness: p.finalMp ?? r.mp ?? 50,
      deals: [],
    }
    draft.company.ips.push(newIp)
    pushNews(
      draft,
      `《${p.name}》首轮票房 ${Math.round(r.boxOffice ?? 0)} 万、影评 ${(r.criticScore ?? 0).toFixed(1)} 分，沉淀为公司 IP（Lv.${lv}），可立项续作！`,
    )
    return { name: newIp.name, entry: 1 }
  }
  return undefined
}

type FilmResultLike = {
  boxOffice?: number
  criticScore?: number
  mp?: number
}

/**
 * 每周长尾收益结算（advanceWeek 内调用）：
 * IP 热门度衰减 + 周边收入入账 + 版权合同每周分期
 */
export function settleIpLongtail(draft: GameState): void {
  const cfg = IP_LONGTAIL_CONFIG
  const ipMul = draft.company.public ? IPO_CONFIG.ipRoyaltyMultiplier : 1
  for (const ip of draft.company.ips) {
    // 热门度：每周衰减（旧档缺省先按 level×20 起跳一次）
    if (typeof ip.hotness !== 'number') {
      ip.hotness = Math.min(100, (ip.level ?? 1) * cfg.hotnessSeedPerLevel)
    } else {
      ip.hotness = round1(clamp(ip.hotness * cfg.hotnessDecay, 0, 100))
    }
    // 周边收入（每周入账）
    const hotness = ip.hotness ?? 0
    const income =
      hotness *
      cfg.merchBasePerHotness *
      (1 + ((ip.level ?? 1) - 1) * cfg.merchLevelK) *
      (1 + (ip.merchBonus ?? 0) / 100) *
      ipMul
    if (income > 0) {
      draft.company.cash = round1(draft.company.cash + income)
      ip.royaltyEarned = round1((ip.royaltyEarned ?? 0) + income)
    }
    // 版权合同每周分期
    const deals = ip.deals ?? []
    for (const d of deals) {
      if (d.status !== 'active') continue
      const installment = d.total / d.weeks
      d.paid = round1(d.paid + installment)
      d.weeksPaid += 1
      draft.company.cash = round1(draft.company.cash + installment)
      if (d.weeksPaid >= d.weeks) {
        d.status = 'done'
        pushNews(draft, `《${ip.name}》IP 与${d.kind === 'tv' ? '电视剧' : '游戏'}公司版权合同履行完毕，共收入 ${d.total} 万。`)
      }
    }
  }
}

/**
 * 每周发行放映结算（advanceWeek 内调用）：
 * 待映攒预售/热度衰减 → 开映 → 每周票房 → 自动下片
 */
export function settleDistribution(draft: GameState): void {
  const cfg = CHANNEL_CONFIG.run
  for (const p of draft.projects) {
    if (p.stage !== 'released' || !p.run) continue
    const rs = p.run
    if (rs.status === 'presale') {
      // 待映：每周攒预售 + 热度衰减；到上映周开映
      rs.presale = round1(rs.presale + (p.hype ?? 50) * cfg.presalePerHypePerWeek)
      p.hype = round1((p.hype ?? 50) * cfg.hypeDecayPerWeek)
      if (draft.calendar.week >= rs.releaseWeek && draft.calendar.year >= rs.releaseYear) {
        const run = createRun(draft, p, p.channel ?? 'cinema', true, createRunConfig(p))
        rs.runs.push(run)
        rs.currentRunId = run.id
        rs.status = 'running'
        pushNews(draft, `《${p.name}》正式上映，进入${CHANNEL_INFO[run.channel].label}档放映。`)
        settleRunWeek(draft, p, run)
      }
      continue
    }
    if (rs.status === 'running' && rs.currentRunId) {
      const run = rs.runs.find((x) => x.id === rs.currentRunId)
      if (run && run.status === 'running') settleRunWeek(draft, p, run)
    }
  }
}
