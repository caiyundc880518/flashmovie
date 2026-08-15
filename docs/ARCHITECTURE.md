# 《星光影业》FlashMovie — V1 架构设计（ARCHITECTURE）

> 版本：v0.1（草稿） · 日期：2026-08-15
> 上游：`docs/GDD.md`（V1 MVP 范围）· 技术基线：纯前端单机、React + Vite + zustand

---

## 1. 核心命题（Key Challenges）

V1 只做"一部电影的完整闭环"，决定系统生死的技术难题如下：

| # | 技术挑战 | 深度剖析 |
|---|---|---|
| C1 | 状态与存档一致性 | 整个游戏 = 一个可序列化的状态对象；存档 = 状态 JSON（IndexedDB）。状态对象必须 100% 可序列化（无函数/无循环引用），UI 层状态不得混入核心状态 |
| C2 | tick 推进的确定性 | "推进一周"是唯一时间入口，产出事件列表供 UI 展示；周/月/年结算钩子挂载点清晰。随机使用可种子化 RNG，便于测试与复现 bug |
| C3 | 规则层可测性 | 评分/票房/成长公式全部为纯函数；权重与系数全部走配置表；用 vitest 对规则层做单测（含配置表快照） |
| C4 | UI 与规则解耦 | React 只读状态 + 派发 action；zustand 做桥接。大状态（数百员工）下用 selector 精确订阅，避免全量重渲染 |
| C5 | 多项目并行复杂度 | 多部电影可并行筹备/拍摄/剪辑/宣发。用显式项目状态机（idle→preparing→shooting→editing→marketing→released）控制复杂度 |
| C6 | 数值防死局 | V1 就要内置保底：破产保护（可出售剧本/版权/裁员），确保最坏情况不出现不可逆死局 |

---

## 2. 模块划分（Modularization）

```
┌─────────────────────────────────────────────┐
│  UI 层（React）                              │
│   screens / components / store(zustand)     │
│   只读状态 + 派发 action                     │
└───────────────┬─────────────────────────────┘
                │ dispatch(action)
┌───────────────▼─────────────────────────────┐
│  规则层 core（纯 TS，框架无关，可单测）         │
│   state(reducer) → rules(纯函数) → tick       │
│   config(配置表) · rng(可种子随机)             │
└───────────────┬─────────────────────────────┘
                │ 新状态（不可变更新）
┌───────────────▼─────────────────────────────┐
│  数据层 save（schema/migrate/storage）        │
│  IndexedDB 持久化（防抖）                     │
└─────────────────────────────────────────────┘
```

**依赖方向**：UI → core → save；core 不依赖 UI。core 内：types/config 被一切引用，rules 只依赖 types/config，tick 依赖 rules，save 只依赖 state。

---

## 3. 数据流闭环（Lifecycle）

**常规操作**（如购买剧本）：
```
用户点击"购买剧本"
 → dispatch({type:'buy_script', scriptId})
 → core reducer 纯函数 → 新状态
 → zustand store 更新 → React selector 订阅渲染
 → 存档适配器（防抖 2s）→ IndexedDB
```

**推进一周**（特殊流程）：
```
用户点击"推进一周"
 → dispatch({type:'advance_week'})
 → core.tick 依次执行：项目阶段推进 → 员工成长/衰减 → 月度/年度结算钩子 → 随机事件生成
 → 返回 { state, events[] }
 → UI 逐个展示事件（EventModal，选项 2–3 选 1）
 → 年度第 52 周 → 年度结算 + 趋势刷新
```

**读取存档**：启动 → storage.load() → migrate(版本迁移) → 状态注入 store。

---

## 4. 技术选型（Tech Stack）

