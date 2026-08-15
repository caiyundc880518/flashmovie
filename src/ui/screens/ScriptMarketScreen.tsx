import { useGameStore } from '../store/gameStore'
import { ECONOMY } from '../../core/config/economy'
import { fmtWan } from '../format'
import { PosterCard } from '../components/PosterCard'
import { MoneyText } from '../components/MoneyText'

export function ScriptMarketScreen({ onBuildTeam }: { onBuildTeam: (scriptId: string) => void }) {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  if (!state) return null

  const { world, company, scripts } = state
  const owned = company.ownedScriptIds.map((id) => scripts[id]).filter(Boolean)
  const writerQueue = Object.entries(state.writerQueues)

  return (
    <div className="screen">
      <section className="panel">
        <h2>
          剧本市场 <span className="dim">（{world.marketRefreshIn} 周后刷新）</span>
        </h2>
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
      </section>

      <section className="panel">
        <h2>公司剧本库</h2>
        <div className="poster-grid">
          {owned.map((sc) => (
            <PosterCard key={sc.id} title={sc.title} type={sc.type}>
              <div className="attr-line">
                艺术 {sc.artPot} · 市场 {sc.marketPot} · 规模 {sc.scale} 场
              </div>
              <div className="attr-line">
                编剧：{sc.writerId && state.workers[sc.writerId] ? state.workers[sc.writerId].name : '外部'}
              </div>
              <div className="btn-row">
                <button className="btn-primary" onClick={() => onBuildTeam(sc.id)}>
                  用此剧本立项
                </button>
                <button onClick={() => dispatch({ type: 'sellScript', scriptId: sc.id })}>出售</button>
              </div>
            </PosterCard>
          ))}
          {owned.length === 0 && <p className="dim">剧本库为空，先买一个吧。</p>}
        </div>
      </section>

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
    </div>
  )
}
