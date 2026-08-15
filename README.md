# 星光影业 FlashMovie

网页端电影公司模拟经营游戏（V1 开发中）。

## 运行

需要 Node.js ≥ 20（本机使用 Homebrew 的 node@26，路径 `/opt/homebrew/opt/node/bin`）。

```bash
npm install                 # 若 ~/.npm 权限异常：npm install --cache ./.npm-cache
npm run dev                 # 开发服务器 → http://localhost:5173
npm test                    # 运行规则层单测（vitest）
npm run build               # 类型检查 + 生产构建（dist/）
```

## 文档

| 文档 | 说明 |
|---|---|
| `docs/Preparation.md` | 源概念文档（英文粗纲） |
| `docs/GDD.md` | 游戏设计文档（完整愿景 + 分阶段路线图） |
| `docs/ARCHITECTURE.md` | V1 架构设计（分层/模块/数据流/技术选型/实施计划） |

## 架构速览

```
UI 层（React + zustand）        src/ui、src/app
规则层 core（纯 TS 可单测）      src/core
  ├─ types      领域类型
  ├─ config     数值配置表（全部可调）
  ├─ state      状态容器（reducer + 初始状态）
  ├─ rules      纯函数：评分/票房/成长
  ├─ tick       周推进（项目状态机/事件/市场刷新）
  ├─ generators 员工/剧本生成（种子随机）
  └─ save       存档（IndexedDB + 版本迁移）
```

## V1 玩法闭环（已实现）

剧本市场购买 / 签约编剧 → 雇佣员工（导演/演员/摄影/剪辑/市场）→ 组队立项（VFX/植入广告）→ 拍摄（随机事件 + 小游戏 Buff）→ 剪辑取向 → 宣发 → 上映结算（AP/MP/票房/成员成长）。

## 当前进度

- [x] P0 脚手架（Vite + React + TS + zustand + vitest）
- [x] P1–P4 核心引擎（类型/配置/状态/tick/规则/存档 + 26 项单测）
- [x] P5–P11 界面（公司/剧本市场/员工/组队/项目详情）
- [x] P12 数值平衡冒烟（三连拍现金流测试）
- [ ] 打磨：新手引导、视觉润色、V2 系统（见 GDD 路线图）
