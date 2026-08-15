import { useState } from 'react'
import type { Worker } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { ROLE_ZH } from '../format'
import { DataTable, type Column } from '../components/DataTable'
import { WorkerDetail } from '../components/WorkerDetail'
import { MoneyText } from '../components/MoneyText'

function moodColor(mood: number): string {
  if (mood >= 70) return 'var(--ok)'
  if (mood >= 45) return 'var(--gold)'
  return 'var(--danger)'
}

export function EmployeesScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!state) return null
  const employees = state.company.employeeIds.map((id) => state.workers[id]).filter(Boolean)
  const selected = selectedId ? state.workers[selectedId] : null

  const columns: Column<Worker>[] = [
    { key: 'name', label: '姓名', render: (w) => <span className="table-name">{w.name}</span> },
    { key: 'role', label: '职位', render: (w) => ROLE_ZH[w.role] },
    { key: 'gender', label: '性别', render: (w) => (w.gender === 'male' ? '男' : '女') },
    { key: 'age', label: '年龄', render: (w) => w.age },
    { key: 'pa', label: 'PA', render: (w) => w.basic.pa },
    { key: 'ca', label: 'CA', render: (w) => <span className="ca-cell">{w.basic.ca}</span> },
    { key: 'fame', label: 'Fame', render: (w) => Math.round(w.basic.fame) },
    { key: 'mood', label: '心情', render: (w) => <span style={{ color: moodColor(w.active.mood) }}>{Math.round(w.active.mood)}</span> },
    { key: 'salary', label: '周薪', render: (w) => <MoneyText value={w.salary} /> },
    {
      key: 'status',
      label: '状态',
      render: (w) => (w.currentProjectId ? <span className="good">项目中</span> : `空闲 ${w.idleWeeks}周`),
    },
    {
      key: 'act',
      label: '',
      className: 'td-act',
      render: (w) => (
        <button
          className="btn-danger"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'fireWorker', workerId: w.id })
          }}
        >
          解雇
        </button>
      ),
    },
  ]

  return (
    <div className="screen">
      <section className="panel">
        <h2>在职员工（{employees.length}）</h2>
        <DataTable
          columns={columns}
          rows={employees}
          rowKey={(w) => w.id}
          onRowClick={(w) => setSelectedId(w.id)}
          emptyText="还没有员工，去「招聘」页看看吧。"
        />
      </section>
      {selected && (
        <WorkerDetail
          worker={selected}
          actions={
            <button className="btn-danger" onClick={() => dispatch({ type: 'fireWorker', workerId: selected.id })}>
              解雇
            </button>
          }
        />
      )}
    </div>
  )
}
