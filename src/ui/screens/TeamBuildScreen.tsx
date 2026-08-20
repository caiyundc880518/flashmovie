import { useState } from 'react'
import type { Worker } from '../../core/types'
import { ROLE_IDS } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { ECONOMY } from '../../core/config/economy'
import { IP_CONFIG } from '../../core/config/ip'
import { BUDGET_CONFIG, BALANCED_ALLOC, allocTotal, type BudgetAlloc } from '../../core/config/budget'
import { AD_CONFIG, AD_SPONSORS, AD_SPONSOR_MAP } from '../../core/config/ads'
import { VFX_CONFIG } from '../../core/config/minigame'
import { vfxTypeFactor } from '../../core/rules/scoring'
import { techBonuses } from '../../core/rules/tech'
import { audienceFit } from '../../core/rules/audience'
import { ROLE_ZH, TYPE_ZH, fmtWan } from '../format'
import { PosterCard } from '../components/PosterCard'
import { MoneyText } from '../components/MoneyText'
import { Modal } from '../components/Modal'
import { Bar } from '../components/Bar'
import { WorkerDetail } from '../components/WorkerDetail'

interface Slots {
  directorId: string
  actorIds: string[]
  shooterId: string
  editorId: string
  marketId: string
  producerId: string
  technicianId: string
}

type SlotKey = Exclude<keyof Slots, 'actorIds'>

/** 槽位 key → 员工 role（用于选人弹窗默认职位筛选） */
const SLOT_ROLE: Record<SlotKey, string> = {
  directorId: 'director',
  shooterId: 'shooter',
  editorId: 'editor',
  marketId: 'market',
  producerId: 'producer',
  technicianId: 'technician',
}

/** 槽位定义：必配/可选 + 核心技能 + 一句话职责 */
const SLOT_DEFS: Record<SlotKey, { label: string; required: boolean; coreSkill?: string; hint: string }> = {
  directorId: { label: '导演', required: true, coreSkill: 'direct', hint: '定拍摄导向，贡献 Directing 分并决定拍摄速度。' },
  shooterId: { label: '摄影', required: true, coreSkill: 'shoot', hint: '贡献 Shooting 分，是拍摄小游戏的增益载体。' },
  editorId: { label: '剪辑', required: true, coreSkill: 'edit', hint: '贡献 Edit 分，剪辑取向决定市场向/艺术向 Buff。' },
  marketId: { label: '市场', required: true, coreSkill: 'market', hint: '提升 Hype、谈发行渠道与最终 MP。' },
  producerId: { label: '制片人', required: false, hint: '降低制作成本、提升剧本供给质量。' },
  technicianId: { label: '技术/特效', required: false, coreSkill: 'vfx', hint: 'VFX 技能决定可解锁的特效档位上限。' },
}

const SKILL_ZH: Record<string, string> = {
  act: '演技',
  direct: '导演',
  shoot: '摄影',
  edit: '剪辑',
  market: '市场',
  advertise: '广告',
  vfx: '特效',
  technical: '技术',
}

const STEPS = [
  { n: 1, label: '选择剧本' },
  { n: 2, label: '组建剧组' },
  { n: 3, label: '预算占比' },
  { n: 4, label: '特效等级' },
  { n: 5, label: '植入广告' },
] as const

const ALLOC_LABELS: { key: keyof BudgetAlloc; label: string; desc: string }[] = [
  { key: 'story', label: '着重剧情', desc: '提升成片剧情分，直接拉动艺术向评分（AP）。' },
  { key: 'vfx', label: '着重 VFX', desc: '投入特效制作，提升 VFX 分（随特效档位成本系数）。' },
  { key: 'acting', label: '着重表演', desc: '提升成片表演分，直接拉动市场向评分（MP）。' },
  { key: 'edit', label: '着重剪辑', desc: '提升成片剪辑分，让节奏更利落（基础分）。' },
]

interface PickerState {
  key: SlotKey | 'actor'
  index?: number
}

