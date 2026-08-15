/** 可种子随机：mulberry32（确定性，便于测试与复现） */
export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [min, max] 闭区间整数 */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** 按权重抽取：items 为 [权重, 值] 列表 */
export function weightedPick<T>(rng: Rng, items: ReadonlyArray<readonly [number, T]>): T {
  const total = items.reduce((s, [w]) => s + w, 0)
  let r = rng() * total
  for (const [w, v] of items) {
    r -= w
    if (r <= 0) return v
  }
  return items[items.length - 1][1]
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10
}
