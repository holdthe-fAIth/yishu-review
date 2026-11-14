import { SYSTEM_ITEM_BY_KEY, TOPIC_VIDEO_BY_KEY } from '../data'
import type { DoneEntry } from '../types'

/** 一条学习记录 = 一个已打勾的知识点/专题视频 */
export interface StudyRecord {
  key: string
  name: string
  groupName: string
  kind: 'system' | 'topic'
  /** 完成时间（毫秒时间戳） */
  at: number
  duration: number
  durationText: string
}

/** 把 done 记录转成按时间倒序的学习记录列表 */
export function buildStudyRecords(done: Record<string, DoneEntry>): StudyRecord[] {
  const records: StudyRecord[] = []
  for (const [key, entry] of Object.entries(done)) {
    if (!entry?.at) continue
    const system = SYSTEM_ITEM_BY_KEY.get(key)
    if (system) {
      records.push({
        key,
        name: system.name,
        groupName: system.moduleName,
        kind: 'system',
        at: entry.at,
        duration: system.duration,
        durationText: system.durationText,
      })
      continue
    }
    const topic = TOPIC_VIDEO_BY_KEY.get(key)
    if (topic) {
      records.push({
        key,
        name: topic.title,
        groupName: topic.topicTitle,
        kind: 'topic',
        at: entry.at,
        duration: topic.duration,
        durationText: topic.durationText,
      })
    }
  }
  return records.sort((a, b) => b.at - a.at)
}

/** 本地日期 YYYY-MM-DD */
export function localDateKey(ts: number): string {
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function formatRecordTime(ts: number): string {
  const date = new Date(ts)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 按天分组（从今天往前排），带上当天记录 */
export interface StudyDay {
  date: string
  label: string
  count: number
  seconds: number
  records: StudyRecord[]
}

export function groupRecordsByDay(records: StudyRecord[]): StudyDay[] {
  const map = new Map<string, StudyDay>()
  for (const record of records) {
    const date = localDateKey(record.at)
    let day = map.get(date)
    if (!day) {
      const d = new Date(record.at)
      day = {
        date,
        label: `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAY_LABELS[d.getDay()]}`,
        count: 0,
        seconds: 0,
        records: [],
      }
      map.set(date, day)
    }
    day.count += 1
    day.seconds += record.duration
    day.records.push(record)
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

export interface HeatCell {
  date: string
  count: number
  seconds: number
  isToday: boolean
}

/**
 * 最近 N 周的打卡热力图数据：一维数组，每 7 个为一列（周一起始），最后一天是今天。
 * 前面不足的格子用该周之前的日期填充（热力图上显示为空格）。
 */
export function buildHeatmap(done: Record<string, DoneEntry>, weeks = 12): HeatCell[] {
  const counts = new Map<string, { count: number; seconds: number }>()
  for (const [key, entry] of Object.entries(done)) {
    if (!entry?.at) continue
    const date = localDateKey(entry.at)
    const duration = SYSTEM_ITEM_BY_KEY.get(key)?.duration ?? TOPIC_VIDEO_BY_KEY.get(key)?.duration ?? 0
    const current = counts.get(date) ?? { count: 0, seconds: 0 }
    current.count += 1
    current.seconds += duration
    counts.set(date, current)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = localDateKey(today.getTime())
  // 找到本周周一，再从 weeks 周前开始
  const weekday = (today.getDay() + 6) % 7 // 周一=0
  const start = new Date(today.getTime() - (weekday + (weeks - 1) * 7) * 86_400_000)

  const cells: HeatCell[] = []
  for (let i = 0; i < weeks * 7; i += 1) {
    const day = new Date(start.getTime() + i * 86_400_000)
    const date = localDateKey(day.getTime())
    const stat = counts.get(date) ?? { count: 0, seconds: 0 }
    cells.push({ date, count: stat.count, seconds: stat.seconds, isToday: date === todayKey })
  }
  return cells
}

/** 最近 N 天每天的学习量（用于「本周/本月」统计） */
export function studySummary(done: Record<string, DoneEntry>, now = Date.now()) {
  const records = buildStudyRecords(done)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const dayStart = startOfToday.getTime()
  const weekStart = dayStart - 6 * 86_400_000
  const counts = { today: 0, week: 0, total: records.length, todayMinutes: 0 }
  let todaySeconds = 0
  for (const record of records) {
    if (record.at >= dayStart) {
      counts.today += 1
      todaySeconds += record.duration
    }
    if (record.at >= weekStart) counts.week += 1
  }
  counts.todayMinutes = Math.round(todaySeconds / 60)
  return counts
}
