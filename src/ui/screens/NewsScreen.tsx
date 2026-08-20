import { useMemo } from 'react'
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

export function NewsScreen() {
  const state = useGameStore((s) => s.state)

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

  return (
    <div className="screen">
      <section className="panel">
        <h2>新闻报纸（{papers.length} 期）</h2>
        <p className="dim">每周大事汇成一份报纸，最新一期在上。</p>
        <div className="newspaper-stack">
          {papers.length === 0 && <p className="dim">暂无新闻。</p>}
          {papers.map((p) => {
            const headSec = newsSection(p.headline.text)
            return (
              <article className="newspaper" key={`${p.year}-${p.week}`}>
                <header className="newspaper-head">
                  <div className="newspaper-masthead">银幕周刊</div>
                  <div className="newspaper-sub">SCREEN WEEKLY · 光影行业每周要闻</div>
                  <div className="newspaper-meta">
                    <span>第 {p.year} 年 · 第 {p.week} 周</span>
                    <span>{SEASON_ZH(p.week)}</span>
                    <span>第 {p.issue} 期</span>
                  </div>
                </header>
                <div className="newspaper-headline">
                  <span className={`news-tag ${headSec.cls}`}>{headSec.label}</span>
                  <h3>{p.headline.text}</h3>
                </div>
                {p.body.length > 0 && (
                  <div className={`newspaper-body${p.body.length >= 3 ? ' two-col' : ''}`}>
                    {p.body.map((n) => {
                      const sec = newsSection(n.text)
                      return (
                        <article className="newspaper-article" key={n.id}>
                          <span className={`news-tag ${sec.cls}`}>{sec.label}</span>
                          <p>{n.text}</p>
                        </article>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
