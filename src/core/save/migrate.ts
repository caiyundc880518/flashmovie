import type {
  AudienceGroup,
  Channel,
  Competitor,
  CompetitorIp,
  CompetitorPersonality,
  Critic,
  FilmProject,
  GameState,
  Investor,
  IpAsset,
  Publisher,
  ScriptDraft,
  World,
} from '../types'
import { createRng } from '../rng'
import { pick, randInt } from '../rng'
import { FILM_TYPES, type FilmType } from '../types'
import { WORLD_CONFIG } from '../config/world'
import {
  generateAudienceGroups,
  generateCompetitors,
  generateCritics,
  generateInvestors,
  generatePublishers,
  pickPersonality,
} from '../generators/worldGen'
import { ensureCompetitorTeams } from '../rules/competitor'
import { SAVE_VERSION } from './schema'

/**
 * 存档迁移链：按版本逐级升级到最新。
 * v2：世界新增 competitors / critics（AI 对手 + 影评人）。
 * v3：世界新增 publishers（发行商）；项目新增 channels（发行渠道）。
 * v4：世界新增 investors（投资人）；公司新增 schoolLevel。
 * v5：公司新增 ips（IP 资产，GDD §3.8）。
 * v6：公司新增 tech（科技树研发进度）。
 * v7：世界新增 audience（观众群体，GDD §6）。
 * v8：世界新增 activeEvents（市场事件，GDD §6 Random Events）。
 * v9：公司新增 public（IPO 上市状态，GDD §3.1；可选字段，无数据迁移）。
 * v10：GameState 新增 scriptDrafts（编剧抽卡委托，签约编剧三档卡池）。
 * v11：项目新增 budgetAlloc/vfxLevel/adSponsorIds（预算占比+特效档位+植入广告商），
 *       IP 新增 merchBonus（周边收入加成）。
 * v12：项目大修：渠道改单选（cinema/web/dvd/free，流媒体/发行商取消），
 *       新增 warmup（筹备预热）、shotGameBonus/pendingShotGame/editGameDone/editGameBonus（强制小游戏）。
 * v13：发行长尾大修：上映改「定档 + 每周动态票房结算 + 下片 + 再发行」；
 *       旧已上映影片视为彻底完结（run.status='finished'，只读不参与再发行）；
 *       IP 新增 hotness（热门度，旧档 = level×20）与 deals（版权合同，空）。
 */
export function migrateSave(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('存档损坏：不是有效对象')
  }
  const s = raw as { version?: unknown }
  if (typeof s.version !== 'number' || s.version <= 0 || s.version > SAVE_VERSION) {
    throw new Error(`存档版本不受支持：${String(s.version)}`)
  }

  let state = raw as GameState
  if (state.version === 1) state = migrateV1toV2(state)
  if (state.version === 2) state = migrateV2toV3(state)
  if (state.version === 3) state = migrateV3toV4(state)
  if (state.version === 4) state = migrateV4toV5(state)
  if (state.version === 5) state = migrateV5toV6(state)
  if (state.version === 6) state = migrateV6toV7(state)
  if (state.version === 7) state = migrateV7toV8(state)
  if (state.version === 8) state = migrateV8toV9(state)
  if (state.version === 9) state = migrateV9toV10(state)
  if (state.version === 10) state = migrateV10toV11(state)
  if (state.version === 11) state = migrateV11toV12(state)
  if (state.version === 12) state = migrateV12toV13(state)
  if (state.version === 13) state = migrateV13toV14(state)
  if (state.version === 14) state = migrateV14toV15(state)
  // 兼容修复：世界实体为空时按种子补生成（覆盖迁移与早期空档）
  state = ensureWorldPopulated(state)
  // NPC 团队补齐：对手自带员工（新档与旧档统一，确定性派生）
  ensureCompetitorTeams(state)
  return state
}

/** v1 → v2：世界补上空的对手与影评人列表（由 ensureWorldPopulated 实际生成） */
function migrateV1toV2(s: GameState): GameState {
  const world = s.world as World & { competitors?: Competitor[]; critics?: Critic[] }
  world.competitors = world.competitors ?? []
  world.critics = world.critics ?? []
  return { ...s, version: 2 }
}

/** v2 → v3：世界补发行商；项目补发行渠道（空 = 默认影院） */
function migrateV2toV3(s: GameState): GameState {
  const world = s.world as World & { publishers?: Publisher[] }
  world.publishers = world.publishers ?? []
  for (const p of s.projects) {
    const project = p as FilmProject & { channels?: unknown[] }
    if (!Array.isArray(project.channels)) {
      // 早期无渠道字段的项目：默认影院
      project.channel = 'cinema'
    }
  }
  return { ...s, version: 3 }
}

/** v3 → v4：世界补投资人；公司补写作学校等级 */
function migrateV3toV4(s: GameState): GameState {
  const world = s.world as World & { investors?: Investor[] }
  world.investors = world.investors ?? []
  if (typeof s.company.schoolLevel !== 'number') {
    ;(s.company as { schoolLevel?: number }).schoolLevel = 0
  }
  return { ...s, version: 4 }
}

