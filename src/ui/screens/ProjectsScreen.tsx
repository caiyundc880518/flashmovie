import { useGameStore } from '../store/gameStore'
import { STAGE_ZH, fmtWan } from '../format'
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
        <div className="project-list">
          {projects.map((p) => {
            const script = state.scripts[p.scriptId]
            return (
              <div key={p.id} className="project-row clickable" onClick={() => onOpenProject(p.id)}>
                <PosterCard title={p.name} type={script?.type ?? 'drama'}>
                  <div>
                    阶段：<b>{STAGE_ZH[p.stage]}</b>
                  </div>
                  {p.stage === 'preparing' && <div>等待开拍</div>}
                  {p.stage === 'shooting' && <div>场次 {p.shotStages}/{p.totalStages}</div>}
                  {p.stage === 'editing' && <div>等待剪辑决策</div>}
                  {p.stage === 'marketing' && <div>Hype {Math.round(p.hype)}</div>}
                  {p.stage === 'released' && p.result && (
                    <div>
                      票房 {fmtWan(p.result.boxOffice)} · AP {p.result.ap} / MP {p.result.mp}
                    </div>
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
