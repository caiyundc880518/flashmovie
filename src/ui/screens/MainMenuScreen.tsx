import { useState } from 'react'
import { NewGameModal } from '../components/NewGameModal'

export function MainMenuScreen({
  hasSave,
  saveInfo,
  onContinue,
  onNewGame,
}: {
  hasSave: boolean
  saveInfo: { name: string; year: number } | null
  onContinue: () => void
  onNewGame: (name: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="main-menu">
      <div className="menu-logo">🎬</div>
      <div className="menu-title">
        星光影业
        <small>FlashMovie · 电影公司模拟经营</small>
      </div>
      <p className="menu-sub">
        你是新成立的电影公司 CEO：养成员工、签约编剧、拍片宣发、经营 IP，
        从第一部影片开始，打造你的电影帝国，最终上市。
      </p>

      <div className="menu-actions">
        {hasSave && saveInfo && (
          <>
            <button className="btn-primary" onClick={onContinue}>
              继续游戏
            </button>
            <span className="menu-save">
              上次存档：{saveInfo.name} · 第 {saveInfo.year} 年
            </span>
          </>
        )}
        <button onClick={() => setOpen(true)}>开始新游戏</button>
      </div>

      {open && (
        <NewGameModal
          defaultName={saveInfo?.name}
          onStart={onNewGame}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
