import { useEffect, useState } from 'react'
import { useGameStore } from '../ui/store/gameStore'
import { CompanyScreen } from '../ui/screens/CompanyScreen'
import { TechScreen } from '../ui/screens/TechScreen'
import { AudienceScreen } from '../ui/screens/AudienceScreen'
import { MarketScreen } from '../ui/screens/MarketScreen'
import { FinancingScreen } from '../ui/screens/FinancingScreen'
import { IpoScreen } from '../ui/screens/IpoScreen'
import { IpsScreen } from '../ui/screens/IpsScreen'
import { IpDetailScreen } from '../ui/screens/IpDetailScreen'
import { ScriptMarketScreen } from '../ui/screens/ScriptMarketScreen'
import { EmployeesScreen } from '../ui/screens/EmployeesScreen'
import { RecruitScreen } from '../ui/screens/RecruitScreen'
import { TeamBuildScreen } from '../ui/screens/TeamBuildScreen'
import { ProjectsScreen } from '../ui/screens/ProjectsScreen'
import { ProjectDetailScreen } from '../ui/screens/ProjectDetailScreen'
import { ReleasedProjectScreen } from '../ui/screens/ReleasedProjectScreen'
import { LongtailScreen } from '../ui/screens/LongtailScreen'
import { CriticsScreen } from '../ui/screens/CriticsScreen'
import { NewsScreen } from '../ui/screens/NewsScreen'
import { LeaderboardScreen } from '../ui/screens/LeaderboardScreen'
import { AwardsScreen } from '../ui/screens/AwardsScreen'
import { MainMenuScreen } from '../ui/screens/MainMenuScreen'
import { AwardsCeremonyModal } from '../ui/components/AwardsCeremonyModal'
import { Modal } from '../ui/components/Modal'
import { NewGameModal } from '../ui/components/NewGameModal'
import { ProjectEventModal } from '../ui/components/ProjectEventModal'
import { ReviewFlipModal } from '../ui/components/ReviewFlipModal'
import { MoneyText } from '../ui/components/MoneyText'
import { SEASON_ZH } from '../ui/format'
import { ROLE_ZH } from '../ui/format'
import { ROLE_IDS, type CriticReview, type FilmResult, type TimingQuality } from '../core/types'
import { TimingMinigame } from '../ui/components/TimingMinigame'

type Nav =
  | { screen: 'company' }
  | { screen: 'tech' }
  | { screen: 'audience' }
  | { screen: 'market' }
  | { screen: 'financing' }
  | { screen: 'ipo' }
  | { screen: 'marketScripts' }
  | { screen: 'employees' }
  | { screen: 'recruit' }
  | { screen: 'ips' }
  | { screen: 'ipDetail'; ipId: string }
  | { screen: 'team'; teamScriptId?: string; teamIpId?: string }
  | { screen: 'projects' }
  | { screen: 'longtail' }
  | { screen: 'critics' }
  | { screen: 'news' }
  | { screen: 'leaderboard' }
  | { screen: 'awards' }
  | { screen: 'project'; projectId: string }

/** 导航菜单项 key（排除带参页面 project / ipDetail） */
type NavKey = Exclude<Nav['screen'], 'project' | 'ipDetail'>

