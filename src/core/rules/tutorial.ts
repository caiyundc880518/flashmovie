import type { GameState } from '../types'

/** 新手引导步骤定义（UI 与进度判定共用） */
export interface TutorialStepDef {
  id: number
  title: string
  /** 前往的导航页（App 的 NavKey） */
  page: 'company' | 'marketScripts' | 'recruit' | 'team' | 'projects'
  /** 完成说明 */
  hint: string
}

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 1,
    title: '建立班底',
    page: 'recruit',
    hint: '去「招聘」页雇佣 1 名员工（导演 / 演员 / 摄影 / 剪辑 / 市场皆可）。',
  },
  {
    id: 2,
    title: '储备剧本',
    page: 'marketScripts',
    hint: '去「剧本市场」购买 1 个剧本；或在「公司」页签约编剧长期产出。',
  },
  {
    id: 3,
    title: '组建剧组',
    page: 'team',
    hint: '在「组队立项」页选择剧本、填写成员槽位，完成立项。',
  },
  {
    id: 4,
    title: '完成首部影片',
    page: 'projects',
    hint: '去「项目」页开拍 → 剪辑 → 宣发 → 上映，收获首笔票房。',
  },
  {
    id: 5,
    title: '拓展经营',
    page: 'company',
    hint: '探索发行渠道、科技研发、IP 系列化、地区市场，冲刺 IPO 上市。',
  },
]

/**
 * 派生当前引导进度（0–5）：
 * 0 无员工 → 1 有员工 → 2 有剧本 → 3 已立项 → 4 已上映 → 5 上映满 3 部
 */
export function tutorialStep(state: GameState): number {
  if (state.company.employeeIds.length >= 1) {
    if (state.company.ownedScriptIds.length >= 1) {
      if (state.projects.length >= 1) {
        if (state.company.history.length >= 1) {
          return state.company.history.length >= 3 ? 5 : 4
        }
        return 3
      }
      return 2
    }
    return 1
  }
  return 0
}