export function TeamBuildScreen({
  initialScriptId,
  initialIpId,
  onGoToProject,
}: {
  initialScriptId?: string | null
  initialIpId?: string | null
  onGoToProject: (id: string) => void
}) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  // 多步骤向导：1 选剧本 → 2 组剧组 → 3 预算占比 → 4 特效等级 → 5 植入广告
  const [step, setStep] = useState(1)
  const [scriptId, setScriptId] = useState(initialScriptId ?? '')
  const [slots, setSlots] = useState<Slots>({
    directorId: '',
    actorIds: [''],
    shooterId: '',
    editorId: '',
    marketId: '',
    producerId: '',
    technicianId: '',
  })
  const [alloc, setAlloc] = useState<BudgetAlloc>({ ...BALANCED_ALLOC })
  const [vfxLevel, setVfxLevel] = useState(0)
  const [adIds, setAdIds] = useState<string[]>([])
  const [ipId, setIpId] = useState(initialIpId ?? '')
  const [customName, setCustomName] = useState('')
  const [msg, setMsg] = useState('')
  const [picker, setPicker] = useState<PickerState | null>(null)
  // 选人弹窗：职位筛选 + 分页
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [created, setCreated] = useState<{
    id: string
    name: string
    ipName?: string
    ipEntry?: number
  } | null>(null)

  if (!state) return null

  // 已用于立项的剧本不可再筹拍
  const usedScriptIds = new Set(state.projects.map((p) => p.scriptId))
  const owned = state.company.ownedScriptIds
    .map((id) => state.scripts[id])
    .filter((sc) => sc && !usedScriptIds.has(sc.id))
  // 忙碌：正在非 released 项目中的员工
  const busySet = new Set(
    state.projects
      .filter((p) => p.stage !== 'released')
      .flatMap((p) => Object.values(p.team).flat()),
  )
  const allEmployees = state.company.employeeIds
    .map((id) => state.workers[id])
    .filter((w): w is Worker => !!w)
  // 已占用的人（选人弹窗里禁用，避免一人身兼数职）
  const pickedIds = new Set(
    [
      slots.directorId,
      slots.shooterId,
      slots.editorId,
      slots.marketId,
      slots.producerId,
      slots.technicianId,
      ...slots.actorIds,
    ].filter(Boolean),
  )

  const script = state.scripts[scriptId]
  const techSkill = state.workers[slots.technicianId]?.skills.vfx ?? 40
  // 科技树：虚拟制片降本、渲染引擎抬升 VFX 上限（GDD §5）
  const tech = techBonuses(state)
  const studioDiscount = 1 - tech.studio
  const tier = VFX_CONFIG.tiers[Math.min(vfxLevel, VFX_CONFIG.tiers.length - 1)]
  const base = script ? script.scale * ECONOMY.costPerStage : 0
  const totalAlloc = allocTotal(alloc)
  const budget = script
    ? base +
      base * (alloc.vfx / 100) * ECONOMY.vfxCostFactor * studioDiscount * tier.costMul +
      base * ((alloc.story + alloc.acting + alloc.edit) / 100) * BUDGET_CONFIG.allocCostFactor
    : 0

  // 续作立项（GDD §3.8）：IP 须与剧本同类型
  const selectedIp = state.company.ips.find((x) => x.id === ipId)
  const ipTypeMismatch = selectedIp ? selectedIp.type !== script?.type : false
  const sequelHype = selectedIp
    ? Math.min(100, Math.round(IP_CONFIG.sequelHypeBase + selectedIp.level * IP_CONFIG.sequelHypePerLevel))
    : 0

  // 广告商校验：当前团队演员最高 Fame（step5 显示"不满足将不予以赞助费"）
  const maxActorFame = Math.max(0, ...slots.actorIds.map((id) => state.workers[id]?.basic.fame ?? 0))
  const expectedAdIncome = adIds.reduce((s, id) => s + (AD_SPONSOR_MAP[id]?.sponsorFee ?? 0), 0)

  const setSlot = (key: SlotKey, value: string) => setSlots((s) => ({ ...s, [key]: value }))
  const setActor = (idx: number, value: string) =>
    setSlots((s) => {
      const actorIds = [...s.actorIds]
      actorIds[idx] = value
      return { ...s, actorIds }
    })
  const addActor = () => setSlots((s) => ({ ...s, actorIds: [...s.actorIds, ''] }))
  const removeActor = (idx: number) =>
    setSlots((s) => {
      const actorIds = s.actorIds.filter((_, i) => i !== idx)
      return { ...s, actorIds: actorIds.length > 0 ? actorIds : [''] }
    })

  const setAllocValue = (key: keyof BudgetAlloc, value: number) => {
    setAlloc((a) => {
      const next = { ...a, [key]: Math.max(0, Math.min(100, value)) }
      // 总和限制：其余项保持，当前项最高为 100 − 其他项之和
      const others = allocTotal(next) - next[key]
      if (others > BUDGET_CONFIG.totalCap) return a
      next[key] = Math.min(next[key], BUDGET_CONFIG.totalCap - others)
      return next
    })
  }

  const toggleAd = (id: string) => {
    setAdIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= AD_CONFIG.maxSponsors) return prev
      return [...prev, id]
    })
  }

  const openPicker = (key: SlotKey | 'actor', index?: number) => {
    setPicker({ key, index })
    // 打开弹窗时按当前槽位职位预筛
    setRoleFilter(key === 'actor' ? 'actor' : SLOT_ROLE[key])
    setPage(0)
  }
  const pickWorker = (w: Worker) => () => {
    if (!picker) return
    if (picker.key === 'actor') setActor(picker.index ?? 0, w.id)
    else setSlot(picker.key, w.id)
    setPicker(null)
  }

  const busyProjectName = (w: Worker) => {
    if (!w.currentProjectId) return ''
    const p = state.projects.find((x) => x.id === w.currentProjectId && x.stage !== 'released')
    return p ? `《${p.name}》` : ''
  }

  /** 一键沿用上一部原班人马（离职/忙碌成员跳过，空缺槽位需手动补） */
  const applyOriginalTeam = () => {
    if (!selectedIp) return setMsg('请先选择续作 IP')
    const ip = selectedIp
    const lastId = ip.films[ip.films.length - 1]
    const prev =
      state.projects.find((p) => p.id === lastId) ??
      [...state.projects].reverse().find((p) => p.ipId === ip.id)
    if (!prev) return setMsg(`「${ip.name}」还没有上一部作品，无法沿用原班人马`)
    const onStaff = new Set(state.company.employeeIds)
    const usable = (id?: string) => (id && onStaff.has(id) && !busySet.has(id) ? id : '')
    const prevActors = (prev.team.actorIds ?? []).map(usable).filter(Boolean)
    setSlots({
      directorId: usable(prev.team.directorId),
      actorIds: prevActors.length > 0 ? prevActors : [''],
      shooterId: usable(prev.team.shooterId),
      editorId: usable(prev.team.editorId),
      marketId: usable(prev.team.marketId),
      producerId: usable(prev.team.producerId),
      technicianId: usable(prev.team.technicianId),
    })
    const skipped = [prev.team.directorId, ...(prev.team.actorIds ?? []), prev.team.shooterId, prev.team.editorId, prev.team.marketId, prev.team.producerId, prev.team.technicianId]
      .filter((id): id is string => !!id)
      .filter((id) => !usable(id)).length
    setMsg(
      `已沿用《${prev.name}》原班人马${skipped > 0 ? `（${skipped} 位离职/忙碌已跳过，请补空缺）` : '。'}`,
    )
  }

  // 步骤校验：能否进入下一步 / 立项
  const canNext = () => {
    if (step === 1) return !!script && !ipTypeMismatch
    if (step === 2) {
      return !!slots.directorId && slots.actorIds.some(Boolean) && !!slots.shooterId && !!slots.editorId && !!slots.marketId
    }
    if (step === 3) return totalAlloc <= BUDGET_CONFIG.totalCap
    if (step === 4) return true
    return true
  }
  const nextStep = () => {
    if (!canNext()) return
    setMsg('')
    if (step === 4) {
      // 进入广告步时默认选中第一家低要求广告商？不，保持空选，玩家自选
    }
    setStep((s) => Math.min(5, s + 1))
  }

  const start = () => {
    if (!script) return setMsg('请先选择剧本')
    const actors = slots.actorIds.filter(Boolean)
    if (!slots.directorId || actors.length === 0 || !slots.shooterId || !slots.editorId || !slots.marketId) {
      return setMsg('导演 / 至少一名演员 / 摄影 / 剪辑 / 市场 为必配职位')
    }
    if (ipTypeMismatch) return setMsg(`续作须与 IP「${selectedIp?.name}」同类型（${TYPE_ZH[selectedIp?.type ?? 'drama']}）`)
    dispatch({
      type: 'startProject',
      scriptId,
      team: {
        directorId: slots.directorId,
        actorIds: actors,
        shooterId: slots.shooterId,
        editorId: slots.editorId,
        marketId: slots.marketId,
        producerId: slots.producerId || undefined,
        technicianId: slots.technicianId || undefined,
      },
      budgetAlloc: alloc,
      vfxLevel,
      adSponsorIds: adIds,
      ipId: selectedIp?.id,
      name: customName.trim() || undefined,
    })
    // 从最新状态找到刚创建的项目，弹窗引导前往项目页
    const latest = useGameStore.getState().state
    const createdProject = latest?.projects.find((x) => x.scriptId === scriptId)
    if (createdProject) {
      setCreated({
        id: createdProject.id,
        name: createdProject.name,
        ipName: createdProject.ipId
          ? latest?.company.ips.find((x) => x.id === createdProject.ipId)?.name
          : undefined,
        ipEntry: createdProject.ipEntry,
      })
    }
    setMsg('')
    setScriptId('')
    setIpId('')
    setCustomName('')
    setAdIds([])
    setAlloc({ ...BALANCED_ALLOC })
    setVfxLevel(0)
    setSlots({ directorId: '', actorIds: [''], shooterId: '', editorId: '', marketId: '', producerId: '', technicianId: '' })
    setStep(1)
  }

  /** 槽位卡片主体：已选员工摘要 or 空占位 */
  const slotBody = (w: Worker | undefined, def: { label: string; coreSkill?: string }) => {
    if (!w) {
      return (
        <div className="team-slot-empty">
          <span>未选择</span>
          <span className="dim">点击选择{def.label}</span>
        </div>
      )
    }
    return (
      <>
        <div className="table-name">{w.name}</div>
        <div className="dim">
          {ROLE_ZH[w.role]} · {w.gender === 'male' ? '男' : '女'} · {w.age}岁
        </div>
        <div className="attr-line">
          PA {w.basic.pa} · CA <b className="ca-cell">{w.basic.ca}</b> · Fame {Math.round(w.basic.fame)}
        </div>
        <div className="attr-line">
          心情 {Math.round(w.active.mood)} · 周薪 <MoneyText value={w.salary} />
        </div>
        {def.coreSkill && (
          <Bar label={`${SKILL_ZH[def.coreSkill]}技能`} value={w.skills[def.coreSkill as keyof typeof w.skills]} />
        )}
      </>
    )
  }

  /** 单个槽位卡片 */
  const slotCard = (key: SlotKey, value: string) => {
    const def = SLOT_DEFS[key]
    const w = value ? state.workers[value] : undefined
    return (
      <div key={key} className="team-slot-card" onClick={() => openPicker(key)}>
        <div className="team-slot-head">
          <span className="slot-title">{def.label}</span>
          <span className="tag tag-required">{def.required ? '必配' : '可选'}</span>
        </div>
        <div className="team-slot-body">{slotBody(w, def)}</div>
        <div className="team-slot-foot">
          <span className="slot-link">{w ? '更换人选 ⇄' : '选择人选 ⇄'}</span>
          <span className="dim">{def.required ? '' : '可空缺'}</span>
        </div>
      </div>
    )
  }

  /** 演员槽位卡片（1–3 名，可移除） */
  const actorSlotCard = (idx: number, value: string) => {
    const w = value ? state.workers[value] : undefined
    return (
      <div key={`actor-${idx}`} className="team-slot-card" onClick={() => openPicker('actor', idx)}>
        <div className="team-slot-head">
          <span className="slot-title">演员 {idx + 1}</span>
          <span className="tag tag-required">必配</span>
          <button
            className="slot-remove"
            title="移除该演员槽位"
            onClick={(e) => {
              e.stopPropagation()
              removeActor(idx)
            }}
          >
            ✕
          </button>
        </div>
        <div className="team-slot-body">{slotBody(w, { label: '演员', coreSkill: 'act' })}</div>
        <div className="team-slot-foot">
          <span className="slot-link">{w ? '更换人选 ⇄' : '选择人选 ⇄'}</span>
          <span className="dim">票房人气来源</span>
        </div>
      </div>
    )
  }

  const pickerDef = picker && picker.key !== 'actor' ? SLOT_DEFS[picker.key] : null
  const pickerTitle = picker
    ? picker.key === 'actor'
      ? `选择演员 ${(picker.index ?? 0) + 1}`
      : `选择${SLOT_DEFS[picker.key].label}`
    : ''
  const pickerCoreSkill = pickerDef?.coreSkill
  const currentValue =
    picker && picker.key !== 'actor'
      ? slots[picker.key]
      : picker
        ? slots.actorIds[picker.index ?? 0]
        : ''
  const detailWorker = detailId ? state.workers[detailId] : undefined

  // 选人列表：职位筛选 → 分页
  const PAGE_SIZE = 12
  const filteredEmployees =
    roleFilter === 'all' ? allEmployees : allEmployees.filter((w) => w.role === roleFilter)
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageEmployees = filteredEmployees.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  )

  return (
    <div className="screen">
      {/* 步骤条 */}
      <div className="wizard-steps">
        {STEPS.map((s) => (
          <button
            key={s.n}
            className={`wizard-step${step === s.n ? ' wizard-step-current' : ''}${step > s.n ? ' wizard-step-done' : ''}`}
            onClick={() => {
              // 只能回退到已到达的步骤
              if (s.n < step) setStep(s.n)
            }}
            disabled={s.n > step}
          >
            <span className="wizard-step-n">{step > s.n ? '✓' : s.n}</span>
            <span className="wizard-step-label">{s.label}</span>
          </button>
        ))}
      </div>

      {step === 1 && (
        <section className="panel">
          <h2>① 选择剧本 {script && <span className="dim">—《{script.title}》</span>}</h2>
          <p className="dim">选择要拍摄的剧本；若想拍摄续作，可一并选定所属 IP 系列（须同类型）。</p>
          {owned.length === 0 && <p className="dim">没有可立项的剧本（已拍过的剧本不能重复筹拍）。</p>}
          <div className="poster-grid">
            {owned.map((sc) => (
              <PosterCard
                key={sc.id}
                title={sc.title}
                type={sc.type}
                active={sc.id === scriptId}
                onClick={() => setScriptId(sc.id)}
              >
                <div className="attr-line">
                  {TYPE_ZH[sc.type]} · 规模 {sc.scale} 场 · 艺术 {sc.artPot} · 市场 {sc.marketPot}
                </div>
                <div className="attr-line">
                  观众契合 ×{audienceFit(state, sc.type).toFixed(2)}
                  {state.world.trend?.type === sc.type ? ' · 契合潮流' : ''}
                </div>
              </PosterCard>
            ))}
            {owned.length === 0 && <p className="dim">剧本库为空。</p>}
          </div>

          <div className="config-row">
            <label className="config-label">
              电影名（可选，留空默认用剧本名）
              {selectedIp && <span className="warn"> · 续作沿用系列名</span>}
            </label>
            <input
              type="text"
              maxLength={24}
              value={selectedIp ? '' : customName}
              placeholder={selectedIp ? `${selectedIp.name} ${selectedIp.entry + 1}` : script?.title ?? '输入自定义片名'}
              disabled={!!selectedIp}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>

          {state.company.ips.length > 0 && (
            <div className="config-row">
              <label className="config-label">续作立项（IP 系列化）</label>
              <select value={ipId} onChange={(e) => setIpId(e.target.value)}>
                <option value="">— 新 IP（原创作品）—</option>
                {state.company.ips.map((ip) => (
                  <option key={ip.id} value={ip.id}>
                    {ip.name} · 第 {ip.entry} 部 · Lv.{ip.level}（票房 +{Math.round((ip.sequelBonus - 1) * 100)}%）
                    {ip.merchBonus > 0 ? ` · 周边 +${ip.merchBonus}%` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedIp && (
            <>
              <p className="dim">
                续作《{selectedIp.name} {selectedIp.entry + 1}》
                <b style={{ color: 'var(--gold)' }}> · 初始热度 {sequelHype}</b> · 票房加成 +{Math.round((selectedIp.sequelBonus - 1) * 100)}% · 发行商预付款加成 +{Math.round(selectedIp.level * IP_CONFIG.publisherPrepayPerLevel * 100)}%
                {ipTypeMismatch && (
                  <span className="warn">（本片为 {TYPE_ZH[script?.type ?? 'drama']}，续作须为 {TYPE_ZH[selectedIp.type]}）</span>
                )}
              </p>
              <div className="btn-row">
                <button className="btn-primary" onClick={applyOriginalTeam}>
                  👥 沿用上一部原班人马
                </button>
                <span className="dim">离职/忙碌的成员会自动跳过，空缺槽位手动补充。</span>
              </div>
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="panel">
          <h2>② 组建剧组 — 《{script?.title ?? '…'}》</h2>
          <p className="dim">点击槽位卡片选择成员，弹窗里可查看每位员工的完整信息。</p>
          <div className="team-slot-grid">
            {slotCard('directorId', slots.directorId)}
            {slots.actorIds.map((aid, idx) => actorSlotCard(idx, aid))}
            {slots.actorIds.length < 3 && (
              <div className="team-slot-card slot-add-card" onClick={addActor}>
                <div className="team-slot-empty">
                  <span>＋</span>
                  <span>添加演员（最多 3 名）</span>
                </div>
              </div>
            )}
            {slotCard('shooterId', slots.shooterId)}
            {slotCard('editorId', slots.editorId)}
            {slotCard('marketId', slots.marketId)}
            {slotCard('producerId', slots.producerId)}
            {slotCard('technicianId', slots.technicianId)}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="panel">
          <h2>③ 设定预算占比</h2>
          <p className="dim">
            把制作预算按侧重分配到四个方向（总和不超过 {BUDGET_CONFIG.totalCap}%），
            占比越高，对应成片分项在结算时的加成越多（100% 侧重 ≈ +{BUDGET_CONFIG.maxBonus} 分）。
          </p>
          <div className="alloc-grid">
            {ALLOC_LABELS.map(({ key, label, desc }) => (
              <div key={key} className="alloc-row">
                <div className="alloc-head">
                  <span className="alloc-label">{label}</span>
                  <span className="alloc-value">{alloc[key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={alloc[key]}
                  onChange={(e) => setAllocValue(key, Number(e.target.value))}
                />
                <p className="dim">{desc}</p>
              </div>
            ))}
          </div>
          <div className={`alloc-total${totalAlloc > BUDGET_CONFIG.totalCap ? ' alloc-total-over' : ''}`}>
            总占比 <b>{totalAlloc}%</b> / {BUDGET_CONFIG.totalCap}%
            {totalAlloc > BUDGET_CONFIG.totalCap && <span className="warn">（超过上限，请下调）</span>}
            {totalAlloc < BUDGET_CONFIG.totalCap && (
              <span className="dim"> · 其余 {BUDGET_CONFIG.totalCap - totalAlloc}% 为常规制作</span>
            )}
          </div>
          <div className="btn-row">
            <button onClick={() => setAlloc({ ...BALANCED_ALLOC })}>⚖️ 均衡分配（各 25%）</button>
          </div>
          {script && (
            <p className="dim">
              预算约 <MoneyText value={budget} />（{script.scale} 场 × 单价 {fmtWan(ECONOMY.costPerStage)}）
              {tech.studio > 0 && (
                <span className="dim"> + VFX 成本 −{Math.round(tech.studio * 100)}%（虚拟制片）</span>
              )}
            </p>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="panel">
          <h2>④ 选择特效等级</h2>
          <p className="dim">
            特效档位由技术/特效岗的 VFX 技能解锁（当前技能 <b>{Math.round(techSkill)}</b>）。
            档位越高，VFX 分上限越高，但特效成本系数越大（虚拟制片折扣可降低）。
          </p>
          {!slots.technicianId && (
            <p className="warn">未配置技术/特效岗，仅可解锁基础特效（技能按 40 计）。</p>
          )}
          <div className="tier-grid">
            {VFX_CONFIG.tiers.map((t, idx) => {
              const unlocked = techSkill >= t.minSkill
              const active = vfxLevel === idx
              return (
                <div
                  key={t.label}
                  className={`tier-card${active ? ' tier-card-active' : ''}${!unlocked ? ' tier-card-locked' : ''}`}
                  onClick={() => unlocked && setVfxLevel(idx)}
                >
                  <div className="tier-head">
                    <span className="slot-title">{t.label}</span>
                    {!unlocked && <span className="tag">需技能 {t.minSkill}</span>}
                    {unlocked && <span className="tag tag-required">{active ? '已选择' : '可解锁'}</span>}
                  </div>
                  <div className="attr-line">VFX 分上限 <b>{t.max}</b>{tech.render > 0 ? ` + 渲染引擎 ${tech.render}` : ''}</div>
                  <div className="attr-line">成本系数 ×{t.costMul.toFixed(1)}</div>
                  <div className="dim">类型加成 {TYPE_ZH[script?.type ?? 'drama']} ×{vfxTypeFactor(script?.type ?? 'drama', tech.mocap).toFixed(2)}</div>
                </div>
              )
            })}
          </div>
          {script && (
            <p className="dim">
              预算约 <MoneyText value={budget} />（含特效档位成本系数 ×{tier.costMul.toFixed(1)}）
            </p>
          )}
        </section>
      )}

      {step === 5 && (
        <section className="panel">
          <h2>⑤ 植入广告</h2>
          <p className="dim">
            选择愿意植入的品牌（最多 {AD_CONFIG.maxSponsors} 家）。上映结算时逐家校验：
            <b> 影评人平均分 ≥ 要求</b> 且 <b>团队演员最高 Fame ≥ 要求</b>，达标才到账赞助费；
            不满足要求将不予以赞助费增加。知名度高的广告商还能提升所属 IP 系列的周边收入。
          </p>
          <p className="dim">
            当前团队演员最高 Fame：<b>{Math.round(maxActorFame)}</b> · 已选 {adIds.length}/{AD_CONFIG.maxSponsors} 家 ·
            预计赞助（全部达标）<b style={{ color: 'var(--gold)' }}>{fmtWan(expectedAdIncome)}</b>
            {selectedIp && <span className="dim"> · 系列周边加成可累计</span>}
          </p>
          <div className="ad-grid">
            {AD_SPONSORS.map((ad) => {
              const selected = adIds.includes(ad.id)
              const fameOk = maxActorFame >= ad.requiredFame
              const disabled = !selected && adIds.length >= AD_CONFIG.maxSponsors
              return (
                <div
                  key={ad.id}
                  className={`ad-card${selected ? ' ad-card-selected' : ''}${disabled ? ' ad-card-disabled' : ''}`}
                  onClick={() => !disabled && toggleAd(ad.id)}
                >
                  <div className="ad-head">
                    <span className="slot-title">{ad.name}</span>
                    <span className="tag">{ad.industry}</span>
                  </div>
                  <div className="attr-line">
                    知名度 <b>{ad.popularity}</b> · 赞助费 <b style={{ color: 'var(--gold)' }}>{fmtWan(ad.sponsorFee)}</b>
                  </div>
                  <div className="attr-line">
                    要求：影评 ≥ <b>{ad.minCriticScore.toFixed(1)}</b> 分
                    {ad.requiredFame > 0 && (
                      <span className={fameOk ? 'ok' : 'warn'}>
                        {' '}· 演员 Fame ≥ {ad.requiredFame}{fameOk ? '（满足）' : '（不满足，无赞助）'}
                      </span>
                    )}
                  </div>
                  <div className="attr-line">
                    {ad.merchBonus > 0 ? (
                      <span className="ok">IP 周边收入 +{ad.merchBonus}%</span>
                    ) : (
                      <span className="dim">无周边加成</span>
                    )}
                    {' · '}
                    <span className="dim">AP −{AD_CONFIG.apPenaltyPerAd}</span>
                  </div>
                  <div className="ad-foot">
                    {selected ? <span className="ok">✓ 已签约</span> : <span className="slot-link">点击签约 ⇄</span>}
                    {disabled && !selected && <span className="dim">最多 {AD_CONFIG.maxSponsors} 家</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {adIds.length === 0 && <p className="dim">也可以不植入广告（避免 AP 惩罚与要求风险）。</p>}
        </section>
      )}

      {msg && <p className="msg">{msg}</p>}

      {/* 底部导航 */}
      <div className="wizard-nav">
        <button disabled={step === 1} onClick={() => { setStep((s) => s - 1); setMsg('') }}>
          ← 上一步
        </button>
        <div className="wizard-nav-summary">
          {script && <span className="dim">《{script.title}》</span>}
          {step === 3 && (
            <span className="dim">总占比 {totalAlloc}% · 预算 <MoneyText value={budget} /></span>
          )}
          {step === 5 && adIds.length > 0 && (
            <span className="dim">已签约 {adIds.length} 家广告商</span>
          )}
        </div>
        {step < 5 ? (
          <button className="btn-primary" disabled={!canNext()} onClick={nextStep}>
            下一步 →
          </button>
        ) : (
          <button className="btn-primary" onClick={start}>
            🎬 立项
          </button>
        )}
      </div>

      {/* 选人弹窗：职位筛选 + 分页 */}
      {picker && (
        <Modal title={pickerTitle} wide onClose={() => setPicker(null)}>
          {pickerDef && <p className="dim">{pickerDef.hint}</p>}
          {allEmployees.length === 0 ? (
            <p className="dim">公司还没有员工，先去「招聘」页雇人吧。</p>
          ) : (
            <>
              <div className="candidate-filter">
                <button
                  className={`chip${roleFilter === 'all' ? ' chip-active' : ''}`}
                  onClick={() => {
                    setRoleFilter('all')
                    setPage(0)
                  }}
                >
                  全部（{allEmployees.length}）
                </button>
                {ROLE_IDS.map((r) => {
                  const n = allEmployees.filter((w) => w.role === r).length
                  if (n === 0) return null
                  return (
                    <button
                      key={r}
                      className={`chip${roleFilter === r ? ' chip-active' : ''}`}
                      onClick={() => {
                        setRoleFilter(r)
                        setPage(0)
                      }}
                    >
                      {ROLE_ZH[r]}（{n}）
                    </button>
                  )
                })}
              </div>

              <div className="candidate-grid">
                {pageEmployees.map((w) => {
                  const busy = busySet.has(w.id)
                  const alreadyUsed = pickedIds.has(w.id) && w.id !== currentValue
                  const disabled = busy || alreadyUsed
                  return (
                    <div key={w.id} className={`candidate-card${disabled ? ' candidate-disabled' : ''}`}>
                      <div className="candidate-head">
                        <span className="table-name">{w.name}</span>
                        <span className="tag">{ROLE_ZH[w.role]}</span>
                      </div>
                      <div className="attr-line">
                        {w.gender === 'male' ? '男' : '女'} · {w.age}岁 · 周薪 <MoneyText value={w.salary} />
                      </div>
                      <div className="attr-line">
                        PA {w.basic.pa} · CA <b className="ca-cell">{w.basic.ca}</b> · Fame {Math.round(w.basic.fame)}
                      </div>
                      <div className="attr-line">
                        心情 {Math.round(w.active.mood)} · 状态{' '}
                        {busy ? (
                          <span className="warn">拍摄中 {busyProjectName(w)}</span>
                        ) : (
                          <span className="ok">空闲{w.idleWeeks > 0 ? `（${w.idleWeeks} 周）` : ''}</span>
                        )}
                      </div>
                      {pickerCoreSkill && (
                        <Bar
                          label={`${SKILL_ZH[pickerCoreSkill]}技能`}
                          value={w.skills[pickerCoreSkill as keyof typeof w.skills]}
                        />
                      )}
                      <div className="btn-row">
                        <button
                          className="btn-primary"
                          disabled={disabled}
                          onClick={pickWorker(w)}
                          title={disabled ? (busy ? '该员工正在拍摄其他项目' : '该员工已安排其他职位') : '选用'}
                        >
                          选用
                        </button>
                        <button onClick={() => setDetailId(w.id)}>详情</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="candidate-pager">
                <button disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>
                  ← 上一页
                </button>
                <span>
                  第 {safePage + 1} / {pageCount} 页 · 共 {filteredEmployees.length} 人
                </span>
                <button disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                  下一页 →
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* 嵌套员工详情（叠加在选人弹窗之上） */}
      {detailWorker && (
        <Modal
          title={
            <>
              {detailWorker.name} <span className="dim">{ROLE_ZH[detailWorker.role]}</span>
            </>
          }
          wide
          onClose={() => setDetailId(null)}
        >
          <WorkerDetail worker={detailWorker} />
        </Modal>
      )}

      {created && (
        <Modal title="🎬 立项成功" onClose={() => setCreated(null)}>
          <p>
            《{created.name}》剧组已组建完成，等待开拍。
          </p>
          {created.ipName && created.ipEntry && (
            <p className="dim">
              已作为「{created.ipName}」系列第 {created.ipEntry} 部续作立项，自带初始热度与系列观众加成。
            </p>
          )}
          <p className="dim">
            前往「项目」页开拍吧——拍摄途中会遇到随机事件，别忘了参与拍摄小游戏赚取 Buff。
          </p>
          <div className="btn-row">
            <button
              className="btn-primary"
              onClick={() => {
                const id = created.id
                setCreated(null)
                onGoToProject(id)
              }}
            >
              前往拍摄 ▶
            </button>
            <button onClick={() => setCreated(null)}>继续立项</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
