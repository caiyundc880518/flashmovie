import { useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { SEASON_ZH } from '../format'
import type { NewsItem } from '../../core/types'

interface NewsSection {
  label: string
  cls: string
}

/** 按关键词把一条新闻归入报纸栏目 */
function newsSection(text: string): NewsSection {
  if (/行业事件|好消息|风波|喜讯|颁奖|TMA|影评人|科技突破|投资人|上市|股东分红|补贴/.test(text)) {
    return { label: '行业大事', cls: 'sec-industry' }
  }
  if (/上映|票房|档期|首周|再发行|竞争加剧|类型热潮/.test(text)) {
    return { label: '影市风云', cls: 'sec-market' }
  }
  if (/加入|挖角|跳槽|挽留|退出|退休|离职|加盟|签约/.test(text)) {
    return { label: '人事变动', cls: 'sec-hr' }
  }
  return { label: '公司动态', cls: 'sec-company' }
}

/** 重磅事件可上头条 */
const HEADLINE_RE = /颁奖|TMA|正式上映|首周上映|行业事件|收购|上市/

interface Paper {
  year: number
  week: number
  issue: number
  headline: NewsItem
  body: NewsItem[]
}

/** 单份报纸版面 */
function PaperArticle({ p }: { p: Paper }) {
  const headSec = newsSection(p.headline.text)
  return (
    <article className="newspaper">
      <header className="newspaper-head">
        <div className="newspaper-topline">
          <span>第 {p.issue} 期</span>
          <span>{SEASON_ZH(p.week)}</span>
          <span>第 {p.year} 年 · 第 {p.week} 周</span>
        </div>
        <div className="newspaper-masthead">银幕周刊</div>
        <div className="newspaper-sub">SCREEN WEEKLY · 光影行业每周要闻</div>
      </header>
      <div className="newspaper-headline">
        <span className="newspaper-stamp">头条</span>
        <h3>
          <span className={`news-tag ${headSec.cls}`}>{headSec.label}</span>
          {p.headline.text}
        </h3>
      </div>
      {p.body.length > 0 && (
        <div className={`newspaper-body${p.body.length >= 3 ? ' two-col' : ''}`}>
          {p.body.map((n) => {
            const sec = newsSection(n.text)
            return (
              <article className="newspaper-article" key={n.id}>
                <p>
                  <span className={`news-tag ${sec.cls}`}>{sec.label}</span>
                  {n.text}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </article>
  )
}

export function NewsScreen() {
  const state = useGameStore((s) => s.state)
  // 筛选定位：null = 最新一期
  const [sel, setSel] = useState<{ year: number; week: number } | null>(null)

  const papers = useMemo<Paper[]>(() => {
    if (!state) return []
    // 按周分组：同一周的多条新闻 = 同一份报纸
    const groups = new Map<number, NewsItem[]>()
    for (const n of state.world.news) {
      const arr = groups.get(n.week) ?? []
      arr.push(n)
      groups.set(n.week, arr)
    }
    const year = state.calendar.year
    const curWeek = state.calendar.week
    const papers: Paper[] = [...groups.entries()].map(([week, items]) => {
      // 新闻仅保留最近 30 条（跨度 < 52 周），week > 当前周 必属去年
      const y = week <= curWeek ? year : year - 1
      const headline = items.find((i) => HEADLINE_RE.test(i.text)) ?? items[0]
      return {
        year: y,
        week,
        issue: (y - 1) * 52 + week,
        headline,
        body: items.filter((i) => i.id !== headline.id),
      }
    })
    papers.sort((a, b) => b.year * 52 + b.week - (a.year * 52 + a.week))
    return papers
  }, [state])

  if (!state) return null

  const latest = papers[0]
  const years = [...new Set(papers.map((p) => p.year))].sort((a, b) => a - b)
  const cur = sel ?? (latest ? { year: latest.year, week: latest.week } : null)
  const shown = cur ? papers.find((p) => p.year === cur.year && p.week === cur.week) ?? null : null
  const curIdx = shown ? papers.findIndex((p) => p.year === shown.year && p.week === shown.week) : -1

  const selectYear = (y: number) => {
    const inYear = papers.filter((p) => p.year === y)
    const w = inYear.length > 0 ? Math.max(...inYear.map((p) => p.week)) : 1
    setSel({ year: y, week: w })
  }

  const step = (d: number) => {
    if (papers.length === 0 || curIdx < 0) return
    // 列表按时间倒序（index 0 = 最新）；+1 翻到更早一期，-1 翻回更新一期
    const idx = Math.min(Math.max(curIdx + d, 0), papers.length - 1)
    const p = papers[idx]
    setSel({ year: p.year, week: p.week })
  }

  return (
    <div className="screen">
      <section className="panel">
        <h2>新闻报纸（共 {papers.length} 期）</h2>
        <div className="paper-nav">
          <div className="paper-nav-years">
            {years.map((y) => (
              <button
                key={y}
                className={cur?.year === y ? 'tab-btn tab-active' : 'tab-btn'}
                onClick={() => selectYear(y)}
              >
                第 {y} 年
              </button>
            ))}
          </div>
          <label className="paper-nav-week">
            第
            <select
              value={cur?.week ?? 1}
              onChange={(e) => cur && setSel({ year: cur.year, week: Number(e.target.value) })}
            >
              {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            周
          </label>
          <div className="paper-nav-btns">
            <button className="btn" onClick={() => step(1)} disabled={curIdx < 0 || curIdx >= papers.length - 1}>
              ← 上一期
            </button>
            <button className="btn" onClick={() => step(-1)} disabled={curIdx <= 0}>
              下一期 →
            </button>
            <button className="btn-primary" onClick={() => setSel(null)}>
              最新一期
            </button>
          </div>
        </div>

        {papers.length === 0 && <p className="dim">暂无新闻。</p>}
        {papers.length > 0 && !shown && cur && (
          <div className="paper-empty">
            <p>第 {cur.year} 年 · 第 {cur.week} 周没有报纸（该周无新闻）。</p>
            <button className="btn-primary" onClick={() => setSel(null)}>
              回到最新一期
            </button>
          </div>
        )}
        {shown && (
          <>
            <p className="paper-info dim">
              第 {shown.issue} 期 · 第 {shown.year} 年 · 第 {shown.week} 周 · {SEASON_ZH(shown.week)}
            </p>
            <PaperArticle p={shown} />
          </>
        )}
      </section>
    </div>
  )
}
