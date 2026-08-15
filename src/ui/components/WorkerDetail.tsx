import type { ReactNode } from 'react'
import type { Worker } from '../../core/types'
import { ROLE_ZH } from '../format'
import { RadarChart } from './RadarChart'
import { Bar } from './Bar'
import { MoneyText } from './MoneyText'
import { Tabs } from './Tabs'

/** 员工详情（弹窗内）：属性 / 履历 / 奖项 三个页签，操作按钮常驻底部 */
export function WorkerDetail({ worker, actions }: { worker: Worker; actions?: ReactNode }) {
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
  const physical = [
    ['体能', worker.physical.strong],
    ['敏捷', worker.physical.agility],
    ['主动', worker.physical.initiative],
    ['体质', worker.physical.disease],
    ['魅力', worker.physical.charisma],
    ['性感', worker.physical.sexy],
  ] as const

  const careerTab = (
    <div className="detail-list">
      <h3>作品履历</h3>
      {worker.career.length === 0 ? (
        <p className="dim">暂无作品履历</p>
      ) : (
        <ul className="career-list">
          {[...worker.career]
            .reverse()
            .slice(0, 12)
            .map((c, i) => (
              <li key={i}>
                {c.projectName} · {ROLE_ZH[c.role]} · 个人表现 {Math.round(c.performance)}
              </li>
            ))}
        </ul>
      )}
    </div>
  )

  const awardsTab = (
    <div className="detail-list">
      <h3>获奖记录</h3>
      {worker.awards.length === 0 ? (
        <p className="dim">暂无获奖记录——冲一部高 AP 的艺术片，年底 TMA 见。</p>
      ) : (
        <ul className="career-list">
          {[...worker.awards]
            .reverse()
            .slice(0, 12)
            .map((a, i) => (
              <li key={i}>
                🏆 「{a.award}」 · 《{a.projectName}》
              </li>
            ))}
        </ul>
      )}
    </div>
  )

  const attrTab = (
    <div className="grid-2 worker-attr-tab">
      <div className="detail-left">
        <RadarChart values={skills} labels={skillLabels} size={220} />
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
      </div>
      <div className="detail-right">
        <h3>精神属性</h3>
        {mental.map(([label, v]) => (
          <Bar key={label} label={label} value={v} />
        ))}
        <h3>身体属性</h3>
        {physical.map(([label, v]) => (
          <Bar key={label} label={label} value={v} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="worker-detail">
      <Tabs
        tabs={[
          { key: 'attr', label: '属性', content: attrTab },
          { key: 'career', label: '履历', content: careerTab },
          { key: 'awards', label: '奖项', content: awardsTab },
        ]}
      />
      {actions && <div className="btn-row worker-detail-actions">{actions}</div>}
    </div>
  )
}
