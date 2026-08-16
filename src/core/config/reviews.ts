import type { FilmType } from '../types'
import { FILM_TYPE_ZH } from './events'
import type { Rng } from '../rng'
import { pick } from '../rng'

/**
 * 评分文字评语（10 分制）：影评人视角 / 观众视角两组文案池。
 * 分数段：≥8.5 神作 / ≥7 佳作 / ≥6 及格 / ≥4.5 平庸 / <4.5 烂片。
 */
const CRITIC_TEXTS: Record<string, string[]> = {
  masterpiece: [
    '年度级别的作品，每个镜头都值得反复回味。',
    '类型标杆，表达精准而克制，堪称教科书。',
    '情感与技巧的双重胜利，几乎无可挑剔。',
  ],
  good: [
    '完成度很高，节奏与表演都在线，值得一看。',
    '扎实的类型片，亮点突出，略有瑕疵但瑕不掩瑜。',
    '导演手法成熟，几个场面令人印象深刻。',
  ],
  ok: [
    '中规中矩的合格作品，偶有亮点。',
    '看得到诚意，但执行层面有些生硬。',
    '及格线以上，适合消遣，难称惊艳。',
  ],
  meh: [
    '概念不错，可惜落地乏力。',
    '情节平淡，演员发挥受限，整体平庸。',
    '努力了，但离好片还有距离。',
  ],
  bad: [
    '槽点密集，叙事混乱，观感不佳。',
    '浪费了好题材，制作粗糙，不推荐。',
    '难以给出及格评价，各方面都差一口气。',
  ],
}

const AUDIENCE_TEXTS: Record<string, string[]> = {
  masterpiece: [
    '太好看了！全程无尿点，强烈推荐！',
    '值回票价，想二刷！',
    '看完久久不能平静，年度最佳预定。',
  ],
  good: [
    '挺好看的，剧情紧凑，演员给力。',
    '观感不错，值得去电影院看。',
    '有笑有泪，朋友聚会首选。',
  ],
  ok: [
    '还行吧，无聊时可以看看。',
    '中规中矩，没有惊喜也不难看。',
    '能看，但不会主动推荐。',
  ],
  meh: [
    '有点失望，期待值拉太高了。',
    '节奏太慢，中间差点睡着。',
    '一般般，感觉没拍出感觉。',
  ],
  bad: [
    '太差了，浪费了我的时间。',
    '槽点太多，看完只想吐槽。',
    '不推荐，全程尴尬。',
  ],
}

function bandOf(score: number): string {
  if (score >= 8.5) return 'masterpiece'
  if (score >= 7) return 'good'
  if (score >= 6) return 'ok'
  if (score >= 4.5) return 'meh'
  return 'bad'
}

/** 生成一条评分评语（可带类型名点缀） */
export function generateReviewText(rng: Rng, score: number, type: FilmType, audience = false): string {
  const pool = (audience ? AUDIENCE_TEXTS : CRITIC_TEXTS)[bandOf(score)]
  const base = pick(rng, pool)
  // 约 1/3 概率在句首带上类型视角
  if (rng() < 0.33) {
    const lead = audience ? '作为一部{F}片，' : '就{F}类型而言，'
    return `${lead.replace('{F}', FILM_TYPE_ZH[type])}${base}`
  }
  return base
}
