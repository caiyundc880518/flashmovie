# 星光影业 FlashMovie · 电影长尾收益大修 — 设计文档

- 日期：2026-08-18
- 状态：已与用户逐节确认（brainstorming 流程）
- 关联 GDD：docs/GDD.md（§3.6 发行、§3.8 IP、§7.3 票房）

## 1. 背景与目标

当前「上映」= 瞬时结算：点上映立刻定出票房/分账/口碑/成员成长，`FilmResult` 上映即冻结。缺少：
1. **票房累积过程**——没有逐周动态，看不到"首周峰值→递减→归零"的市场曲线；
2. **定档 / 预售 / 下片**——没有决定何时变现、提前攒预售、主动下片的环节；
3. **长尾收益**——下片后的再发行、IP 周边（热门度驱动）、版权交易（卖电视剧/游戏版权）。

本次大修目标：把瞬时结算改为**每周动态结算**，并补齐**定档/预售/下片**与**长尾收益三件套**，全部按周结算。

## 2. 已敲定的核心决策

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 口碑/MP 每周变化驱动 | **票房表现驱动**：本周票房超预期→口碑/MP 升，低于预期→降；口碑/MP 又反作用于下周票房（自我强化闭环） |
| 2 | 预售机制 | **热度驱动、免费攒**；定档提前周数**由玩家自选**；预售加成首周票房（上限 +40%） |
| 3 | 一次性结算时机 | **首轮下片时**结算成员成长/广告达标/IP 沉淀；最终 MP = 首轮下片时动态值；**再发行纯赚钱、不触发成长** |
| 4 | 下片 | 自动（周票房 <1 万地板）+ 硬上限周数兜底 + 手动；再发行**不定档不预售**，选更低档渠道下周直接开映 |
| 5 | IP 周边 | **热门度驱动、每周入账**；热门度随新片 MP 抬升 + 每周衰减；**取代旧季度授权** |
| 6 | 版权交易 | **固定总额分期到账**；电视剧/游戏两份独立版权可同时签；期满可再签；不消耗电影版权、续作照常 |
| 7 | 旧档迁移 | **旧已上映影片=彻底完结**（只读，不参与再发行）；旧 IP 迁出初始热门度并走周边/版权 |

## 3. 架构：项目即电影（方案一）

不引入独立 Film 实体。**已上映的项目记录本身成为电影的长效档案**：所有现有引用（IP.films 存项目 id、已上映详情页、公司历史、排行榜）继续用项目 id，改动面最小、迁移最顺。

- 阶段机 `preparing → shooting → editing → marketing → released` 不变；release 后 stage 恒为 `released`。
- 电影的「发行生命周期」由项目上新子状态 `run` 承载。

## 4. 状态与数据结构

### 4.1 FilmProject 新增（仅 released 项目）

```ts
run: {
  status: 'presale' | 'running' | 'idle' | 'finished'
  // presale=待映攒预售(定档到未来) / running=放映中(每周结算) / idle=已下片可再发行 / finished=彻底完结
  currentRunId: string | null
  runs: FilmRun[]          // 首轮 + 每段再发行
  releaseWeek: number      // 定档的正式变现周
  releaseYear: number
  presale: number          // 首轮预售累计（加成首周票房）
  firstRunEnded: boolean   // 首轮是否已下片（一次性结算只做一次）
}
currentMp: number          // 动态 MP（首轮每周更新；0~100）
currentAudience: number    // 动态观众口碑（0~10）
finalMp: number            // 首轮下片时锁定（成员成长/再发行用）
finalAudience: number
```

```ts
interface FilmRun {
  id: string
  channel: Channel
  isFirst: boolean
  config: { cinemaCount; webPlatforms: string[]; webWeeks; dvdPrice; freeAdPrice } // 渠道配置快照
  startWeek: number
  startYear: number
  endWeek?: number
  endYear?: number
  status: 'running' | 'ended'
  weekly: WeeklyBoxOffice[] // 每周一条
}

interface WeeklyBoxOffice {
  week: number
  year: number
  boxOffice: number   // 当周票房（万）
  revenue: number     // 当周片方分账（万）
  admissions?: number // 影院：观影人次（万）
  traffic?: number    // 网络/免费：播放量（万次）
  units?: number      // DVD：销量（万张）
  mp: number          // 当周结算用动态 MP
  audience: number    // 当周结算用动态口碑
}
```

### 4.2 FilmResult 变为"累计快照"

