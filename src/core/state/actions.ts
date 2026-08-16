import type { Channel, TeamAssignments } from '../types'

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
  | { type: 'startProject'; scriptId: string; team: TeamAssignments; vfxPercent: number; hasAd: boolean; ipId?: string }
  | { type: 'startShooting'; projectId: string }
  | { type: 'chooseEditStyle'; projectId: string; style: 'market' | 'art' }
  | { type: 'setMarketingBudget'; projectId: string; budget: number }
  | { type: 'launchMarketing'; projectId: string }
  | { type: 'applyShotBuff'; projectId: string; quality: 'perfect' | 'good' | 'miss' }
  | { type: 'applyEditBuff'; projectId: string; quality: 'perfect' | 'good' | 'miss' }
  | { type: 'resolveEvent'; projectId: string; eventId: string; optionIndex: number }
  | { type: 'setChannels'; projectId: string; channels: Channel[] }
  | { type: 'selectPublisher'; projectId: string; publisherId: string }
  | { type: 'upgradeSchool' }
  | { type: 'signInvestor'; investorId: string }
  | { type: 'release'; projectId: string }
