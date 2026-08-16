import { useState } from 'react'
import { Modal } from './Modal'

/** 开始新游戏：输入公司名称（主菜单与侧栏「新游戏」共用） */
export function NewGameModal({
  defaultName,
  onStart,
  onClose,
}: {
  defaultName?: string
  onStart: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(defaultName ?? '星光影业')

  return (
    <Modal title="🎬 开始新游戏" onClose={onClose}>
      <p className="dim">为公司起个名字，开启你的电影帝国之旅（当前存档将被覆盖）。</p>
      <div style={{ margin: '14px 0' }}>
        <input
          type="text"
          value={name}
          maxLength={12}
          onChange={(e) => setName(e.target.value)}
          placeholder="公司名称"
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      <div className="btn-row">
        <button
          className="btn-primary"
          disabled={!name.trim()}
          onClick={() => {
            onStart(name.trim() || '星光影业')
            onClose()
          }}
        >
          开始征程 ▶
        </button>
        <button onClick={onClose}>取消</button>
      </div>
    </Modal>
  )
}
