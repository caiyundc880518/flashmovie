import type { ReactNode } from 'react'
import type { Worker } from '../../core/types'
import { ROLE_ZH } from '../format'
import { RadarChart } from './RadarChart'
import { Bar } from './Bar'
import { MoneyText } from './MoneyText'

/** 员工详情（用于弹窗内展示：属性雷达 + 精神属性 + 履历） */
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
  return (
    <div className="worker-detail">
      <div className="grid-2">
        <div className="detail-left">
          <RadarChart values={skills} labels={skillLabels} size={240} />
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
          {actions && <div className="btn-row">{actions}</div>}
        </div>
        <div className="detail-right">
          <h3>精神属性</h3>
          {mental.map(([label, v]) => (
            <Bar key={label} label={label} value={v} />
          ))}
          <h3>履历</h3>
          {worker.career.length === 0 && <p className="dim">暂无作品履历</p>}
          <ul className="career-list">
            {[...worker.career]
              .reverse()
              .slice(0, 8)
              .map((c, i) => (
                <li key={i}>
                  {c.projectName} · {ROLE_ZH[c.role]} · 个人表现 {Math.round(c.performance)}
                </li>
              ))}
          </ul>
          <h3>获奖履历</h3>
          {worker.awards.length === 0 ? (
            <p className="dim">暂无获奖记录</p>
          ) : (
            <ul className="career-list award-history-list">
              {[...worker.awards]
                .reverse()
                .slice(0, 8)
                .map((a, i) => (
                  <li key={i}>
                    🏆 「{a.award}」 · 《{a.projectName}》
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
