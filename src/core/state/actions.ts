import type { Channel, RoleId, TeamAssignments, TimingQuality, RunChannelConfig } from '../types'
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
  // 院线管理：投钱自建影院（数量无上限，全国总数 = 基础 5178 + 自建数）
  | { type: 'buildCinemas'; count: number }
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
  // 作弊开关：员工 CA 不衰退（成长照常）；关闭 = 正常衰退/成长
  | { type: 'toggleNoCaDecay' }
  // 定档上映：weeks = 提前周数（0 = 本周立即上映），进入放映/预售
  | { type: 'release'; projectId: string; weeks: number }
  // 手动下片：结束当前放映段（本周已结算收入保留）
  | { type: 'endRun'; projectId: string }
  // 再发行：选择严格更低档渠道，下周开映（不定档不预售）；config 缺省用渠道默认参数
  | { type: 'rerelease'; projectId: string; channel: Channel; config?: Partial<RunChannelConfig> }
  // 版权交易：把 IP 版权卖给电视剧/游戏公司（固定总额每周分期）
  | { type: 'sellCopyright'; ipId: string; kind: 'tv' | 'game' }
  // 取消未上映项目：投入不退、剧组人员释放回员工池
  | { type: 'cancelProject'; projectId: string }
  // NPC 挖角：玩家挖对手员工（一次性签字费 offer 万，成功率看报价/声誉差）
  | { type: 'poachCompetitorWorker'; competitorId: string; workerId: string; offer: number }
  // 回应对手挖角：keep=true 付签字费挽留 / false 放人（员工跳槽至对手团队）
  | { type: 'respondPoach'; keep: boolean }
