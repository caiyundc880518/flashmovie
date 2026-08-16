import { useEffect, useState } from 'react'
import { useGameStore } from '../ui/store/gameStore'
import { CompanyScreen } from '../ui/screens/CompanyScreen'
import { TechScreen } from '../ui/screens/TechScreen'
import { AudienceScreen } from '../ui/screens/AudienceScreen'
import { MarketScreen } from '../ui/screens/MarketScreen'
import { IpoScreen } from '../ui/screens/IpoScreen'
import { IpsScreen } from '../ui/screens/IpsScreen'
import { ScriptMarketScreen } from '../ui/screens/ScriptMarketScreen'
import { EmployeesScreen } from '../ui/screens/EmployeesScreen'
import { RecruitScreen } from '../ui/screens/RecruitScreen'
import { TeamBuildScreen } from '../ui/screens/TeamBuildScreen'
import { ProjectsScreen } from '../ui/screens/ProjectsScreen'
import { ProjectDetailScreen } from '../ui/screens/ProjectDetailScreen'
import { CriticsScreen } from '../ui/screens/CriticsScreen'
import { NewsScreen } from '../ui/screens/NewsScreen'
import { LeaderboardScreen } from '../ui/screens/LeaderboardScreen'
import { AwardsScreen } from '../ui/screens/AwardsScreen'
import { AwardsCeremonyModal } from '../ui/components/AwardsCeremonyModal'
import { Modal } from '../ui/components/Modal'
import { MoneyText } from '../ui/components/MoneyText'
import { SEASON_ZH } from '../ui/format'
import { TUTORIAL_STEPS, tutorialStep } from '../core/rules/tutorial'

type Nav =
  | { screen: 'company' }
  | { screen: 'tech' }
  | { screen: 'audience' }
  | { screen: 'market' }
  | { screen: 'ipo' }
  | { screen: 'marketScripts' }
  | { screen: 'employees' }
  | { screen: 'recruit' }
  | { screen: 'ips' }
  | { screen: 'team'; teamScriptId?: string; teamIpId?: string }
  | { screen: 'projects' }
  | { screen: 'critics' }
  | { screen: 'news' }
  | { screen: 'leaderboard' }
  | { screen: 'awards' }
  | { screen: 'project'; projectId: string }

type NavKey = Exclude<Nav['screen'], 'project'>

/** 左侧多级导航：分组 → 页面 */
const NAV_GROUPS: Array<{ group: string; items: Array<{ key: NavKey; label: string }> }> = [
  {
    group: '公司管理',
    items: [
      { key: 'company', label: '公司' },
      { key: 'ips', label: 'IP 资产' },
      { key: 'tech', label: '科技研发' },
      { key: 'market', label: '地区市场' },
      { key: 'ipo', label: 'IPO 上市' },
    ],
  },
  {
    group: '演职员管理',
    items: [
      { key: 'employees', label: '员工' },
      { key: 'recruit', label: '招聘' },
    ],
  },
  {
    group: '电影管理',
    items: [
      { key: 'marketScripts', label: '剧本市场' },
      { key: 'team', label: '组队立项' },
      { key: 'projects', label: '项目' },
    ],
  },
  {
    group: '电影媒体',
    items: [
      { key: 'critics', label: '影评人' },
      { key: 'audience', label: '观众群体' },
    ],
  },
  {
    group: '世界管理',
    items: [
      { key: 'news', label: '新闻' },
      { key: 'leaderboard', label: '排行榜' },
      { key: 'awards', label: '颁奖' },
    ],
  },
]

