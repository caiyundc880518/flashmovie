import { useGameStore } from '../store/gameStore'
import { STAGE_ZH, TYPE_ZH, fmtScore10, fmtWan, scoreColor10 } from '../format'
import { PosterCard } from '../components/PosterCard'
import { MoneyText } from '../components/MoneyText'
import type { IpAsset } from '../../core/types'

/** IP 详情页：头部系列信息 + 系列内全部影片（可点击跳转项目详情） */
export function IpDetailScreen({
  ipId,
  onBack,
  onGoToProject,
}: {
  ipId: string
  onBack: () => void
  onGoToProject: (id: string) => void
}) {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const ip: IpAsset | undefined = state.company.ips.find((x) => x.id === ipId)
  if (!ip) return null

  // 系列内影片：按上映顺序（films 已按时间追加，稳定排序）
  const films = ip.films
    .map((id) => state.projects.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => (a.ipEntry ?? 0) - (b.ipEntry ?? 0))

  return (
    <div className="screen">
      <button className="back-mini" onClick={onBack} title="返回 IP 资产">
        ← 返回
      </button>

      {/* IP 头部信息 */}
      <section className="panel">
        <div className="ip-detail-head">
          <div>
            <h2>
              {ip.name}
              <span className="tag" style={{ color: 'var(--accent)', marginLeft: 10 }}>
                {TYPE_ZH[ip.type]}
              </span>
              <span className="tag tag-gold" style={{ marginLeft: 8 }}>
                Lv.{ip.level}
              </span>
            </h2>
            <p className="dim">
              系列第 {ip.entry} 部 · 诞生于 {ip.originYear} 年第 {ip.originWeek} 周 · 共 {films.length} 部影片
            </p>
          </div>
          <span className="ip-bonus">续作票房 +{Math.round((ip.sequelBonus - 1) * 100)}%</span>
        </div>
        <div className="ip-stats">
          <div className="ip-stat">
            <b>{fmtWan(ip.totalBoxOffice)}</b>
            <span>累计票房</span>
          </div>
          <div className="ip-stat">
            <b>{fmtWan(ip.bestBoxOffice)}</b>
            <span>最高单部</span>
          </div>
          <div className="ip-stat">
            <b style={{ color: scoreColor10(ip.bestCriticScore) }}>{fmtScore10(ip.bestCriticScore)}</b>
            <span>最佳口碑</span>
          </div>
        </div>
        <div className="ip-card-royalty">
          <div>
            <span className="dim">季度授权</span>
            <b>
              {fmtWan(ip.royaltyPerQuarter)}/季
              {ip.merchBonus > 0 && <span className="ok"> 周边+{ip.merchBonus}%</span>}
            </b>
          </div>
          <div>
            <span className="dim">授权累计</span>
            <b>{fmtWan(ip.royaltyEarned)}</b>
          </div>
        </div>
      </section>

      {/* 系列影片列表 */}
      <section className="panel">
        <h2>系列影片（{films.length}）</h2>
        <p className="dim">点击影片可查看项目详情（含拍摄、宣发、上映结算与成员成长）。</p>
        {films.length === 0 && <p className="dim empty-hint">该系列还没有影片记录。</p>}
        <div className="proj-grid">
          {films.map((p) => {
            const script = state.scripts[p.scriptId]
            const r = p.result
            return (
              <div key={p.id} className="proj-card clickable" onClick={() => onGoToProject(p.id)}>
                <PosterCard title={p.name} type={script?.type ?? 'drama'}>
                  <div className="attr-line">
                    <span className="tag tag-gold" style={{ marginRight: 8 }}>
                      第 {p.ipEntry ?? '?'} 部
                    </span>
                    <span>
                      阶段：<b>{STAGE_ZH[p.stage]}</b>
                    </span>
                  </div>
                  {r ? (
                    <>
                      <div className="attr-line">
                        票房 <MoneyText value={r.boxOffice} /> · AP <b className="ca-cell">{r.ap}</b> / MP{' '}
                        <b className="ca-cell">{r.mp}</b>
                      </div>
                      <div className="attr-line">
                        影评 <b style={{ color: scoreColor10(r.criticScore) }}>{fmtScore10(r.criticScore)}</b> / 观众{' '}
                        <b style={{ color: scoreColor10(r.audienceScore ?? 0) }}>
                          {fmtScore10(r.audienceScore ?? 0)}
                        </b>
                      </div>
                      {r.adIncome ? (
                        <div className="attr-line ok">植入广告到账 {fmtWan(r.adIncome)}</div>
                      ) : null}
                    </>
                  ) : (
                    <div className="attr-line dim">
                      {p.stage === 'preparing' && '等待开拍'}
                      {p.stage === 'shooting' && `拍摄中 · 场次 ${p.shotStages}/${p.totalStages}`}
                      {p.stage === 'editing' && '剪辑中'}
                      {p.stage === 'marketing' && `宣发中 · Hype ${Math.round(p.hype)}`}
                    </div>
                  )}
                  <div className="btn-row">
                    <button
                      className="btn-primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        onGoToProject(p.id)
                      }}
                    >
                      查看项目详情 →
                    </button>
                  </div>
                </PosterCard>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
