import type { ProjectEventOption } from '../types'

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
