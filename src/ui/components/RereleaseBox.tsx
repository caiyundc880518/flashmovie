import { useState } from 'react'
import type { Channel, RunChannelConfig } from '../../core/types'
import { CHANNEL_CONFIG, CHANNEL_INFO, WEB_PLATFORMS } from '../../core/config/channels'

/**
 * 再发行设置框：选严格更低档渠道 + 渠道参数（与首次发行一致的选项）→ 回调提交。
 * web = 平台多选 + 投放时长；dvd = 单价；free = 广告单价。
 */
export function RereleaseBox({
  lower,
  onRerelease,
  label = '再发行渠道（严格更低档）',
  buttonText = '再发行 ▶',
}: {
  lower: Channel[]
  onRerelease: (channel: Channel, cfg: RunChannelConfig) => void
  label?: string
  buttonText?: string
}) {
  const [ch, setCh] = useState<Channel | ''>('')
  const [webPlatforms, setWebPlatforms] = useState<string[]>([])
  const [webWeeks, setWebWeeks] = useState<number>(CHANNEL_CONFIG.webDefaultWeeks)
  const [dvdPrice, setDvdPrice] = useState<number>(CHANNEL_CONFIG.dvdRefPrice)
  const [freeAdPrice, setFreeAdPrice] = useState<number>(30)

  const reset = () => {
    setCh('')
    setWebPlatforms([])
    setWebWeeks(CHANNEL_CONFIG.webDefaultWeeks)
    setDvdPrice(CHANNEL_CONFIG.dvdRefPrice)
    setFreeAdPrice(30)
  }

  const submit = () => {
    if (!ch) return
    onRerelease(ch, {
      cinemaCount: 0,
      webPlatforms: ch === 'web' ? webPlatforms : [],
      webWeeks: ch === 'web' ? webWeeks : 0,
      dvdPrice: ch === 'dvd' ? dvdPrice : 0,
      freeAdPrice: ch === 'free' ? freeAdPrice : 0,
    })
    reset()
  }

  return (
    <div className="rr-box">
      <div className="rr-line">
        <span className="slot-label">{label}</span>
        <select value={ch} onChange={(e) => setCh(e.target.value as Channel | '')}>
          <option value="">选择渠道…</option>
          {lower.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_INFO[c].label}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={!ch} onClick={submit}>
          {buttonText}
        </button>
      </div>
      {ch === 'web' && (
        <div className="rr-config">
          <div className="channel-row">
            {WEB_PLATFORMS.map((pl) => {
              const on = webPlatforms.includes(pl)
              return (
                <label key={pl} className="config-label">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setWebPlatforms((prev) => (on ? prev.filter((x) => x !== pl) : [...prev, pl]))
                    }
                  />
                  {pl}
                </label>
              )
            })}
          </div>
          <div className="config-row">
            <label className="config-label">投放时长（周）</label>
            <input
              type="number"
              value={webWeeks}
              min={1}
              max={52}
              onChange={(e) => setWebWeeks(Number(e.target.value) || CHANNEL_CONFIG.webDefaultWeeks)}
            />
          </div>
        </div>
      )}
      {ch === 'dvd' && (
        <div className="rr-config">
          <div className="config-row">
            <label className="config-label">DVD 单价（元/张）</label>
            <input
              type="number"
              value={dvdPrice}
              min={1}
              max={CHANNEL_CONFIG.dvdPriceRange[1]}
              onChange={(e) => setDvdPrice(Number(e.target.value) || CHANNEL_CONFIG.dvdRefPrice)}
            />
          </div>
        </div>
      )}
      {ch === 'free' && (
        <div className="rr-config">
          <div className="config-row">
            <label className="config-label">广告单价（元/千次播放）</label>
            <input
              type="number"
              value={freeAdPrice}
              min={1}
              max={CHANNEL_CONFIG.freeAdPriceRange[1]}
              onChange={(e) => setFreeAdPrice(Number(e.target.value) || 30)}
            />
          </div>
        </div>
      )}
    </div>
  )
}