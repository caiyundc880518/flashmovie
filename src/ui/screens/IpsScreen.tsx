import { useGameStore } from '../store/gameStore'
import { TYPE_ZH, fmtWan, fmtScore10, scoreColor10 } from '../format'
import { IP_CONFIG } from '../../core/config/ip'
import type { IpAsset } from '../../core/types'

/** IP 资产卡片的系列口碑色（10 分制） */
function ipScore(ip: IpAsset): string {
  return scoreColor10(ip.bestCriticScore)
}

export function IpsScreen({ onSequel }: { onSequel: (ipId: string) => void }) {
  const state = useGameStore((s) => s.state)
  if (!state) return null

  const ips = state.company.ips

  return (
    <div className="screen">
      <section className="panel">
        <h2>IP 资产管理（{ips.length}）</h2>
        <p className="dim">
          高票房 + 高口碑的影片会自动沉淀为 IP：每季度按等级结算衍生授权收入（周边/画廊/授权），
          续作获得票房加成与发行商预付款溢价。续作须与 IP 同类型，可从「组队立项」立项。
        </p>
        {ips.length === 0 ? (
          <p className="dim empty-hint">
            尚无 IP。票房 ≥ {IP_CONFIG.originBoxOffice} 万且影评 ≥ {IP_CONFIG.originCriticScore} 分的影片会自动沉淀为 IP，之后可在此页立项续作。
          </p>
        ) : (
          <div className="ip-grid">
            {ips.map((ip) => (
              <div key={ip.id} className="ip-card">
                <div className="ip-card-head">
                  <span className="table-name">{ip.name}</span>
                  <span className="ip-tags">
                    <span className="tag" style={{ color: 'var(--accent)' }}>
                      {TYPE_ZH[ip.type]}
                    </span>
                    <span className="tag tag-gold">Lv.{ip.level}</span>
                  </span>
                </div>
                <div className="ip-card-sub">
                  第 {ip.entry} 部 · 诞生于 {ip.originYear} 年第 {ip.originWeek} 周
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
                    <b style={{ color: ipScore(ip) }}>{fmtScore10(ip.bestCriticScore)}</b>
                    <span>最佳口碑</span>
                  </div>
                </div>
                <div className="ip-card-royalty">
                  <div>
                    <span className="dim">季度授权</span>
                    <b>{fmtWan(ip.royaltyPerQuarter)}/季</b>
                  </div>
                  <div>
                    <span className="dim">授权累计</span>
                    <b>{fmtWan(ip.royaltyEarned)}</b>
                  </div>
                </div>
                <div className="ip-footer">
                  <span className="ip-bonus">续作票房 +{Math.round((ip.sequelBonus - 1) * 100)}%</span>
                  <button className="btn-primary" onClick={() => onSequel(ip.id)}>
                    立项续作 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
