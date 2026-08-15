import { useState } from 'react'
import type { Worker } from '../../core/types'
import { useGameStore } from '../store/gameStore'
import { ROLE_ZH } from '../format'
import { DataTable, type Column } from '../components/DataTable'
import { WorkerDetail } from '../components/WorkerDetail'
import { Modal } from '../components/Modal'
import { MoneyText } from '../components/MoneyText'

export function RecruitScreen() {
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!state) return null
  const candidates = state.world.candidates
  const selected = selectedId ? candidates.find((c) => c.id === selectedId) : null

  const columns: Column<Worker>[] = [
    { key: 'name', label: '姓名', render: (w) => <span className="table-name">{w.name}</span> },
    { key: 'role', label: '职位', render: (w) => ROLE_ZH[w.role] },
    {
      key: 'tier',
      label: '类型',
      render: (w) =>
        w.basic.ca < 50 ? (
          <span className="tag tag-rookie">潜力新人</span>
        ) : (
          <span className="tag tag-pro">经验丰富</span>
        ),
    },
    { key: 'gender', label: '性别', render: (w) => (w.gender === 'male' ? '男' : '女') },
    { key: 'age', label: '年龄', render: (w) => w.age },
    { key: 'pa', label: 'PA', render: (w) => w.basic.pa },
    { key: 'ca', label: 'CA', render: (w) => <span className="ca-cell">{w.basic.ca}</span> },
    { key: 'fame', label: 'Fame', render: (w) => Math.round(w.basic.fame) },
    { key: 'salary', label: '周薪', render: (w) => <MoneyText value={w.salary} /> },
    {
      key: 'act',
      label: '',
      className: 'td-act',
      render: (w) => (
        <button
          className="btn-primary"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'hireWorker', candidateId: w.id })
          }}
        >
          雇佣
        </button>
      ),
    },
  ]

  return (
    <div className="screen">
      <section className="panel">
        <h2>招聘市场（{candidates.length}）</h2>
        <p className="dim">
          点击行查看详情；雇佣需支付签约费，之后按周支付薪水。潜力新人便宜但成长空间大。
        </p>
        <DataTable
          columns={columns}
          rows={candidates}
          rowKey={(w) => w.id}
          onRowClick={(w) => setSelectedId(w.id)}
          emptyText="暂无候选人，等待市场刷新。"
        />
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
                className="btn-primary"
                onClick={() => {
                  dispatch({ type: 'hireWorker', candidateId: selected.id })
                  setSelectedId(null)
                }}
              >
                雇佣
              </button>
            }
          />
        </Modal>
      )}
    </div>
  )
}
