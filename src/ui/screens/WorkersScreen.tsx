import { useState } from 'react'
import type { Worker } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { ROLE_ZH } from '../format'
import { WorkerCard } from '../components/WorkerCard'
import { RadarChart } from '../components/RadarChart'
import { Bar } from '../components/Bar'
import { MoneyText } from '../components/MoneyText'

function WorkerDetail({ worker, onFire }: { worker: Worker; onFire?: () => void }) {
  const skills = Object.values(worker.skills)
  const skillLabels = ['演技', '导演', '摄影', '剪辑', '市场', '技术', '广告', '特效']
  const mental = [
    ['智力', worker.mental.intelligence],
    ['专注', worker.mental.focus],
    ['天赋', worker.mental.gift],
    ['敬业', worker.mental.dedication],
    ['领导', worker.mental.leader],
    ['适应', worker.mental.adaptability],
    ['全能', worker.mental.versatility],
  ] as const
  return (
    <section className="panel worker-detail">
      <h2>
        {worker.name} <span className="dim">{ROLE_ZH[worker.role]}</span>
      </h2>
      <div className="grid-2">
        <div className="detail-left">
          <RadarChart values={skills} labels={skillLabels} />
          <div className="attr-line">
            性别 {worker.gender === 'male' ? '男' : '女'} · {worker.age}岁 · 周薪
            <MoneyText value={worker.salary} />
          </div>
          <div className="attr-line">
            PA {worker.basic.pa} · CA {worker.basic.ca} · Fame {Math.round(worker.basic.fame)} · Hype{' '}
            {Math.round(worker.basic.hype)}
          </div>
          <div className="attr-line">
            心情 {Math.round(worker.active.mood)} · 精力 {Math.round(worker.active.volume)} · 空闲{' '}
            {worker.idleWeeks} 周
          </div>
          {onFire && (
            <button className="btn-danger" onClick={onFire}>
              解雇
            </button>
          )}
        </div>
        <div className="detail-right">
          <h3>精神属性</h3>
          {mental.map(([label, v]) => (
            <Bar key={label} label={label} value={v} />
          ))}
          <h3>履历</h3>
          {worker.career.length === 0 && <p className="dim">暂无作品履历</p>}
          <ul className="career-list">
            {[...worker.career].reverse().slice(0, 8).map((c, i) => (
              <li key={i}>
                {c.projectName} · {ROLE_ZH[c.role]} · 个人表现 {Math.round(c.performance)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function WorkersScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!state) return null
  const employees = state.company.employeeIds.map((id) => state.workers[id]).filter(Boolean)
  const candidates = state.world.candidates
  const selected =
    (selectedId ? state.workers[selectedId] : undefined) ??
    candidates.find((c) => c.id === selectedId) ??
    null

  return (
    <div className="screen">
      <div className="grid-2">
        <section className="panel">
          <h2>在职员工（{employees.length}）</h2>
          <div className="worker-grid">
            {employees.map((w) => (
              <WorkerCard
                key={w.id}
                worker={w}
                onClick={() => setSelectedId(w.id)}
                footer={
                  <button
                    className="btn-danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'fireWorker', workerId: w.id })
                    }}
                  >
                    解雇
                  </button>
                }
              />
            ))}
            {employees.length === 0 && <p className="dim">还没有员工，去「招聘市场」看看吧。</p>}
          </div>
        </section>
        <section className="panel">
          <h2>招聘市场</h2>
          <div className="worker-grid">
            {candidates.map((c) => (
              <WorkerCard
                key={c.id}
                worker={c}
                onClick={() => setSelectedId(c.id)}
                footer={
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'hireWorker', candidateId: c.id })
                    }}
                  >
                    雇佣
                  </button>
                }
              />
            ))}
          </div>
        </section>
      </div>
      {selected && (
        <WorkerDetail
          worker={selected}
          onFire={
            state.company.employeeIds.includes(selected.id)
              ? () => dispatch({ type: 'fireWorker', workerId: selected.id })
              : undefined
          }
        />
      )}
    </div>
  )
}
