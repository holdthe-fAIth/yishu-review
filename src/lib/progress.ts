import { DURATION_BY_KEY, type SubjectView } from '../data'
import type { AppState, DoneEntry, FlatSystemItem } from '../types'

export interface ModuleStat {
  module: SubjectView['modules'][number]
  index: number
  done: number
  total: number
  ratio: number
  secondsDone: number
}

export interface TotalProgress {
  done: number
  total: number
  ratio: number
  secondsDone: number
}

/** 某个科目每个模块的完成情况（按 modules 原顺序） */
export function moduleStats(
  subject: SubjectView,
  done: Record<string, DoneEntry>,
): ModuleStat[] {
  return subject.modules.map((module, index) => {
    const items = subject.systemItems.filter((item) => item.moduleId === module.id)
    let doneCount = 0
    let secondsDone = 0
    for (const item of items) {
      if (done[item.key]) {
        doneCount += 1
        secondsDone += item.duration
      }
    }
    return {
      module,
      index,
      done: doneCount,
      total: items.length,
      ratio: items.length === 0 ? 0 : doneCount / items.length,
      secondsDone,
    }
  })
}

export function moduleStat(
  subject: SubjectView,
  done: Record<string, DoneEntry>,
  moduleIndex: number,
): ModuleStat {
  return moduleStats(subject, done)[moduleIndex]
}

/** 某个科目的系统课总进度 */
export function totalSystemProgress(
  subject: SubjectView,
  done: Record<string, DoneEntry>,
): TotalProgress {
  let doneCount = 0
  let secondsDone = 0
  for (const item of subject.systemItems) {
    if (done[item.key]) {
      doneCount += 1
      secondsDone += item.duration
    }
  }
  return {
    done: doneCount,
    total: subject.totalKp,
    ratio: subject.totalKp === 0 ? 0 : doneCount / subject.totalKp,
    secondsDone,
  }
}

/** 某个科目系统课里按模块顺序第一个没打勾的知识点（「继续复习」的目标） */
export function firstUnfinished(
  subject: SubjectView,
  done: Record<string, DoneEntry>,
): FlatSystemItem | undefined {
  return subject.systemItems.find((item) => !done[item.key])
}

/** 某个科目已完成的专题视频数 */
export function topicDoneCount(
  subject: SubjectView,
  done: Record<string, DoneEntry>,
): number {
  return subject.topicVideos.reduce((n, v) => n + (done[v.key] ? 1 : 0), 0)
}

/** 某个科目单个专题合集的完成情况 */
export function topicStat(
  subject: SubjectView,
  done: Record<string, DoneEntry>,
  seasonId: number,
): { done: number; total: number; ratio: number } {
  const videos = subject.topicVideos.filter((v) => v.seasonId === seasonId)
  const doneCount = videos.reduce((n, v) => n + (done[v.key] ? 1 : 0), 0)
  return {
    done: doneCount,
    total: videos.length,
    ratio: videos.length === 0 ? 0 : doneCount / videos.length,
  }
}

/** 所有科目的已看视频数 */
export function watchedCount(done: Record<string, DoneEntry>): number {
  return Object.keys(done).length
}

/** 所有科目的累计视频时长（已完成视频 duration 之和，秒） */
export function watchedSeconds(done: Record<string, DoneEntry>): number {
  let total = 0
  for (const [key, entry] of Object.entries(done)) {
    if (!entry) continue
    total += DURATION_BY_KEY[key] ?? 0
  }
  return total
}

/** 连续打卡天数：按 done.at 的本地日期去重，从今天（或昨天）往前数 */
export function streakDays(done: Record<string, DoneEntry>, now = Date.now()): number {
  const days = new Set<string>()
  for (const entry of Object.values(done)) {
    if (entry?.at) days.add(localDateOf(entry.at))
  }
  if (days.size === 0) return 0

  let cursor = new Date(now)
  let streak = 0
  // 今天没打卡时，允许从昨天开始算「连续」，避免一天没学就显示 0
  if (!days.has(localDateOf(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(localDateOf(cursor.getTime()))) return 0
  }
  while (days.has(localDateOf(cursor.getTime()))) {
    streak += 1
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
    if (streak > 10000) break
  }
  return streak
}

function localDateOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** 某科目完成率最低的 n 个模块（同率按模块原顺序） */
export function weakestModules(
  subject: SubjectView,
  done: Record<string, DoneEntry>,
  n = 3,
): ModuleStat[] {
  return moduleStats(subject, done)
    .filter((stat) => stat.total > 0)
    .sort((a, b) => a.ratio - b.ratio || a.index - b.index)
    .slice(0, n)
}

/** 某 key 是否打勾 */
export function isDone(done: Record<string, DoneEntry>, key: string): boolean {
  return Boolean(done[key])
}

/** 继续复习按钮的目标文案 */
export function continueHint(state: AppState, subject: SubjectView): string {
  const target = firstUnfinished(subject, state.done)
  if (!target) return '全部知识点已完成 🎉'
  return `继续复习 · ${target.moduleName} ${target.no ? `第 ${target.no} 讲` : ''}`.trim()
}