`p.result`（FilmResult）保留，语义改为**累计**：scores / criticScore / AP 固定；`boxOffice / revenue / admissions / dvdUnits / freeViews` = **全渠道累计值**，每周结算后更新。已上映详情页大部分直接复用。

### 4.3 IpAsset 新增

```ts
hotness: number          // 0~100 热门度
deals: CopyrightDeal[]   // 版权交易合同

interface CopyrightDeal {
  id: string
  kind: 'tv' | 'game'
  total: number    // 合同总额（万，签约时锁定）
  paid: number     // 已付
  weeks: number    // 合同期（tv 12 / game 20）
  weeksPaid: number
  status: 'active' | 'done'
  startWeek: number
  startYear: number
}
```

旧 `royaltyPerQuarter` 字段保留但不再参与结算；`royaltyEarned` 语义改为「周边累计收入」。

### 4.4 每周结算定位放映中影片

`advanceWeek` 里扫 `projects.filter(p => p.run?.status === 'running')`，无需额外索引。

## 5. 每周结算公式

**输入**（上映定档时 `computeFilmResult` 固定）：`basePotential`（无渠道 result.boxOffice）、初始 MP（0~100）、初始口碑（0~10）、影评/AP/六项分数（此后不变）。

### 5.1 首周票房（含预售）

```
expectedTotal = basePotential × channelMul(渠道配置)   // 复用现有 channelRevenue 倍数
week1 = expectedTotal × week1Share(渠道) × (1 + 预售加成)
预售加成 = min(0.4, presale / expectedTotal)
```

- week1Share = 1 − decayRate（保证中性反馈下整段总票房 ≈ expectedTotal，反馈环在此基础上上下扰动）：影院 0.45 / 网络 0.15 / DVD 0.10 / 免费 0.05。

### 5.2 每周衰减曲线

```
gross_n = gross_{n-1} × decayRate × hold_n   // hold 由反馈环给出
```

- decayRate（平衡时校）：影院 0.55（约 6 周）/ 网络 0.85（约 14 周）/ DVD 0.90（约 22 周）/ 免费 0.95（约 35 周）。
- 自动下片：当周 gross < 1 万；硬上限：影院 12 / 网络 30 / DVD 40 / 免费 52 周。

### 5.3 口碑/MP 反馈环

```
expected_n = gross_{n-1} × decayRate
overshoot = gross_n / expected_n                 // >1 = 超预期
Δ口碑 = clamp((overshoot - 1) × 2, -1.0, +1.0)
currentAudience = clamp(currentAudience + Δ口碑, 0, 10)
currentMp = clamp(currentMp + Δ口碑 × 6, 0, 100)
hold = clamp(1 + 0.4 × ((currentAudience − 初始口碑) + (currentMp − 初始MP)/8), 0.7, 1.3)
```

首轮下片时锁定 `finalMp / finalAudience`。

### 5.4 每周指标换算（复用现有 channelRevenue 换算）

- 影院：人次 = boxOffice ÷ 票价(40)；分账 = ×0.45
- 网络：播放量 = boxOffice ÷ 单次收益；分账 = ×0.6（现有"投放时长"加成倍数**并入曲线**，不再按周数加乘）
- DVD：张数 = boxOffice ÷ 单价（票房=张数×单价）；分账 = ×0.85
- 免费：播放量(万次) = boxOffice ÷ (广告单价/1000)；分账 = ×1
- 渠道成本在**开映当周一次性扣**。

### 5.5 再发行段

`week1 = 该渠道 expectedTotal × week1Share × 长尾系数(0.5)`，用 `finalMp/finalAudience` 固定输入跑同一条曲线——**不走反馈环、不更新口碑/MP**，无预售。

### 5.6 预售累计

待映期每周 `presale += hype × 系数`；同时 `hype ×= 0.95`（每周衰减）→ "早开映 vs 攒预售"权衡。

## 6. 下片 / 再发行状态机

```
定档确认 → [presale 待映·攒预售] ─到上映周→ [running 首轮放映] ─下片→ [idle 已下片·可再发行]
                                              ↑                            │ 选更低档渠道
                                              └────── [running 再发行] ◀────┘
                              免费档下片后 → [finished 彻底完结]
```

