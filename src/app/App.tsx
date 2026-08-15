import { useEffect, useState } from 'react'
import { useGameStore } from '../ui/store/gameStore'
import { CompanyScreen } from '../ui/screens/CompanyScreen'
import { ScriptMarketScreen } from '../ui/screens/ScriptMarketScreen'
import { EmployeesScreen } from '../ui/screens/EmployeesScreen'
import { RecruitScreen } from '../ui/screens/RecruitScreen'
import { TeamBuildScreen } from '../ui/screens/TeamBuildScreen'
import { ProjectDetailScreen } from '../ui/screens/ProjectDetailScreen'
import { CriticsScreen } from '../ui/screens/CriticsScreen'
import { NewsScreen } from '../ui/screens/NewsScreen'
import { LeaderboardScreen } from '../ui/screens/LeaderboardScreen'
import { MoneyText } from '../ui/components/MoneyText'
import { SEASON_ZH } from '../ui/format'

type Nav =
  | { screen: 'company' }
  | { screen: 'market' }
  | { screen: 'employees' }
  | { screen: 'recruit' }
  | { screen: 'team'; teamScriptId?: string }
  | { screen: 'critics' }
  | { screen: 'news' }
  | { screen: 'leaderboard' }
  | { screen: 'project'; projectId: string }

type NavKey = Exclude<Nav['screen'], 'project'>

const NAV_ITEMS: Array<{ key: NavKey; label: string }> = [
  { key: 'company', label: '公司' },
  { key: 'market', label: '剧本市场' },
  { key: 'employees', label: '员工' },
  { key: 'recruit', label: '招聘' },
  { key: 'team', label: '组队立项' },
  { key: 'critics', label: '影评人' },
  { key: 'news', label: '新闻' },
  { key: 'leaderboard', label: '排行榜' },
]

export function App() {
  const booted = useGameStore((s) => s.booted)
  const state = useGameStore((s) => s.state)
  const dispatch = useGameStore((s) => s.dispatch)
  const boot = useGameStore((s) => s.boot)
  const newGame = useGameStore((s) => s.newGame)
  const resetSave = useGameStore((s) => s.resetSave)
  const [nav, setNav] = useState<Nav>({ screen: 'company' })

  useEffect(() => {
    void boot()
  }, [boot])

  if (!booted) return <div className="boot-screen">载入存档…</div>
  if (!state) return null

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          星光影业
          <small>FlashMovie</small>
        </div>
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={nav.screen === item.key ? 'nav-item nav-active' : 'nav-item'}
              onClick={() => setNav({ screen: item.key })}
            >
              {item.label}
            </button>
          ))}        </nav>
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
          {nav.screen === 'company' && (
            <CompanyScreen onOpenProject={(id) => setNav({ screen: 'project', projectId: id })} />
          )}
          {nav.screen === 'market' && (
            <ScriptMarketScreen onBuildTeam={(id) => setNav({ screen: 'team', teamScriptId: id })} />
          )}
          {nav.screen === 'employees' && <EmployeesScreen />}
          {nav.screen === 'recruit' && <RecruitScreen />}
          {nav.screen === 'critics' && <CriticsScreen />}
          {nav.screen === 'news' && <NewsScreen />}
          {nav.screen === 'leaderboard' && <LeaderboardScreen />}
          {nav.screen === 'team' && (
            <TeamBuildScreen key={nav.teamScriptId ?? 'team'} initialScriptId={nav.teamScriptId} />
          )}
          {nav.screen === 'project' && (
            <ProjectDetailScreen
              projectId={nav.projectId}
              onBack={() => setNav({ screen: 'company' })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
