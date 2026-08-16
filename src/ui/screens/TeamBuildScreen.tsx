import { useState } from 'react'
import type { Worker } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { ECONOMY } from '../../core/config/economy'
import { IP_CONFIG } from '../../core/config/ip'
import { vfxTier, vfxTypeFactor } from '../../core/rules/scoring'
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

/** 槽位定义：必配/可选 + 核心技能 + 一句话职责 */
const SLOT_DEFS: Record<SlotKey, { label: string; required: boolean; coreSkill?: string; hint: string }> = {
  directorId: { label: '导演', required: true, coreSkill: 'direct', hint: '定拍摄导向，贡献 Directing 分并决定拍摄速度。' },
  shooterId: { label: '摄影', required: true, coreSkill: 'shoot', hint: '贡献 Shooting 分，是拍摄小游戏的增益载体。' },
  editorId: { label: '剪辑', required: true, coreSkill: 'edit', hint: '贡献 Edit 分，剪辑取向决定市场向/艺术向 Buff。' },
  marketId: { label: '市场', required: true, coreSkill: 'market', hint: '提升 Hype、谈发行渠道与最终 MP。' },
  producerId: { label: '制片人', required: false, hint: '降低制作成本、提升剧本供给质量。' },
  technicianId: { label: '技术/特效', required: false, coreSkill: 'vfx', hint: 'VFX 技能决定可用的特效等级上限。' },
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

interface PickerState {
  key: SlotKey | 'actor'
  index?: number
}

export function TeamBuildScreen({
  initialScriptId,
  onGoToProject,
}: {
  initialScriptId?: string | null
  onGoToProject: (id: string) => void
}) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
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
  const [vfx, setVfx] = useState(20)
  const [hasAd, setHasAd] = useState(false)
  const [ipId, setIpId] = useState('')
  const [msg, setMsg] = useState('')
  const [picker, setPicker] = useState<PickerState | null>(null)
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
  const budget = script
    ? script.scale * ECONOMY.costPerStage * (1 + (vfx / 100) * ECONOMY.vfxCostFactor)
    : 0

  // 续作立项（GDD §3.8）：IP 须与剧本同类型
  const selectedIp = state.company.ips.find((x) => x.id === ipId)
  const ipTypeMismatch = selectedIp ? selectedIp.type !== script?.type : false
  const sequelHype = selectedIp
    ? Math.min(100, Math.round(IP_CONFIG.sequelHypeBase + selectedIp.level * IP_CONFIG.sequelHypePerLevel))
    : 0

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

  const openPicker = (key: SlotKey | 'actor', index?: number) => setPicker({ key, index })
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
      vfxPercent: vfx,
      hasAd,
      ipId: selectedIp?.id,
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
    setSlots({ directorId: '', actorIds: [''], shooterId: '', editorId: '', marketId: '', producerId: '', technicianId: '' })
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

  return (
    <div className="screen">
      <section className="panel">
        <h2>选择剧本</h2>
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
            </PosterCard>
          ))}
          {owned.length === 0 && <p className="dim">剧本库为空。</p>}
        </div>
      </section>

      {script && (
        <section className="panel">
          <h2>组建剧组 — 《{script.title}》</h2>
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

          {state.company.ips.length > 0 && (
            <div className="config-row">
              <label className="config-label">续作立项（IP 系列化）</label>
              <select value={ipId} onChange={(e) => setIpId(e.target.value)}>
                <option value="">— 新 IP（原创作品）—</option>
                {state.company.ips.map((ip) => (
                  <option key={ip.id} value={ip.id}>
                    {ip.name} · 第 {ip.entry} 部 · Lv.{ip.level}（票房 +{Math.round((ip.sequelBonus - 1) * 100)}%）
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedIp && (
            <p className="dim">
              续作《{selectedIp.name}》第 {selectedIp.entry + 1} 部
              <b style={{ color: 'var(--gold)' }}> · 初始热度 {sequelHype}</b> · 票房加成 +{Math.round((selectedIp.sequelBonus - 1) * 100)}% · 发行商预付款加成 +{Math.round(selectedIp.level * IP_CONFIG.publisherPrepayPerLevel * 100)}%
              {ipTypeMismatch && (
                <span className="warn">（本片为 {TYPE_ZH[script?.type ?? 'drama']}，续作须为 {TYPE_ZH[selectedIp.type]}）</span>
              )}
            </p>
          )}

          <div className="config-row">
            <label className="config-label">VFX 预算占比</label>
            <input type="range" min={0} max={100} step={5} value={vfx} onChange={(e) => setVfx(Number(e.target.value))} />
            <span className="config-value">{vfx}%</span>
          </div>
          {script && (
            <p className="dim">
              当前特效等级：<b>{vfxTier(techSkill).label}</b>（VFX 分上限 {vfxTier(techSkill).max}）
              · {TYPE_ZH[script.type]}类型特效 ×{vfxTypeFactor(script.type)}
              {techSkill >= 50 ? '' : '（配置技术/特效可升级特效等级）'}
            </p>
          )}
          <div className="config-row">
            <label className="config-label">
              <input type="checkbox" checked={hasAd} onChange={(e) => setHasAd(e.target.checked)} />
              植入广告（+{fmtWan(ECONOMY.adDealIncome)}，AP −{ECONOMY.adDealApPenalty}）
            </label>
          </div>

          <div className="budget-line">
            预算约 <MoneyText value={budget} />（{script.scale} 场 × 单价 {fmtWan(ECONOMY.costPerStage)}）
            {hasAd && <span className="dim"> + 广告收入 {fmtWan(ECONOMY.adDealIncome)}</span>}
          </div>

          {msg && <p className="msg">{msg}</p>}
          <button className="btn-primary" onClick={start} disabled={ipTypeMismatch}>
            立项
          </button>
        </section>
      )}

      {/* 选人弹窗：候选人完整信息 */}
      {picker && (
        <Modal title={pickerTitle} wide onClose={() => setPicker(null)}>
          {pickerDef && <p className="dim">{pickerDef.hint}</p>}
          {allEmployees.length === 0 ? (
            <p className="dim">公司还没有员工，先去「招聘」页雇人吧。</p>
          ) : (
            <div className="candidate-grid">
              {allEmployees.map((w) => {
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
