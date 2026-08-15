import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { ECONOMY } from '../../core/config/economy'
import { TYPE_ZH, fmtWan } from '../format'
import { PosterCard } from '../components/PosterCard'
import { MoneyText } from '../components/MoneyText'
import { Modal } from '../components/Modal'

interface Slots {
  directorId: string
  actorIds: string[]
  shooterId: string
  editorId: string
  marketId: string
  producerId: string
}

const SLOT_LABEL: Record<keyof Slots, string> = {
  directorId: '导演',
  actorIds: '演员',
  shooterId: '摄影',
  editorId: '剪辑',
  marketId: '市场',
  producerId: '制片人（可选）',
}

function RoleSelect({
  label,
  value,
  employees,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  employees: Array<{ id: string; name: string }>
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="slot-row">
      <span className="slot-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? '— 选择 —'}</option>
        {employees.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  )
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
  })
  const [vfx, setVfx] = useState(20)
  const [hasAd, setHasAd] = useState(false)
  const [msg, setMsg] = useState('')
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)

  if (!state) return null

  // 已用于立项的剧本不可再筹拍
  const usedScriptIds = new Set(state.projects.map((p) => p.scriptId))
  const owned = state.company.ownedScriptIds
    .map((id) => state.scripts[id])
    .filter((sc) => sc && !usedScriptIds.has(sc.id))
  const busyIds = new Set(state.projects.filter((p) => p.stage !== 'released').flatMap((p) => Object.values(p.team).flat()))
  const available = state.company.employeeIds
    .map((id) => state.workers[id])
    .filter((w) => w && !busyIds.has(w.id))

  const script = state.scripts[scriptId]
  const budget = script
    ? script.scale * ECONOMY.costPerStage * (1 + (vfx / 100) * ECONOMY.vfxCostFactor)
    : 0

  const setSlot = (key: keyof Slots, value: string) => setSlots((s) => ({ ...s, [key]: value }))
  const setActor = (idx: number, value: string) =>
    setSlots((s) => {
      const actorIds = [...s.actorIds]
      actorIds[idx] = value
      return { ...s, actorIds }
    })

  const start = () => {
    if (!script) return setMsg('请先选择剧本')
    const actors = slots.actorIds.filter(Boolean)
    if (!slots.directorId || actors.length === 0 || !slots.shooterId || !slots.editorId || !slots.marketId) {
      return setMsg('导演 / 至少一名演员 / 摄影 / 剪辑 / 市场 为必配职位')
    }
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
      },
      vfxPercent: vfx,
      hasAd,
    })
    // 从最新状态找到刚创建的项目，弹窗引导前往项目页
    const latest = useGameStore.getState().state
    const createdProject = latest?.projects.find((x) => x.scriptId === scriptId)
    if (createdProject) {
      setCreated({ id: createdProject.id, name: createdProject.name })
    }
    setMsg('')
    setScriptId('')
    setSlots({ directorId: '', actorIds: [''], shooterId: '', editorId: '', marketId: '', producerId: '' })
  }

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
          <div className="slot-list">
            <RoleSelect label={SLOT_LABEL.directorId} value={slots.directorId} employees={available} onChange={(v) => setSlot('directorId', v)} />
            {slots.actorIds.map((aid, idx) => (
              <div key={idx} className="slot-row">
                <span className="slot-label">演员 {idx + 1}</span>
                <select value={aid} onChange={(e) => setActor(idx, e.target.value)}>
                  <option value="">— 选择 —</option>
                  {available.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {idx === slots.actorIds.length - 1 && slots.actorIds.length < 3 && (
                  <button onClick={() => setSlots((s) => ({ ...s, actorIds: [...s.actorIds, ''] }))}>
                    ＋
                  </button>
                )}
              </div>
            ))}
            <RoleSelect label={SLOT_LABEL.shooterId} value={slots.shooterId} employees={available} onChange={(v) => setSlot('shooterId', v)} />
            <RoleSelect label={SLOT_LABEL.editorId} value={slots.editorId} employees={available} onChange={(v) => setSlot('editorId', v)} />
            <RoleSelect label={SLOT_LABEL.marketId} value={slots.marketId} employees={available} onChange={(v) => setSlot('marketId', v)} />
            <RoleSelect label={SLOT_LABEL.producerId} value={slots.producerId} employees={available} onChange={(v) => setSlot('producerId', v)} />
          </div>

          <div className="config-row">
            <label className="config-label">VFX 预算占比</label>
            <input type="range" min={0} max={100} step={5} value={vfx} onChange={(e) => setVfx(Number(e.target.value))} />
            <span className="config-value">{vfx}%</span>
          </div>
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
          <button className="btn-primary" onClick={start}>
            立项
          </button>
        </section>
      )}

      {created && (
        <Modal title="🎬 立项成功" onClose={() => setCreated(null)}>
          <p>
            《{created.name}》剧组已组建完成，等待开拍。
          </p>
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
