import type { TeamAssignments } from '../types'

/** 玩家动作（判别联合） */
export type Action =
  | { type: 'advanceWeek' }
  | { type: 'buyScript'; scriptId: string }
  | { type: 'sellScript'; scriptId: string }
  | { type: 'hireWriter' }
  | { type: 'hireWorker'; candidateId: string }
  | { type: 'fireWorker'; workerId: string }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; loanId: string }
  | { type: 'startProject'; scriptId: string; team: TeamAssignments; vfxPercent: number; hasAd: boolean }
  | { type: 'startShooting'; projectId: string }
  | { type: 'chooseEditStyle'; projectId: string; style: 'market' | 'art' }
  | { type: 'setMarketingBudget'; projectId: string; budget: number }
  | { type: 'launchMarketing'; projectId: string }
  | { type: 'applyShotBuff'; projectId: string; success: boolean }
  | { type: 'resolveEvent'; projectId: string; eventId: string; optionIndex: number }
  | { type: 'release'; projectId: string }
