import { useState } from 'react'
import type { ScriptDraft } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { SCHOOL_CONFIG } from '../../core/config/company'
import { WRITER_POOLS, WRITER_POOL_MAP, TEN_PULL_DISCOUNT, type WriterPoolConfig } from '../../core/config/writers'
import { PosterCard } from '../components/PosterCard'
import { MoneyText } from '../components/MoneyText'
import { Modal } from '../components/Modal'
import { Tabs } from '../components/Tabs'

interface DraftGacha {
  pool: WriterPoolConfig
  drawn: ScriptDraft[]
  flipped: boolean[]
}

export function ScriptMarketScreen({ onBuildTeam }: { onBuildTeam: (scriptId: string) => void }) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [draftGacha, setDraftGacha] = useState<DraftGacha | null>(null)
  if (!state) return null

  const { world, company, scripts } = state
  const usedScriptIds = new Set(state.projects.map((p) => p.scriptId))
  const owned = company.ownedScriptIds.map((id) => scripts[id]).filter(Boolean)
  // 消耗品：已立项的剧本从剧本库移除（不可复用）
  const availableOwned = owned.filter((sc) => !usedScriptIds.has(sc.id))
  const drafts = state.scriptDrafts
  const schoolMax = company.public ? SCHOOL_CONFIG.maxLevelPublic : SCHOOL_CONFIG.maxLevel

  /** 委托创作抽卡：1 抽 / 10 连（9 折），结果进弹窗翻卡 */
  const draw = (pool: WriterPoolConfig, count: 1 | 10) => {
    const total = Math.round(pool.price * count * (count === 10 ? TEN_PULL_DISCOUNT : 1))
    if (state.company.cash < total) return
    dispatch({ type: 'drawScripts', pool: pool.id, count })
    const latest = useGameStore.getState().state
    const drawn = latest?.scriptDrafts.slice(-count) ?? []
    setDraftGacha({ pool, drawn, flipped: drawn.map(() => false) })
  }

  const flipDraft = (idx: number) =>
    setDraftGacha((g) => (g ? { ...g, flipped: g.flipped.map((v, j) => (j === idx ? true : v)) } : g))

  const marketTab = (
    <>
      <p className="dim">市场剧本每 {world.marketRefreshIn} 周刷新一次，购买后进入公司剧本库。</p>
      <div className="poster-grid">
        {world.marketScripts.map((sc) => (
          <PosterCard key={sc.id} title={sc.title} type={sc.type}>
            <div className="attr-line">
              难度 {sc.storyPoint} · 艺术 {sc.artPot} · 市场 {sc.marketPot}
            </div>
            <div className="attr-line">
              规模 {sc.scale} 场 · 潮流契合 {Math.round(sc.trend * 100)}%
            </div>
            <div className="attr-line">
              演员：{sc.requirement.genders.map((g) => (g === 'male' ? '男' : '女')).join('/')}{' '}
              {sc.requirement.minAge}–{sc.requirement.maxAge ?? '∞'}岁 · 经验≥
              {sc.requirement.minExperience}
            </div>
            <button
              disabled={company.cash < sc.price}
              onClick={() => dispatch({ type: 'buyScript', scriptId: sc.id })}
            >
              购买 <MoneyText value={sc.price} />
            </button>
          </PosterCard>
        ))}
      </div>
    </>
  )

  const libraryTab = (
    <>
      <p className="dim">剧本是消耗品：立项后即从剧本库移除，不可重复拍摄。</p>
      <div className="poster-grid">
        {availableOwned.map((sc) => (
          <PosterCard key={sc.id} title={sc.title} type={sc.type}>
            <div className="attr-line">
              艺术 {sc.artPot} · 市场 {sc.marketPot} · 规模 {sc.scale} 场
            </div>
            <div className="attr-line">
              编剧：
              {sc.writerId && state.workers[sc.writerId]
                ? state.workers[sc.writerId].name
                : '外部'}
            </div>
            <div className="btn-row">
              <button className="btn-primary" onClick={() => onBuildTeam(sc.id)}>
                用此剧本立项
              </button>
              <button onClick={() => dispatch({ type: 'sellScript', scriptId: sc.id })}>
                出售
              </button>
            </div>
          </PosterCard>
        ))}
        {availableOwned.length === 0 && (
          <p className="dim empty-hint">剧本库为空——去「在售剧本」购买，或签约编剧持续产出吧。</p>
        )}
      </div>
    </>
  )

  return (
    <div className="screen">
      <section className="panel">
        <h2>剧本市场</h2>
        <Tabs
          tabs={[
            { key: 'library', label: `公司剧本库（${availableOwned.length}）`, content: libraryTab },
            { key: 'market', label: `在售剧本（${world.marketScripts.length}）`, content: marketTab },
          ]}
        />
      </section>

      <section className="panel">
        <h2>签约编剧 · 委托创作（{drafts.length} 创作中）</h2>
        <p className="dim">
          三档编剧卡池：花单本价格委托创作，抽 1 本或 10 连（9 折）。剧本到货后进公司剧本库；写作学校加成产出质量。
        </p>
        <div className="gacha-options">
          {WRITER_POOLS.map((pool) => {
            const p1 = pool.price
            const p10 = Math.round(pool.price * 10 * TEN_PULL_DISCOUNT)
            const can1 = company.cash >= p1
            const can10 = company.cash >= p10
            return (
              <div key={pool.id} className={`gacha-option gacha-theme-${pool.id}`}>
                <div className="gacha-option-head">
                  <span className="slot-title">{pool.label}</span>
                  <span className="tag tag-required">{pool.price} 万/本</span>
                </div>
                <p className="dim">{pool.desc}</p>
                <div className="attr-line">
                  到货 {pool.produceWeeks[0]}–{pool.produceWeeks[1]} 周
                </div>
                <div className="btn-row">
                  <button className="btn-primary" disabled={!can1} onClick={() => draw(pool, 1)}>
                    抽 1 本（{p1} 万）
                  </button>
                  <button disabled={!can10} onClick={() => draw(pool, 10)}>
                    10 连抽（{p10} 万 · 9 折）
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <h3 style={{ marginTop: 16 }}>创作中</h3>
        {drafts.length === 0 ? (
          <p className="dim">暂无创作中的委托——抽一本吧。</p>
        ) : (
          <div className="draft-list">
            {drafts.map((d) => (
              <div key={d.id} className="writer-row">
                <span className="tag tag-gold">{WRITER_POOL_MAP[d.tier].label}</span>{' '}
                <span className="dim">约 {d.weeksLeft} 周后到货</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>写作学校</h2>
        <div className="stat-row">
          <span className="stat-label">等级</span>
          <span>
            {company.schoolLevel} / {schoolMax}
          </span>
        </div>
        <p className="dim">
          委托剧本产出质量 +{Math.round(SCHOOL_CONFIG.writerQualityPerLevel * company.schoolLevel * 100)}%，
          精品剧本概率 +{Math.round(SCHOOL_CONFIG.boutiqueChancePerLevel * company.schoolLevel * 100)}%。
        </p>
        {company.schoolLevel < schoolMax ? (
          <button
            disabled={company.cash < SCHOOL_CONFIG.upgradeCost[company.schoolLevel + 1]}
            onClick={() => dispatch({ type: 'upgradeSchool' })}
          >
            升级到 {company.schoolLevel + 1} 级（
            <MoneyText value={SCHOOL_CONFIG.upgradeCost[company.schoolLevel + 1]} />）
          </button>
        ) : (
          <p className="dim">学校已满级{company.public ? '。' : '（上市后可扩建至 5 级）。'}</p>
        )}
      </section>

      {/* 委托抽卡弹窗：卡背 → 逐张翻开 */}
      {draftGacha && (
        <Modal title={`✍️ ${draftGacha.pool.label} · 委托成功`} wide onClose={() => setDraftGacha(null)}>
          <p className="dim">点击卡片逐张翻开——剧本将在数周后完成并入库公司剧本库。</p>
          <div className="gacha-grid">
            {draftGacha.drawn.map((d, i) => {
              const isFlipped = draftGacha.flipped[i]
              return (
                <div
                  key={d.id}
                  className={`gacha-card gacha-theme-${draftGacha.pool.id}${isFlipped ? ' gacha-flipped' : ''}`}
                  onClick={() => flipDraft(i)}
                >
                  <div className="gacha-card-inner">
                    <div className="gacha-face gacha-back">
                      <span className="gacha-star">✍️</span>
                      <span>{draftGacha.pool.label}</span>
                      <span className="dim">点击翻开</span>
                    </div>
                    <div className="gacha-face gacha-front">
                      <span className="table-name">{draftGacha.pool.label}</span>
                      <span className="dim">委托创作中</span>
                      <span className="ca-big">约 {d.weeksLeft} 周</span>
                      <span className="dim">到货后自动入库公司剧本库</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <button
              className="btn-primary"
              onClick={() =>
                setDraftGacha((g) =>
                  g ? { ...g, flipped: g.flipped.map(() => true) } : g,
                )
              }
              disabled={draftGacha.flipped.every(Boolean)}
            >
              全部翻开
            </button>
            <button onClick={() => setDraftGacha(null)}>完成</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