/** 左侧多级导航：分组 → 页面 */
const NAV_GROUPS: Array<{ group: string; items: Array<{ key: NavKey; label: string }> }> = [
  {
    group: '公司管理',
    items: [
      { key: 'company', label: '公司' },
      { key: 'ips', label: 'IP 资产' },
      { key: 'tech', label: '科技研发' },
      { key: 'market', label: '地区市场' },
      { key: 'financing', label: '融资' },
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
      { key: 'longtail', label: '长尾收益' },
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
  // 侧栏折叠的分组（默认全展开）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  // 是否已进入游戏（false = 主菜单）
  const [inGame, setInGame] = useState(false)
  // 新游戏 / 重置存档：输入公司名弹窗
  const [newGameOpen, setNewGameOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  // 项目详情页的"返回上一页"：记录进入项目详情前的页面
  const [projectReturn, setProjectReturn] = useState<Nav | null>(null)
  // 拍摄阶段强制事件弹窗：有待决事件时阻止推进一周
  const [pendingEvent, setPendingEvent] = useState<{ projectId: string; eventIndex: number } | null>(null)
  // 强制小游戏（拍摄被动触发 / 剪辑必须完成）：不完成不能推进
  const [pendingGame, setPendingGame] = useState<{ projectId: string; kind: 'shot' | 'edit' } | null>(null)
  // 作弊菜单：在招聘市场生成满属性免费人才
  const [cheatOpen, setCheatOpen] = useState(false)
  // 上映成功后的口碑揭晓弹窗（由 App 承载：上映后详情页切换到已上映页，弹窗不丢失）
  const [flipReview, setFlipReview] = useState<{
    projectId: string
    projectName: string
    reviews: CriticReview[]
    audience?: { score: number; text?: string }
  } | null>(null)

  /** 定档上映成功后：弹影评翻牌（成员成长结算在首轮下片时，见已上映详情页） */
  const handleReleased = (projectId: string, result: FilmResult) => {
    setFlipReview({
      projectId,
      projectName: result.name,
      reviews: result.reviews,
      audience:
        result.audienceScore !== undefined
          ? { score: result.audienceScore, text: result.audienceText }
          : undefined,
    })
  }

  /** 打开项目详情：记录来源页，返回时回到上一页面 */
  const openProject = (id: string) => {
    setProjectReturn(nav)
    setNav({ screen: 'project', projectId: id })
  }

  /** 点推进一周：先处理待决事件 / 待玩小游戏（拍摄被动触发、剪辑必须完成），否则才推进 */
  const advanceClick = () => {
    const s = useGameStore.getState().state
    // 1) 拍摄：有待决随机事件 → 弹事件
    const evProj = s?.projects.find((p) => p.stage === 'shooting' && p.pendingEvents.length > 0)
    if (evProj) {
      setPendingEvent({ projectId: evProj.id, eventIndex: 0 })
      return
    }
    // 2) 拍摄：有待玩小游戏（被动触发）→ 强制弹小游戏
    const shotProj = s?.projects.find((p) => p.stage === 'shooting' && p.pendingShotGame)
    if (shotProj) {
      setPendingGame({ projectId: shotProj.id, kind: 'shot' })
      return
    }
    // 3) 剪辑：必须完成剪辑小游戏才能推进
    const editProj = s?.projects.find((p) => p.stage === 'editing' && !p.editGameDone)
    if (editProj) {
      setPendingGame({ projectId: editProj.id, kind: 'edit' })
      return
    }
    dispatch({ type: 'advanceWeek' })
  }

  /** 处理完一个事件后：关闭弹窗（若同项目还有事件，下一次点推进时继续弹出） */
  const handleEventResolve = (optionIndex: number) => {
    if (!pendingEvent) return
    const s = useGameStore.getState().state
    const p = s?.projects.find((x) => x.id === pendingEvent.projectId)
    const eventId = p?.pendingEvents[pendingEvent.eventIndex]?.id
    if (!eventId) return
    dispatch({ type: 'resolveEvent', projectId: pendingEvent.projectId, eventId, optionIndex })
    setPendingEvent(null)
  }

  /** 强制小游戏完成（3 轮判定）：结算并关闭 */
  const handleGameResult = (qualities: TimingQuality[]) => {
    if (!pendingGame) return
    dispatch(
      pendingGame.kind === 'shot'
        ? { type: 'applyShotGame', projectId: pendingGame.projectId, qualities }
        : { type: 'applyEditGame', projectId: pendingGame.projectId, qualities },
    )
    setPendingGame(null)
  }

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

  // 主菜单：有存档显示「继续游戏」，无存档只提供「开始新游戏」（输入公司名）
  if (!inGame) {
    return (
      <MainMenuScreen
        hasSave={!!state}
        saveInfo={
          state ? { name: state.company.name, year: state.calendar.year } : null
        }
        onContinue={() => setInGame(true)}
        onNewGame={(name) => {
          newGame(name)
          setInGame(true)
        }}
      />
    )
  }

  if (!state) return null

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
          <button className="nav-item" onClick={() => setNewGameOpen(true)}>
            新游戏
          </button>
          <button className="nav-item" onClick={() => setResetOpen(true)}>
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
          <div className="topbar-actions">
            <button
              className="btn-cheat"
              onClick={() => setCheatOpen(true)}
              title="作弊：免费生成满属性人才进入招聘市场"
            >
              ⚡ 作弊
            </button>
            <button className="btn-primary btn-advance" onClick={advanceClick}>
              推进一周 ▶
            </button>
          </div>
        </header>

        <div className="content">
          {nav.screen === 'company' && <CompanyScreen />}
          {nav.screen === 'tech' && <TechScreen />}
          {nav.screen === 'audience' && <AudienceScreen />}
          {nav.screen === 'market' && <MarketScreen />}
          {nav.screen === 'financing' && <FinancingScreen />}
          {nav.screen === 'ipo' && <IpoScreen />}
          {nav.screen === 'ips' && (
            <IpsScreen
              onSequel={(ipId) => setNav({ screen: 'team', teamIpId: ipId })}
              onOpenDetail={(ipId) => setNav({ screen: 'ipDetail', ipId })}
            />
          )}
          {nav.screen === 'ipDetail' && (
            <IpDetailScreen
              ipId={nav.ipId}
              onBack={() => setNav({ screen: 'ips' })}
              onGoToProject={openProject}
            />
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
            <ProjectsScreen onOpenProject={openProject} />
          )}
          {nav.screen === 'longtail' && (
            <LongtailScreen onOpenProject={openProject} />
          )}
          {nav.screen === 'team' && (
            <TeamBuildScreen
              key={`${nav.teamScriptId ?? 'team'}-${nav.teamIpId ?? ''}`}
              initialScriptId={nav.teamScriptId}
              initialIpId={nav.teamIpId}
              onGoToProject={openProject}
            />
          )}
          {nav.screen === 'project' && (() => {
            const proj = state.projects.find((x) => x.id === nav.projectId)
            const back = () => setNav(projectReturn ?? { screen: 'projects' })
            // 已上映项目走独立的电影档案详情页
            return proj?.stage === 'released' ? (
              <ReleasedProjectScreen projectId={nav.projectId} onBack={back} />
            ) : (
              <ProjectDetailScreen projectId={nav.projectId} onBack={back} onReleased={handleReleased} />
            )
          })()}
        </div>
      </div>

      {/* 作弊菜单：生成满属性免费人才 + 作弊开关 */}
      {cheatOpen && (
        <Modal title="⚡ 作弊菜单" onClose={() => setCheatOpen(false)}>
          <p className="dim">
            在招聘市场生成一位<b>全属性 100</b>（CA/PA 100）的<b>免费</b>人才，选择职位即可生成（雇佣也免费）。
          </p>
          <div className="cheat-grid">
            {ROLE_IDS.map((r) => (
              <button
                key={r}
                onClick={() => {
                  dispatch({ type: 'cheatSpawnWorker', role: r })
                  setCheatOpen(false)
                }}
              >
                {ROLE_ZH[r]}
              </button>
            ))}
          </div>
          <div className="cheat-toggles">
            <label className="cheat-switch">
              <input
                type="checkbox"
                checked={!!state?.cheats?.noCaDecay}
                onChange={() => dispatch({ type: 'toggleNoCaDecay' })}
              />
              <span className="cheat-switch-ui" aria-hidden />
              <span>
                员工 CA 不衰退
                <small className="dim">开启：空闲不掉技能/CA/名气，成长照常；关闭：正常衰退与成长</small>
              </span>
            </label>
          </div>
        </Modal>
      )}

      {/* 拍摄阶段强制事件弹窗：有待决事件时点推进一周会先弹出 */}
      {pendingEvent && (() => {
        const proj = state?.projects.find((x) => x.id === pendingEvent.projectId)
        const ev = proj?.pendingEvents[pendingEvent.eventIndex]
        if (!proj || !ev) return null
        return (
          <ProjectEventModal
            projectName={proj.name}
            event={ev}
            onResolve={handleEventResolve}
            onLater={() => setPendingEvent(null)}
          />
        )
      })()}

      {/* 强制小游戏：拍摄被动触发 / 剪辑必须完成（不完成不能推进） */}
      {pendingGame && (() => {
        const proj = state?.projects.find((x) => x.id === pendingGame.projectId)
        if (!proj) return null
        const isShot = pendingGame.kind === 'shot'
        return (
          <TimingMinigame
            title={isShot ? `🎬 《${proj.name}》运镜挑战` : `✂ 《${proj.name}》剪辑挑战`}
            desc={
              isShot
                ? '这场戏需要完成运镜挑战（共 3 轮）。全部完美将大幅提升成片 AP/MP，全部失误则无加成。'
                : '剪辑必须完成节奏挑战（共 3 轮）才能继续推进。全部完美将大幅提升成片 AP/MP。'
            }
            actionLabel={isShot ? '运镜' : '剪！'}
            onResult={() => {}}
            onFinish={handleGameResult}
            onClose={() => setPendingGame(null)}
          />
        )
      })()}

      {/* 定档上映：影评/观众口碑翻牌弹窗（成员成长结算在首轮下片后，详情页可查） */}
      {flipReview && (
        <ReviewFlipModal
          projectName={flipReview.projectName}
          reviews={flipReview.reviews}
          audience={flipReview.audience}
          onClose={() => setFlipReview(null)}
        />
      )}

      {/* 新游戏 / 重置存档：输入公司名 */}
      {newGameOpen && (
        <NewGameModal
          defaultName={state?.company.name}
          onStart={(name) => newGame(name)}
          onClose={() => setNewGameOpen(false)}
        />
      )}
      {resetOpen && (
        <NewGameModal
          defaultName="星光影业"
          onStart={(name) => void resetSave(name)}
          onClose={() => setResetOpen(false)}
        />
      )}

      {state.lastCeremony && state.lastCeremony.year !== seenCeremonyYear && (
        <AwardsCeremonyModal
          ceremony={state.lastCeremony}
          onClose={() => setSeenCeremonyYear(state.lastCeremony!.year)}
        />
      )}

      {/* 对手挖角弹窗：留人（付签字费）或放人（员工跳槽） */}
      {inGame && state.world.pendingPoach && (() => {
        const poach = state.world.pendingPoach
        const worker = state.workers[poach.workerId]
        const comp = state.world.competitors.find((c) => c.id === poach.competitorId)
        const canKeep = state.company.cash >= poach.offer
        return (
          <div className="modal-overlay">
            <div className="modal" role="dialog" aria-modal="true">
              <div className="modal-head">
                <h2>⚔️ 挖角警告</h2>
              </div>
              <div className="modal-body">
                <p>
                  竞争对手「{comp?.name ?? '未知影业'}」开出{' '}
                  <b className="money">{poach.offer} 万</b> 签字费，试图挖走你的员工「
                  {worker?.name ?? '未知员工'}」！
                </p>
                {!canKeep && <p className="bad">资金不足，无法挽留，只能放人。</p>}
                <div className="btn-row" style={{ marginTop: 14 }}>
                  <button
                    className="btn-primary"
                    disabled={!canKeep}
                    onClick={() => dispatch({ type: 'respondPoach', keep: true })}
                  >
                    挽留（付 {poach.offer} 万）
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => dispatch({ type: 'respondPoach', keep: false })}
                  >
                    放人
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
