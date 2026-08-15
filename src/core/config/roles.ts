import type { RoleId, SkillKey } from '../types'

export interface RoleDef {
  id: RoleId
  nameZh: string
  nameEn: string
  /** 该职位对成片贡献所依赖的技能（无则 null） */
  skill: SkillKey | null
  /** V1 剧组是否必须配置 */
  required: boolean
  /** 一句话职责（UI 提示用） */
  duty: string
}

export const ROLES: Record<RoleId, RoleDef> = {
  producer: {
    id: 'producer',
    nameZh: '制片人',
    nameEn: 'Producer',
    skill: null,
    required: false,
    duty: '寻找更优剧本与档期、节省制作成本',
  },
  director: {
    id: 'director',
    nameZh: '导演',
    nameEn: 'Director',
    skill: 'direct',
    required: true,
    duty: '带队，决定成片 AP/MP 导向，自动生成场次分配',
  },
  writer: {
    id: 'writer',
    nameZh: '编剧',
    nameEn: 'Writer',
    skill: null,
    required: false,
    duty: '产出剧本（本片编剧可空，剧本已在手即可）',
  },
  actor: {
    id: 'actor',
    nameZh: '演员',
    nameEn: 'Actor',
    skill: 'act',
    required: true,
    duty: '出演并贡献人气（需匹配剧本要求）',
  },
  shooter: {
    id: 'shooter',
    nameZh: '摄影',
    nameEn: 'Shooter',
    skill: 'shoot',
    required: true,
    duty: '控制镜头，拍摄小游戏增益载体',
  },
  editor: {
    id: 'editor',
    nameZh: '剪辑',
    nameEn: 'Editor',
    skill: 'edit',
    required: true,
    duty: '让成片更可看，剪辑 Buff',
  },
  technician: {
    id: 'technician',
    nameZh: '技术',
    nameEn: 'Technician',
    skill: 'technical',
    required: false,
    duty: '升级设备/VFX 技能（V1 暂缓）',
  },
  market: {
    id: 'market',
    nameZh: '市场',
    nameEn: 'Market',
    skill: 'market',
    required: true,
    duty: '宣发与销售，影响 Hype 与最终 MP',
  },
  assistant: {
    id: 'assistant',
    nameZh: '助理',
    nameEn: 'Assistant',
    skill: null,
    required: false,
    duty: '自动化日常管理（V1 暂缓）',
  },
}

/** 各职位周薪基数（万元），实际 = 基数 + 技能×技能薪资系数 */
export const BASE_SALARY_BY_ROLE: Record<RoleId, number> = {
  producer: 8,
  director: 10,
  writer: 4,
  actor: 6,
  shooter: 5,
  editor: 5,
  technician: 5,
  market: 6,
  assistant: 3,
}