| 层 | 选型 | 理由 |
|---|---|---|
| 构建 | Vite | 秒级 HMR，纯前端静态产物 |
| 语言 | TypeScript（strict） | 领域类型（Worker/Script/Film…）是核心资产 |
| 框架 | React 18 | 生态最大，管理面板类 UI 范例多 |
| 状态桥接 | zustand | 轻量、selector 订阅可避免全量渲染 |
| 持久化 | idb-keyval（IndexedDB） | 存取整个状态 JSON，版本化迁移 |
| 测试 | vitest | 规则层纯函数单测 + 配置表快照 |
| UI 组件 | 自写（CSS Modules） | 扁平编辑风需完全可控，不用组件库以免风格被带偏 |
| 随机 | 自写种子 RNG（mulberry32） | 可复现、可测试 |

**明确不做**（V1）：后端、网络、账号、Canvas 渲染、动画库、UI 组件库、i18n。

---

## 5. 目录结构（Directory）

```
FlashMovie/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ README.md
├─ docs/
│  ├─ Preparation.md
│  ├─ GDD.md
│  └─ ARCHITECTURE.md
└─ src/
   ├─ main.tsx
   ├─ app/                        # 应用壳（入口、布局、全局样式）
   │  ├─ App.tsx
   │  └─ styles/global.css
   ├─ core/                       # 规则层（框架无关，纯 TS）
   │  ├─ types/                   # 领域类型
   │  │  ├─ company.ts            # 公司/财务
   │  │  ├─ calendar.ts           # 年/月/周
   │  │  ├─ worker.ts             # 员工（属性/技能/履历）
   │  │  ├─ script.ts             # 剧本
   │  │  ├─ film.ts               # 电影项目/成片/结算
   │  │  ├─ world.ts              # 世界（市场/新闻/事件）
   │  │  └─ index.ts
   │  ├─ config/                  # 数值配置表（全部可调）
   │  │  ├─ weights.ts            # 评分权重
   │  │  ├─ economy.ts            # 成本/贷款/利率/保底
   │  │  ├─ growth.ts             # 成长/衰减曲线
   │  │  ├─ scripts.ts            # 剧本池（V1 预置）
   │  │  ├─ events.ts             # 随机事件定义池
   │  │  ├─ roles.ts              # 9 职位定义
   │  │  └─ names.ts              # 员工名生成
   │  ├─ state/
   │  │  ├─ initialState.ts       # 新档初始状态
   │  │  ├─ actions.ts            # action 类型定义（判别联合）
   │  │  └─ reducer.ts            # reduce(action, state) → state
   │  ├─ rules/                   # 纯函数计算
   │  │  ├─ scoring.ts            # 成片评分（六分项/AP/MP/VFX/Specific）
   │  │  ├─ boxOffice.ts          # 票房与渠道收入
   │  │  ├─ growth.ts             # 员工经验/技能/衰减
   │  │  ├─ economy.ts            # 收支/贷款/破产保底
   │  │  └─ chemistry.ts          # 化学反应（V1 简化）
   │  ├─ tick/
   │  │  └─ advance.ts            # 周推进：项目状态机+成长+结算钩子+事件
   │  ├─ rng.ts                   # 种子随机（mulberry32）
   │  └─ save/
   │     ├─ schema.ts             # 存档版本常量
   │     ├─ migrate.ts            # 版本迁移链
   │     └─ storage.ts            # idb-keyval 封装（防抖）
   ├─ ui/
   │  ├─ store/
   │  │  └─ gameStore.ts          # zustand：状态快照 + dispatch + 存档钩子
   │  ├─ screens/
   │  │  ├─ CompanyScreen.tsx     # 公司主界面（日历+项目+事件队列）
   │  │  ├─ ScriptMarketScreen.tsx# 剧本市场 + 签约编剧
   │  │  ├─ WorkersScreen.tsx     # 员工列表/详情/招募
   │  │  ├─ TeamBuildScreen.tsx   # 组队（职位槽+选角匹配）
   │  │  ├─ ShootingScreen.tsx    # 拍摄（场次/随机事件/小游戏）
   │  │  ├─ EditingScreen.tsx     # 剪辑（风格二选一+成片预览）
   │  │  ├─ MarketingScreen.tsx   # 宣发（预算滑块+投放）
   │  │  └─ ReleaseScreen.tsx     # 发行结算（影院票房+财报）
   │  ├─ components/              # 原子组件
   │  │  ├─ PosterCard.tsx        # 电影海报卡片
   │  │  ├─ WorkerCard.tsx
   │  │  ├─ RadarChart.tsx        # 属性雷达图
   │  │  ├─ WeekCalendar.tsx      # 周历/档期标注
   │  │  ├─ EventModal.tsx        # 随机事件弹窗（2–3 选 1）
   │  │  ├─ MoneyText.tsx         # 金额格式化
   │  │  └─ Bar.tsx               # 进度条/滑块
   │  └─ styles/                  # CSS Modules
   └─ core/__tests__/             # 规则层单测（scoring/boxOffice/growth/tick）
```

