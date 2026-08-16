import { useGameStore } from '../store/gameStore'
import { ECONOMY } from '../../core/config/economy'
import { SCHOOL_CONFIG } from '../../core/config/company'
import { fmtWan } from '../format'
import { PosterCard } from '../components/PosterCard'
import { MoneyText } from '../components/MoneyText'
import { Tabs } from '../components/Tabs'

export function ScriptMarketScreen({ onBuildTeam }: { onBuildTeam: (scriptId: string) => void }) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  if (!state) return null

  const { world, company, scripts } = state
  const usedScriptIds = new Set(state.projects.map((p) => p.scriptId))
  const owned = company.ownedScriptIds.map((id) => scripts[id]).filter(Boolean)
  const writerQueue = Object.entries(state.writerQueues)
  const schoolMax = company.public ? SCHOOL_CONFIG.maxLevelPublic : SCHOOL_CONFIG.maxLevel

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
      <p className="dim">自购/编剧产出的剧本都在这里；已拍摄的剧本不可复用。</p>
      <div className="poster-grid">
        {owned.map((sc) => {
          const used = usedScriptIds.has(sc.id)
          return (
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
              {used ? (
                <span className="tag tag-pro">已拍摄 · 不可复用</span>
              ) : (
                <div className="btn-row">
                  <button className="btn-primary" onClick={() => onBuildTeam(sc.id)}>
                    用此剧本立项
                  </button>
                  <button onClick={() => dispatch({ type: 'sellScript', scriptId: sc.id })}>
                    出售
                  </button>
                </div>
              )}
            </PosterCard>
          )
        })}
        {owned.length === 0 && <p className="dim empty-hint">剧本库为空，先买一个吧。</p>}
      </div>
    </>
  )

  return (
    <div className="screen">
      <section className="panel">
        <h2>剧本市场</h2>
        <Tabs
          tabs={[
            { key: 'market', label: `在售剧本（${world.marketScripts.length}）`, content: marketTab },
            { key: 'library', label: `公司剧本库（${owned.length}）`, content: libraryTab },
          ]}
        />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>签约编剧</h2>
          <p className="dim">签约一名编剧（签约费 {fmtWan(ECONOMY.hireWriterSignFee)}），每 3–6 周产出一部剧本。</p>
          <button onClick={() => dispatch({ type: 'hireWriter' })}>签约一名编剧</button>
          {writerQueue.map(([id, weeks]) => {
            const w = state.workers[id]
            return (
              <div key={id} className="writer-row">
                {w?.name ?? '编剧'} 创作中… {weeks} 周后完成
              </div>
            )
          })}
          {writerQueue.length === 0 && <p className="dim">目前没有在创作的编剧。</p>}
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
            签约编剧产出质量 +{Math.round(SCHOOL_CONFIG.writerQualityPerLevel * company.schoolLevel * 100)}%，
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
      </div>
    </div>
  )
}
