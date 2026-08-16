import { useGameStore } from '../store/gameStore'
import { TECH_CONFIG, TECH_LINES } from '../../core/config/tech'
import { techLevelOf, techProgressInLevel } from '../../core/rules/tech'

/** 科技研发页（VFX Tech，GDD §5） */
export function TechScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)

  if (!state) return null

  return (
    <div className="screen">
      <section className="panel">
        <h2>科技研发 · VFX Tech</h2>
        <p className="dim">
          投入资金推进研发；技术/特效员工的 VFX 技能越高，每次投入的进度越多。研发进度满 100 自动升级，
          加成将体现在立项预算、VFX 评分与类型特效系数上。
        </p>
        <div className="tech-list">
          {TECH_LINES.map((line) => {
            const level = techLevelOf(state, line.id)
            const progress = Math.floor(techProgressInLevel(state.company.tech, line.id))
            const done = level >= line.maxLevel
            const affordable = state.company.cash >= TECH_CONFIG.investCost
            return (
              <div key={line.id} className="tech-row">
                <div className="tech-info">
                  <div className="tech-head">
                    <span className="slot-title">
                      {line.icon} {line.name}
                    </span>
                    {done ? (
                      <span className="tag tag-gold">已满级</span>
                    ) : (
                      <span className="tag tag-required">
                        Lv.{level}/{line.maxLevel}
                      </span>
                    )}
                  </div>
                  <div className="dim">{line.desc}</div>
                  <div className="attr-line">
                    当前：<b className="good">{level > 0 ? line.effectText(level) : '未解锁'}</b>
                  </div>
                  {!done && <div className="dim">下一级：{line.effectText(level + 1)}</div>}
                </div>
                <div className="tech-progress">
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="dim">
                    {progress} / {TECH_CONFIG.progressPerLevel}
                  </span>
                </div>
                <button
                  className="btn-primary"
                  disabled={!affordable || done}
                  onClick={() => dispatch({ type: 'investTech', lineId: line.id })}
                >
                  {done ? '已满级' : affordable ? `投入研发（${TECH_CONFIG.investCost} 万）` : '现金不足'}
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