/** v4 → v5：公司补 IP 资产列表 */
function migrateV4toV5(s: GameState): GameState {
  const company = s.company as { ips?: IpAsset[] }
  if (!Array.isArray(company.ips)) company.ips = []
  return { ...s, version: 5 }
}

/** v5 → v6：公司补科技树研发进度 */
function migrateV5toV6(s: GameState): GameState {
  const company = s.company as { tech?: Record<string, number> }
  if (!company.tech || typeof company.tech !== 'object') company.tech = {}
  return { ...s, version: 6 }
}

/** v6 → v7：世界补观众群体（由 ensureWorldPopulated 实际生成） */
function migrateV6toV7(s: GameState): GameState {
  const world = s.world as World & { audience?: AudienceGroup[] }
  if (!Array.isArray(world.audience)) world.audience = []
  return { ...s, version: 7 }
}

/** v7 → v8：世界补市场事件列表 */
function migrateV7toV8(s: GameState): GameState {
  const world = s.world as World & { activeEvents?: unknown[] }
  if (!Array.isArray(world.activeEvents)) world.activeEvents = []
  return { ...s, version: 8 }
}

/** v8 → v9：公司补上市状态（可选字段，无需数据迁移） */
function migrateV8toV9(s: GameState): GameState {
  return { ...s, version: 9 }
}

/** v9 → v10：GameState 补编剧抽卡委托列表 */
function migrateV9toV10(s: GameState): GameState {
  const g = s as GameState & { scriptDrafts?: ScriptDraft[] }
  if (!Array.isArray(g.scriptDrafts)) g.scriptDrafts = []
  return { ...g, version: 10 }
}

/** v10 → v11：项目补预算占比/特效档位/广告商；IP 补周边加成 */
function migrateV10toV11(s: GameState): GameState {
  for (const p of s.projects) {
    const project = p as FilmProject & { vfxPercent?: number; hasAd?: boolean }
    if (!project.budgetAlloc) {
      const oldVfx = typeof project.vfxPercent === 'number' ? project.vfxPercent : 0
      project.budgetAlloc = { story: 0, vfx: oldVfx, acting: 0, edit: 0 }
    }
    if (typeof project.vfxLevel !== 'number') project.vfxLevel = 0
    if (!Array.isArray(project.adSponsorIds)) {
      project.adSponsorIds = project.hasAd ? ['ad_tea'] : []
    }
    delete project.vfxPercent
    delete project.hasAd
  }
  for (const ip of s.company.ips) {
    if (typeof ip.merchBonus !== 'number') ip.merchBonus = 0
  }
  return { ...s, version: 11 }
}

/** v11 → v12：项目渠道改单选 + 预热/小游戏字段；流媒体与发行商取消 */
function migrateV11toV12(s: GameState): GameState {
  for (const p of s.projects) {
    const project = p as FilmProject & {
      channels?: Channel[]
      publisherId?: string
      marketingBudget?: number
    }
    // 渠道：多选数组 → 单选（旧档首个有效渠道；streaming 映射为 web）
    if (typeof project.channel !== 'string') {
      const old = project.channels ?? []
      const first = (old as string[]).find((c) => c !== 'streaming') ?? (old as string[])[0]
      project.channel = (first === 'streaming' ? 'web' : (first as Channel)) ?? 'cinema'
    }
    if (typeof project.cinemaCount !== 'number') project.cinemaCount = 0
    if (!Array.isArray(project.webPlatforms)) project.webPlatforms = []
    if (typeof project.webWeeks !== 'number') project.webWeeks = 0
    if (typeof project.dvdPrice !== 'number') project.dvdPrice = 0
    if (typeof project.freeAdPrice !== 'number') project.freeAdPrice = 0
    if (typeof project.warmup !== 'number') project.warmup = 0
    if (typeof project.shotGameBonus !== 'number') project.shotGameBonus = 0
    if (typeof project.pendingShotGame !== 'boolean') project.pendingShotGame = false
    if (typeof project.editGameDone !== 'boolean') project.editGameDone = project.stage !== 'editing'
    if (typeof project.editGameBonus !== 'number') project.editGameBonus = 0
    delete project.channels
    delete project.publisherId
    delete project.marketingBudget
  }
  return { ...s, version: 12 }
}

/** v12 → v13：发行长尾大修。旧已上映影片=彻底完结；IP 补热门度/版权合同 */
function migrateV12toV13(s: GameState): GameState {
  const cal = s.calendar
  for (const p of s.projects) {
    const project = p as FilmProject & { releasedWeek?: number }
    if (project.stage !== 'released') continue
    const r = project.result
    if (!project.run) {
      // 旧已上映影片：视为首轮已下片、彻底完结（只读，不参与再发行）
      project.run = {
        status: 'finished',
        currentRunId: null,
        runs: [],
        releaseWeek: project.releasedWeek ?? cal.week,
        releaseYear: cal.year,
        presale: 0,
        firstRunEnded: true,
        basePotential: r?.boxOffice ?? 0,
      }
      project.currentMp = r?.mp ?? 0
      project.currentAudience = r?.audienceScore ?? 0
      project.finalMp = r?.mp ?? 0
      project.finalAudience = r?.audienceScore ?? 0
    }
  }
  for (const ip of s.company.ips) {
    if (typeof ip.hotness !== 'number') {
      ip.hotness = Math.min(100, (ip.level ?? 1) * 20)
    }
    if (!Array.isArray(ip.deals)) ip.deals = []
  }
  return { ...s, version: 13 }
}