- **presale**：定档到未来周进入；每周攒预售 + hype 衰减；到 releaseWeek 自动转 running 并当周结算首周。
- **running**：每周按 §5 结算、追加 weekly。
- **下片触发**：① 周票房 < 1 万；② 达硬上限周数；③ 手动（放映页按钮，本周已结算收入保留）。
- **idle**：首轮下片在此做一次性结算；之后可再发行或放着（IP 周边/版权照常）。
- **再发行**：选严格更低档渠道（影院→网络/DVD/免费；网络→DVD/免费；DVD→免费），确认后下周开映，固定输入跑曲线；不可反悔改渠道。
- **finished**：免费档也下片后自动进入；或当前渠道无更低档且不再发行。此后仅留档案，无任何收益。

**首轮下片一次性结算**（`firstRunEnded` 防重）：
锁定 finalMp/finalAudience → 成员成长（applyProjectGrowth）→ 广告达标结算 → 声誉变化 → IP 沉淀/续作成长（累计票房持续累加影响等级；新 IP 的 hotness=finalMp 起跳，续作 hotness += (finalMp−50)×0.6）→ 推入 company.history。

**小默认**：定档确认后不可撤回/改期；crew 在定档确认时释放；投资人分成每周随收入按比例扣。

## 7. IP 热门度 / 周边 / 版权交易

- **热门度**：新片首轮下片抬升（新 IP hotness=finalMp；续作 +（finalMp−50）×0.6，clamp 0~100）；每周 `hotness ×= 0.98`（约 34 周腰斩，平衡时校）；旧档迁移 hotness = level×20。
- **周边收入（每周入账，仅 IP 系列）**：
  `周周边 = hotness × 0.15 × (1 + (level−1)×0.2) × (1 + merchBonus/100)`（万）
  入现金并累计到 royaltyEarned。
- **版权交易（玩家主动，仅 IP）**：
  - 入口：IP 详情 / 长尾页「出售电视剧版权」「出售游戏版权」。
  - 总额（签约锁定）：`total = base(kind) × (1 + (level−1)×0.5) × (0.5 + hotness/100)`，base：tv ~400 万 / game ~700 万。
  - 每周 `paid += total/weeks`（tv 12 周 / game 20 周），满期 done、可再签。
  - 同一 IP 同时至多各一份 tv + game；不消耗电影版权、续作照常。
- **小默认**：再发行收益不受热门度加成；非 IP 片只有再发行长尾。

## 8. 存档迁移

- **SAVE_VERSION 12 → 13**，migrate.ts 追加。
- 旧已上映影片（B）：`run={status:'finished', runs:[], firstRunEnded:true}`，`finalMp/finalAudience=旧 result.mp/audienceScore`；旧 result 只读；详情页显示"旧版已完结影片"，不开放再发行。
- 旧 IP：补 `hotness=level×20`、`deals=[]`，开始走周边/版权；royaltyPerQuarter 保留不再结算。
- company.history 旧 result 照旧。

## 9. 平衡与测试

- **长线回归需重校准**（收入从一次性改为每周回流，前期现金流更紧）：重新调 boxOfficeFactor / 渠道倍数 / 衰减曲线，使生命周期总票房 ≈ 现状；重跑 longrun（strong 12/12 IPO、weak 7/8 IPO、破产 1/8、平均 IPO 140 周基线）。
- **新增单测**：逐周曲线（首周峰值/单调递减/自动下片）；口碑反馈（超预期升/低于预期降/clamp）；预售；下片状态机（自动/手动/硬上限/一次性结算/渠道单调/免费后 finished）；IP（热门度抬升/衰减/周边公式/版权合同）；迁移 v12→v13。
- **铁律**：新随机只能属性派生，禁止新增 rng 消耗（避免种子序列偏移）。

## 10. UI 页面

- **已上映详情页改造**：新增「放映动态」区块——逐周曲线（票房 + 口碑/MP 走势）、状态徽标（待映预售中·剩余N周 / 放映中·第N周 / 已下片·可再发行 / 彻底完结）；放映中→「下片」按钮；已下片且有更低档→「再发行」面板。
- **新页面「长尾收益」**（左侧"电影管理"分组）：进行中放映 / 可再发行列表 / IP 周边收入趋势 / 版权合同（进行中 + 可签约）。
- **项目列表页**：已上映卡片显示运行状态徽标。
- 新闻：每周票房榜、下片、合同签署等。

## 11. 非目标（YAGNI，本期不做）

- 再发行收益与 IP 热门度联动。
- 定档改期/撤回、预售宣传投入（暂用免费热度驱动）。
- 档期季节性加成（暑期/春节等）。
- 独立 Film 实体 / 项目与电影分离。
- 长尾收益与 IPO 扩张的进一步联动（沿用现有 IPO 系数即可，如需再说）。
