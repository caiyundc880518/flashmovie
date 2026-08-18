import type { Channel, RoleId, TeamAssignments, TimingQuality } from '../types'
import type { RecruitPoolId } from '../config/recruit'
import type { WriterPoolId } from '../config/writers'
import type { BudgetAlloc } from '../config/budget'

/** 玩家动作（判别联合） */
export type Action =
  | { type: 'advanceWeek' }
  | { type: 'buyScript'; scriptId: string }
  | { type: 'sellScript'; scriptId: string }
  | { type: 'hireWriter' }
  | { type: 'hireWorker'; candidateId: string }
  | { type: 'hireCandidates'; candidateIds: string[] }
  | { type: 'fireWorker'; workerId: string }
  | { type: 'refreshCandidates'; pool: RecruitPoolId; count: 1 | 10; role?: RoleId }
  | { type: 'drawScripts'; pool: WriterPoolId; count: 1 | 10 }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; loanId: string }
  | { type: 'startProject'; scriptId: string; team: TeamAssignments; budgetAlloc: BudgetAlloc; vfxLevel: number; adSponsorIds: string[]; ipId?: string }
  | { type: 'startShooting'; projectId: string }
  // 筹备：投入预热成本（对 MP 加成，无上限）
  | { type: 'setWarmup'; projectId: string; amount: number }
  // 拍摄：小游戏（被动触发，必须完成才能继续推进）
  | { type: 'applyShotGame'; projectId: string; qualities: TimingQuality[] }
  // 剪辑：小游戏（必须完成才能推进）
  | { type: 'applyEditGame'; projectId: string; qualities: TimingQuality[] }
  | { type: 'chooseEditStyle'; projectId: string; style: 'market' | 'art' }
  // 宣发：单选发行渠道 + 各渠道参数
  | { type: 'setChannel'; projectId: string; channel: Channel }
  | { type: 'setCinemaCount'; projectId: string; count: number }
  | { type: 'setWebConfig'; projectId: string; platforms: string[]; weeks: number }
  | { type: 'setDvdPrice'; projectId: string; price: number }
  | { type: 'setFreeAdPrice'; projectId: string; price: number }
  | { type: 'applyShotBuff'; projectId: string; quality: 'perfect' | 'good' | 'miss' }
  | { type: 'applyEditBuff'; projectId: string; quality: 'perfect' | 'good' | 'miss' }
  | { type: 'resolveEvent'; projectId: string; eventId: string; optionIndex: number }
  | { type: 'setTargetRegion'; projectId: string; region?: string }
  | { type: 'upgradeSchool' }
  | { type: 'signInvestor'; investorId: string }
  | { type: 'investTech'; lineId: string }
  | { type: 'ipo' }
  | { type: 'cheatSpawnWorker'; role: RoleId }
  | { type: 'release'; projectId: string }
  // 取消未上映项目：投入不退、剧组人员释放回员工池
  | { type: 'cancelProject'; projectId: string }
