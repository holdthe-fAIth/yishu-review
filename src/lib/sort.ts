import type { DoneEntry, FlatTopicVideo, ModuleInfo, TopicInfo } from '../types'

/**
 * 排序规则（用户需求 v2）：
 * - 已学完的模块 / 视频自动排到最后
 * - 没学的保持原有顺序（模块顺序 = 复习顺序，绝不重排）
 * 由设置项 `sortCompletedLast` 控制，默认开启。
 */

function isDone(done: Record<string, DoneEntry>, key: string): boolean {
  return Boolean(done[key])
}

/** 未学在前、已学在后（稳定排序） */
export function orderItems<T extends { key: string }>(
  items: T[],
  done: Record<string, DoneEntry>,
  enabled: boolean,
): T[] {
  if (!enabled) return items
  return [...items].sort(
    (a, b) => Number(isDone(done, a.key)) - Number(isDone(done, b.key)),
  )
}

export interface ModuleWithItems extends ModuleInfo {
  index: number
}

/** 已全部学完的模块排到最后；未学完的保持原复习顺序 */
export function orderModules<T extends ModuleWithItems>(
  modules: T[],
  done: Record<string, DoneEntry>,
  enabled: boolean,
): T[] {
  if (!enabled) return modules
  const complete = (module: T) =>
    module.items.length > 0 && module.items.every((item) => isDone(done, `s:${item.p}`))
  return [...modules].sort((a, b) => Number(complete(a)) - Number(complete(b)))
}

/** 合集内视频：未看在前、已看在后 */
export function orderTopicVideos(
  videos: FlatTopicVideo[],
  done: Record<string, DoneEntry>,
  enabled: boolean,
): FlatTopicVideo[] {
  return orderItems(videos, done, enabled)
}

/** 整个合集都刷完时，合集 tab 也排到最后 */
export function orderTopics<T extends TopicInfo>(
  topics: T[],
  done: Record<string, DoneEntry>,
  enabled: boolean,
): T[] {
  if (!enabled) return topics
  const complete = (topic: T) =>
    topic.videos.length > 0 &&
    topic.videos.every((video) => isDone(done, `t:${topic.seasonId}:${video.bvid}`))
  return [...topics].sort((a, b) => Number(complete(a)) - Number(complete(b)))
}

export function isTopicComplete(topic: TopicInfo, done: Record<string, DoneEntry>): boolean {
  return (
    topic.videos.length > 0 &&
    topic.videos.every((video) => isDone(done, `t:${topic.seasonId}:${video.bvid}`))
  )
}
