import type { FilmType, ProjectEventOption } from '../types'

/**
 * 拍摄随机事件池（V1 精简版，GDD §3.3）
 */
export interface EventDef {
  kind: 'actor' | 'director' | 'vfx' | 'chemistry' | 'news' | 'trend'
  title: string
  desc: string
  /** 抽取权重 */
  weight: number
  options: ProjectEventOption[]
}

/** core 侧类型中文名（随机事件文案用；UI 另有 format.TYPE_ZH） */
export const FILM_TYPE_ZH: Record<FilmType, string> = {
  comedy: '喜剧',
  horror: '恐怖',
  action: '动作',
  love: '爱情',
  war: '战争',
  drama: '剧情',
}

export const SHOOTING_EVENTS: EventDef[] = [
  {
    kind: 'actor',
    title: '演员状态不佳',
    desc: '主演连续熬夜，状态下滑，拍摄进度受阻。',
    weight: 3,
    options: [
      { label: '停工休息一天', cash: -10, morale: 8, buff: 3 },
      { label: '硬着头皮继续拍', cash: 0, morale: -10, buff: -3 },
    ],
  },
  {
    kind: 'actor',
    title: '主演绯闻曝光',
    desc: '主演被媒体拍到绯闻，热度上升但片场分心。',
    weight: 2,
    options: [
      { label: '借势炒作', hype: 15, morale: -5 },
      { label: '冷处理，专注拍摄', hype: 5, buff: 2 },
    ],
  },
  {
    kind: 'director',
    title: '导演与编剧意见分歧',
    desc: '导演想改结局，编剧坚持原案，片场气氛紧张。',
    weight: 3,
    options: [
      { label: '支持导演（改结局）', cash: -15, buff: 4 },
      { label: '支持编剧（保原案）', cash: 0, buff: -2, morale: 5 },
    ],
  },
  {
    kind: 'vfx',
    title: '特效预算超支',
    desc: '特效团队报告预算不够，需要追加或削减特效场面。',
    weight: 2,
    options: [
      { label: '追加预算', cash: -40, buff: 5 },
      { label: '削减特效场面', cash: 0, buff: -5, ap: -3 },
    ],
  },
  {
    kind: 'chemistry',
    title: '剧组内讧',
    desc: '摄影与剪辑互相指责对方拖延进度，士气低落。',
    weight: 2,
    options: [
      { label: '出面调解', cash: -5, morale: 8 },
      { label: '各打五十大板', cash: 0, morale: -8 },
    ],
  },
  {
    kind: 'news',
    title: '行业利好消息',
    desc: '媒体报道电影市场回暖，观众观影意愿上升。',
    weight: 2,
    options: [
      { label: '顺势加码宣发', cash: -20, hype: 10 },
      { label: '按兵不动', cash: 0, hype: 3 },
    ],
  },
  {
    kind: 'trend',
    title: '类型潮流突变',
    desc: '市场风向变化，本片的类型突然不再流行。',
    weight: 1,
    options: [
      { label: '紧急调整宣发话术', cash: -10, hype: 6 },
      { label: '坚持原计划', cash: 0, hype: -8 },
    ],
  },
]

/**
 * 行业/公司随机事件池（GDD §6 Random Events：经济/行业/技术/丑闻/奖励/补贴）
 * 持续型（boom/slump/typeBoom/tech）写入 world.activeEvents；
 * 即时型（scandal/praise/grant）触发时立即结算。
 */
export interface IndustryEventDef {
  kind: 'boom' | 'slump' | 'typeBoom' | 'tech' | 'scandal' | 'praise' | 'grant'
  title: string
  desc: string
  weight: number
  /** 持续型：持续周数范围 */
  weeks?: [number, number]
  /** 全局票房乘数 */
  boxOfficeMul?: number
  /** 类型热潮乘数（作用于随机抽取的类型） */
  typeBoomMul?: number
  /** 技术突破：VFX 分加成比例 */
  vfxBonus?: number
  /** 即时型：员工 Fame 变化 */
  fame?: number
  /** 即时型：员工心情变化 */
  mood?: number
  /** 即时型：公司现金变化（万） */
  cash?: number
}

export const INDUSTRY_EVENTS: IndustryEventDef[] = [
  {
    kind: 'boom',
    title: '电影市场大热',
    desc: '暑期档观影热情高涨，全行业票房走高。',
    weight: 3,
    weeks: [6, 10],
    boxOfficeMul: 1.15,
  },
  {
    kind: 'slump',
    title: '行业寒潮',
    desc: '经济下行，观众观影意愿低迷，票房承压。',
    weight: 3,
    weeks: [6, 10],
    boxOfficeMul: 0.85,
  },
  {
    kind: 'typeBoom',
    title: '类型热潮',
    desc: '一部现象级大片带动了该类型的观影热潮。',
    weight: 2,
    weeks: [6, 10],
    typeBoomMul: 1.25,
  },
  {
    kind: 'tech',
    title: '渲染技术突破',
    desc: '行业发布新一代渲染方案，特效制作效率大增。',
    weight: 2,
    weeks: [6, 10],
    vfxBonus: 0.15,
  },
  {
    kind: 'scandal',
    title: '明星丑闻',
    desc: '旗下某位高知名度员工卷入丑闻，形象受损。',
    weight: 2,
    fame: -10,
    mood: -15,
  },
  {
    kind: 'praise',
    title: '员工获奖',
    desc: '旗下某位员工获行业大奖，声名鹊起。',
    weight: 2,
    fame: 8,
    mood: 10,
  },
  {
    kind: 'grant',
    title: '政府补贴',
    desc: '政府出台影视扶持政策，公司获得一笔补贴。',
    weight: 1,
    cash: 200,
  },
]