---

## 6. V1 领域模型速览（核心实体）

```
Company { cash, reputation, loans, ownedScripts[], employees[], projects[], history[] }
Calendar { year, month, week }            # 1–52 周
Worker { id, name, role, basic(PA/CA/Fame…), mental[], physical[], active(Mood/Volume),
         skills{act,direct,shoot,edit,market,technical,advertise,vfx}, contract, history[] }
Script { id, title, type, storyPoint, artPot, marketPot, famePoint, trend, scale,
         requirement{genders,ages,minExp}, cost, owner }
FilmProject { id, scriptId, stage: idle|preparing|shooting|editing|marketing|released,
              team{producer,director,writer,actor[],shooter,editor,technician,market,assistant},
              stages[], vfxPercent, adDeals[], hype, progress }
FilmResult { scores{story,music,edit,acting,shooting,directing}, vfx, specific, ap, mp,
             boxOffice, groupPerformance[], awards[] }
```

**项目状态机**：`preparing → shooting → editing → marketing → released`；每阶段由 tick 驱动推进（进度 + 阶段内决策），阶段完成进入下一阶段，released 触发结算。

---

## 7. V1 实施计划（Phases）

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| P0 | 脚手架：Vite+React+TS+zustand+vitest，目录骨架，空壳 App | `npm run dev` 可跑，`npm test` 有示例单测 |
| P1 | 领域类型 + 配置表（weights/economy/growth/scripts/events/roles/names） | 类型无 any、配置表有默认值 |
| P2 | 状态容器：initialState + actions + reducer + 存档（schema/migrate/storage） | 状态可序列化↔反序列化，版本迁移单测通过 |
| P3 | tick：advance_week 状态机 + 月度/年度结算钩子 + 事件队列 | 单测：推进 52 周状态合法、结算正确 |
| P4 | 员工生成器 + 剧本池生成器（种子随机） | 单测：属性范围合法、剧本要求可满足 |
| P5 | 公司主界面：周历 + 项目列表 + 现金 + 事件队列 | 能显示状态、能推进一周 |
| P6 | 剧本市场：购买/签约编剧/周产剧本入库 | 购买扣款、编剧周产、库存可见 |
| P7 | 员工：招募列表/详情（雷达图）/外聘与雇佣 | 能招人、属性展示正确 |
| P8 | 组队：职位槽 + 选角匹配 + 立项（预算确认） | 匹配度提示正确、立项成功 |
| P9 | 拍摄：场次分配（Director 自动）+ 随机事件 + 简化小游戏（单键时机） | 拍摄进度推进、事件可选、小游戏给 Buff |
| P10 | 剪辑：风格二选一 + 成片预览（各分项预测） | 预测与结算一致（同一公式） |
| P11 | 宣发（预算滑块+投放）+ 发行结算（影院票房/财报/防死局保底） | 全流程可玩：立项→上映→结算闭环 |
| P12 | 数值平衡（试玩一轮校准）+ 单测补全 + 打磨 | 完整一局不卡死、不破产死局，存档可读回 |

**交付顺序原则**：P2/P3 先行（核心引擎），界面从简到全；每个阶段结束都有可运行版本。

---

*（本文档为架构草稿 v0.1，待用户确认后进入 P0 脚手架。）*
