import { useGameStore } from '../store/gameStore'
import { STAGE_ZH, fmtScore10, fmtWan, scoreColor10 } from '../format'
import { PosterCard } from '../components/PosterCard'

export function ProjectsScreen({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const projects = state.projects

  return (
    <div className="screen">
      <section className="panel">
        <h2>电影项目（{projects.length}）</h2>
        {projects.length === 0 && (
          <p className="dim">
            还没有项目。去「剧本市场」买一个剧本，再到「组队立项」组建剧组，就能开拍你的第一部电影了。
          </p>
        )}
        <div className="proj-grid">
          {projects.map((p) => {
            const script = state.scripts[p.scriptId]
            // 系列电影标识：项目属于某个 IP（或旧档结果记录系列名）
            const isSeries = !!p.ipId || !!p.result?.ipName
            const awards = p.result?.awardCount ?? 0
            return (
              <div key={p.id} className="proj-card clickable" onClick={() => onOpenProject(p.id)}>
                <PosterCard
                  title={p.name}
                  type={script?.type ?? 'drama'}
                  corner={<span className="stage-badge">{STAGE_ZH[p.stage]}</span>}
                  typeInFooter
                  titleBadge={isSeries ? <span className="ip-badge">IP</span> : undefined}
                >
                  {p.stage === 'preparing' && <div>等待开拍</div>}
                  {p.stage === 'shooting' && <div>场次 {p.shotStages}/{p.totalStages}</div>}
                  {p.stage === 'editing' && <div>等待剪辑决策</div>}
                  {p.stage === 'marketing' && <div>Hype {Math.round(p.hype)}</div>}
                  {p.stage === 'released' && p.result && (
                    <>
                      <div className="attr-line">
                        票房 <b>{fmtWan(p.result.boxOffice)}</b>
                      </div>
                      <div className="attr-line">
                        影评{' '}
                        <b style={{ color: scoreColor10(p.result.criticScore) }}>
                          {fmtScore10(p.result.criticScore)}
                        </b>{' '}
                        · 观众{' '}
                        <b style={{ color: scoreColor10(p.result.audienceScore ?? 0) }}>
                          {fmtScore10(p.result.audienceScore ?? 0)}
                        </b>
                      </div>
                      {awards > 0 && (
                        <div className="attr-line award-line">
                          🏆 ×{awards}
                        </div>
                      )}
                    </>
                  )}
                  {p.stage !== 'released' && (
                    <div className="btn-row">
                      <button
                        className="btn-primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenProject(p.id)
                        }}
                      >
                        {p.stage === 'preparing' ? '去开拍' : '查看详情'}
                      </button>
                    </div>
                  )}
                </PosterCard>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
