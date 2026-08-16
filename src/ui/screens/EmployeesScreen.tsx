import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { ROLE_ZH, moodColor } from '../format'
import { WorkerDetail } from '../components/WorkerDetail'
import { Modal } from '../components/Modal'
import { MoneyText } from '../components/MoneyText'

export function EmployeesScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!state) return null
  const employees = state.company.employeeIds.map((id) => state.workers[id]).filter(Boolean)
  const selected = selectedId ? state.workers[selectedId] : null

  return (
    <div className="screen">
      <section className="panel">
        <h2>在职员工（{employees.length}）</h2>
        <p className="dim">
          点击卡片查看详情（属性 / 履历 / 奖项）；员工每周消耗薪水，项目内工作会消耗心情与精力。
        </p>
        {employees.length === 0 ? (
          <p className="dim empty-hint">还没有员工，去「招聘」页看看吧。</p>
        ) : (
          <div className="worker-grid">
            {employees.map((w) => (
              <div
                key={w.id}
                className="worker-card clickable"
                onClick={() => setSelectedId(w.id)}
              >
                <div className="worker-head">
                  <div className="avatar">{w.name[0]}</div>
                  <div>
                    <div className="worker-name">{w.name}</div>
                    <div className="worker-role">{ROLE_ZH[w.role]}</div>
                  </div>
                </div>
                <div>
                  {w.currentProjectId ? (
                    <span className="tag tag-gold">🎬 项目中</span>
                  ) : (
                    <span className="tag tag-idle">空闲 {w.idleWeeks} 周</span>
                  )}
                </div>
                <div className="worker-stats">
                  <div className="worker-stat">
                    <b>{w.basic.pa}</b>
                    <span>PA 潜力</span>
                  </div>
                  <div className="worker-stat">
                    <b className="gold">{w.basic.ca}</b>
                    <span>CA 咖位</span>
                  </div>
                </div>
                <div className="worker-sub">
                  Fame {Math.round(w.basic.fame)} · 心情{' '}
                  <span style={{ color: moodColor(w.active.mood) }}>{Math.round(w.active.mood)}</span>{' '}
                  · {w.gender === 'male' ? '男' : '女'} {w.age}岁
                </div>
                <div className="worker-footer">
                  <span className="dim">
                    周薪 <MoneyText value={w.salary} />
                  </span>
                  <button
                    className="btn-danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'fireWorker', workerId: w.id })
                    }}
                  >
                    解雇
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {selected && (
        <Modal
          title={
            <>
              {selected.name} <span className="dim">{ROLE_ZH[selected.role]}</span>
            </>
          }
          wide
          onClose={() => setSelectedId(null)}
        >
          <WorkerDetail
            worker={selected}
            actions={
              <button
                className="btn-danger"
                onClick={() => {
                  dispatch({ type: 'fireWorker', workerId: selected.id })
                  setSelectedId(null)
                }}
              >
                解雇
              </button>
            }
          />
        </Modal>
      )}
    </div>
  )
}