export function App() {
  const booted = useGameStore((s) => s.booted)
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const boot = useGameStore((s) => s.boot)
  const newGame = useGameStore((s) => s.newGame)
  const resetSave = useGameStore((s) => s.resetSave)
  const [nav, setNav] = useState<Nav>({ screen: 'company' })
  // 已看过的颁奖届次（避免重复弹出）
  const [seenCeremonyYear, setSeenCeremonyYear] = useState<number | null>(null)
  // 新手任务面板开关
  const [tutorialOpen, setTutorialOpen] = useState(false)
  // 侧栏折叠的分组（默认全展开）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  /** 跳转页面：同时展开目标所在分组 */
  const goTo = (key: NavKey) => {
    setNav({ screen: key })
    const group = NAV_GROUPS.find((g) => g.items.some((i) => i.key === key))
    if (group && collapsedGroups.has(group.group)) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev)
        next.delete(group.group)
        return next
      })
    }
  }

  /** 切换分组的折叠/展开 */
  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  useEffect(() => {
    void boot()
  }, [boot])

  if (!booted) return <div className="boot-screen">载入存档…</div>
  if (!state) return null

  // 新手引导：派生进度 + 显示开关（旧档 tutorial 为 undefined = 已完成）
  const step = tutorialStep(state)
  const showTutorialBar = state.tutorial !== undefined && step < 5
  const currentStep = TUTORIAL_STEPS[step]
  const PAGE_ZH: Record<string, string> = {
    company: '公司',
    marketScripts: '剧本市场',
    recruit: '招聘',
    team: '组队立项',
    projects: '项目',
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          星光影业
          <small>FlashMovie</small>
        </div>
        <nav className="side-nav">
          {NAV_GROUPS.map((g) => {
            const collapsed = collapsedGroups.has(g.group)
            return (
              <div key={g.group} className={`nav-group${collapsed ? ' nav-group-collapsed' : ''}`}>
                <button className="nav-group-title" onClick={() => toggleGroup(g.group)}>
                  <span className="nav-caret">{collapsed ? '▸' : '▾'}</span>
                  {g.group}
                </button>
                {!collapsed && (
                  <div className="nav-group-items">
                    {g.items.map((item) => (
                      <button
                        key={item.key}
                        className={nav.screen === item.key ? 'nav-item nav-active' : 'nav-item'}
                        onClick={() => goTo(item.key)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => {
              if (window.confirm('开始新游戏？当前进度将保留在存档中。')) newGame()
            }}
          >
            新游戏
          </button>
          <button
            className="nav-item"
            onClick={() => {
              if (window.confirm('清除存档并重新开始？')) void resetSave()
            }}
          >
            重置存档
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-info">
            <span className="top-cal">
              第 {state.calendar.year} 年 · 第 {state.calendar.week} 周 · {SEASON_ZH(state.calendar.week)}
            </span>
            <span className="top-stat">
              现金 <MoneyText value={state.company.cash} />
            </span>
            <span className="top-stat">声誉 {Math.round(state.company.reputation)}</span>
          </div>
          <button className="btn-primary btn-advance" onClick={() => dispatch({ type: 'advanceWeek' })}>
            推进一周 ▶
          </button>
        </header>

        <div className="content">
          {showTutorialBar && (
            <div className="tutorial-bar" onClick={() => setTutorialOpen(true)}>
              <span className="tutorial-progress">🧭 新手任务 {step}/5</span>
              <span className="tutorial-current">
                {currentStep ? `当前：${currentStep.title}` : '全部完成'}
              </span>
              <span className="tutorial-hint">点击查看任务清单 →</span>
            </div>
          )}
          {nav.screen === 'company' && <CompanyScreen />}
          {nav.screen === 'tech' && <TechScreen />}
          {nav.screen === 'audience' && <AudienceScreen />}
          {nav.screen === 'market' && <MarketScreen />}
          {nav.screen === 'ipo' && <IpoScreen />}
          {nav.screen === 'ips' && (
            <IpsScreen onSequel={(ipId) => setNav({ screen: 'team', teamIpId: ipId })} />
          )}
          {nav.screen === 'marketScripts' && (
            <ScriptMarketScreen onBuildTeam={(id) => setNav({ screen: 'team', teamScriptId: id })} />
          )}
          {nav.screen === 'employees' && <EmployeesScreen />}
          {nav.screen === 'recruit' && <RecruitScreen />}
          {nav.screen === 'critics' && <CriticsScreen />}
          {nav.screen === 'news' && <NewsScreen />}
          {nav.screen === 'leaderboard' && <LeaderboardScreen />}
          {nav.screen === 'awards' && <AwardsScreen />}
          {nav.screen === 'projects' && (
            <ProjectsScreen onOpenProject={(id) => setNav({ screen: 'project', projectId: id })} />
          )}
          {nav.screen === 'team' && (
            <TeamBuildScreen
              key={`${nav.teamScriptId ?? 'team'}-${nav.teamIpId ?? ''}`}
              initialScriptId={nav.teamScriptId}
              initialIpId={nav.teamIpId}
              onGoToProject={(id) => setNav({ screen: 'project', projectId: id })}
            />
          )}
          {nav.screen === 'project' && (
            <ProjectDetailScreen
              projectId={nav.projectId}
              onBack={() => setNav({ screen: 'projects' })}
            />
          )}
        </div>
      </div>

      {state.lastCeremony && state.lastCeremony.year !== seenCeremonyYear && (
        <AwardsCeremonyModal
          ceremony={state.lastCeremony}
          onClose={() => setSeenCeremonyYear(state.lastCeremony!.year)}
        />
      )}

      {/* 新手引导：欢迎弹窗（新档首次进入） */}
      {state.tutorial === 0 && (
        <Modal title="🎬 欢迎来到星光影业" onClose={() => dispatch({ type: 'finishTutorialIntro' })}>
          <p>
            你是一家新成立的电影公司 CEO，目标是拍出叫好又叫座的作品，打造属于自己的电影帝国，最终<b>上市</b>。
          </p>
          <p className="dim">
            三条主线：<b>养成</b>（员工成长 / 签约编剧 / 写作学校 / 科技研发）→ <b>制作</b>（剧本 → 组队 →
            拍摄 → 剪辑）→ <b>商业</b>（宣发 / 发行渠道 / 票房 / 口碑 / IP 系列化 / 上市）。
          </p>
          <p className="dim">
            先按顶部的「🧭 新手任务」完成 5 步，拍出你的第一部电影。随时可以推进一周来观察世界变化。
          </p>
          <div className="btn-row">
            <button className="btn-primary" onClick={() => dispatch({ type: 'finishTutorialIntro' })}>
              开始征程 ▶
            </button>
          </div>
        </Modal>
      )}

      {/* 新手引导：任务清单 */}
      {tutorialOpen && (
        <Modal title="🧭 新手任务" wide onClose={() => setTutorialOpen(false)}>
          {TUTORIAL_STEPS.map((t, i) => {
            const done = i < step
            const current = i === step
            return (
              <div key={t.id} className={`tutorial-step${done ? ' tutorial-done' : ''}${current ? ' tutorial-current' : ''}`}>
                <div className="tutorial-step-head">
                  <span className="step-check">{done ? '✓' : t.id}</span>
                  <span className="slot-title">{t.title}</span>
                  {done ? (
                    <span className="tag tag-pro">完成</span>
                  ) : current ? (
                    <span className="tag tag-required">进行中</span>
                  ) : (
                    <span className="tag">待完成</span>
                  )}
                </div>
                <p className="dim">{t.hint}</p>
                {current && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      goTo(t.page)
                      setTutorialOpen(false)
                    }}
                  >
                    前往{PAGE_ZH[t.page]} →
                  </button>
                )}
              </div>
            )
          })}
          {step >= 5 && (
            <p className="msg">🎉 新手任务全部完成，放手经营你的电影帝国吧！</p>
          )}
        </Modal>
      )}
    </div>
  )
}