/** v13 → v14：员工获奖履历 week→year（TMA 颁奖恒在第1周举行，旧档 week 恒为 1，年份按 1 兜底） */
function migrateV13toV14(s: GameState): GameState {
  for (const w of Object.values(s.workers)) {
    if (!Array.isArray(w.awards)) continue
    w.awards = w.awards.map((a) => ({
      year: (a as { week?: number }).week ?? 1,
      award: a.award,
      projectName: a.projectName,
    }))
  }
  return { ...s, version: 14 }
}

/** v14 → v15：NPC AI 强化——对手补性格/资金池/团队/IP 字段（按种子确定性派生） */
function migrateV14toV15(s: GameState): GameState {
  const cfg = WORLD_CONFIG.competitor
  s.world.competitors.forEach((c, i) => {
    const comp = c as Competitor & {
      personality?: CompetitorPersonality
      cash?: number
      team?: string[]
      ips?: CompetitorIp[]
      homeTypes?: FilmType[]
    }
    // 每个对手一个确定性 rng（种子 + 序号 + id 哈希），避免迁移结果随机漂移
    const rng = createRng(
      ((s.seed ^ 0x51a7 ^ i * 7919 ^ c.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) * 31) >>> 0) + 1,
    )
    if (!comp.personality) {
      comp.personality = pickPersonality(rng)
      if (comp.personality === 'specialist') {
        const pool = [...FILM_TYPES]
        for (let j = pool.length - 1; j > 0; j--) {
          const k = Math.floor(rng() * (j + 1))
          ;[pool[j], pool[k]] = [pool[k], pool[j]]
        }
        comp.homeTypes = pool.slice(
          0,
          randInt(rng, cfg.specialistHomeTypes[0], cfg.specialistHomeTypes[1]),
        )
      }
    }
    if (typeof comp.cash !== 'number') comp.cash = randInt(rng, cfg.startCash[0], cfg.startCash[1])
    if (!Array.isArray(comp.team)) comp.team = []
    if (!Array.isArray(comp.ips)) comp.ips = []
  })
  return { ...s, version: 15 }
}

/** 世界实体为空时，用存档种子派生确定性生成 */function ensureWorldPopulated(s: GameState): GameState {
  const world = s.world as World & {
    competitors?: Competitor[]
    critics?: Critic[]
    audience?: AudienceGroup[]
    publishers?: Publisher[]
    investors?: Investor[]
  }
  const needAll = !Array.isArray(world.competitors) || world.competitors.length === 0
  const needCritics = !Array.isArray(world.critics) || world.critics.length === 0
  const needAudience = !Array.isArray(world.audience) || world.audience.length === 0
  const needPubs = !Array.isArray(world.publishers) || world.publishers.length === 0
  const needInvs = !Array.isArray(world.investors) || world.investors.length === 0
  // 影评人固定 5 位：已有但不足的旧档补足
  const criticShort = Array.isArray(world.critics) && world.critics.length < WORLD_CONFIG.criticCount[0]
  if (needAll || needCritics || criticShort || needAudience || needPubs || needInvs) {
    const rng = createRng((s.seed ^ 0x51a7) >>> 0)
    const aiRng = createRng((s.seed ^ 0x51a7 ^ 0xbeef) >>> 0)
    let n = 1
    const uid = (p: string) => `${p}${(n++).toString(36)}`
    if (needAll) world.competitors = generateCompetitors(rng, uid, aiRng)
    if (needCritics) {
      world.critics = generateCritics(rng, uid)
    } else if (criticShort) {
      // 补足缺口影评人：沿用名池中未被占用的名字，编号避开现有 id
      const usedNames = new Set(world.critics.map((c) => c.name))
      const namePool = WORLD_CONFIG.criticNames.filter((nm) => !usedNames.has(nm))
      const usedIds = new Set(world.critics.map((c) => c.id))
      let idN = 1
      while (usedIds.has(`crit${idN}`)) idN++
      const gap = WORLD_CONFIG.criticCount[0] - world.critics.length
      for (let i = 0; i < gap; i++) {
        const idx = Math.floor(rng() * namePool.length)
        const name = namePool.splice(idx, 1)[0]
        world.critics.push({
          id: `crit${idN++}`,
          name,
          taste: rng() < 0.6 ? pick(rng, FILM_TYPES) : ('none' as const),
          influence: randInt(
            rng,
            WORLD_CONFIG.criticInfluenceRange[0],
            WORLD_CONFIG.criticInfluenceRange[1],
          ),
        })
      }
    }
    if (needAudience) world.audience = generateAudienceGroups(rng, uid)
    if (needPubs) world.publishers = generatePublishers(rng, uid)
    if (needInvs) world.investors = generateInvestors(rng, uid)
  }
  return s
}
