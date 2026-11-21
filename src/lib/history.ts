import { SYSTEM_ITEM_BY_KEY, TOPIC_VIDEO_BY_KEY } from '../data'
import type { DoneEntry } from '../types'

/** 一条学习记录 = 一个已打勾的知识点/专题视频 */
export interface StudyRecord {
  key: string
  name: string
  groupName: string
  subjectId: string
  subjectName: string
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
        subjectId: system.subjectId,
        subjectName: system.subjectName,
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
        subjectId: topic.subjectId,
        subjectName: topic.subjectName,
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

/* ============ 学习日历（月历 + 按天查看学习内容） ============ */

export interface CalendarCell {
  /** YYYY-MM-DD */
  date: string
  day: number
  month: number
  year: number
  count: number
  seconds: number
  isToday: boolean
  /** 是否属于当前展示的月份（前后月补位的格子为 false） */
  isCurrentMonth: boolean
  /** 今天之后的日期 */
  isFuture: boolean
}

export interface MonthCalendar {
  year: number
  /** 1-12 */
  month: number
  /** 2026年11月 */
  label: string
  /** 42 个格子：6 行 × 7 列，周一为一周起点 */
  cells: CalendarCell[]
  /** 本月有学习记录的天数 */
  studyDays: number
  /** 本月完成的知识点/视频数 */
  studyCount: number
  /** 本月学习时长（秒） */
  studySeconds: number
}

/** 某天的学习量统计（从 done 记录聚合） */
export interface DayStat {
  count: number
  seconds: number
}

export function dayStats(done: Record<string, DoneEntry>): Map<string, DayStat> {
  const stats = new Map<string, DayStat>()
  for (const [key, entry] of Object.entries(done)) {
    if (!entry?.at) continue
    const date = localDateKey(entry.at)
    const duration = SYSTEM_ITEM_BY_KEY.get(key)?.duration ?? TOPIC_VIDEO_BY_KEY.get(key)?.duration ?? 0
    const current = stats.get(date) ?? { count: 0, seconds: 0 }
    current.count += 1
    current.seconds += duration
    stats.set(date, current)
  }
  return stats
}

/**
 * 生成某个月的日历网格（周一起始，6 周 = 42 格，前后月补位，用于点日期查看当天学习内容）。
 */
export function buildMonthCalendar(
  done: Record<string, DoneEntry>,
  year: number,
  month: number,
  now = Date.now(),
): MonthCalendar {
  const stats = dayStats(done)
  const todayKey = localDateKey(now)
  const firstOfMonth = new Date(year, month - 1, 1)
  firstOfMonth.setHours(0, 0, 0, 0)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7 // 周一=0
  const start = new Date(firstOfMonth.getTime() - mondayOffset * 86_400_000)

  const cells: CalendarCell[] = []
  let studyDays = 0
  let studyCount = 0
  let studySeconds = 0

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start.getTime() + i * 86_400_000)
    const date = localDateKey(day.getTime())
    const stat = stats.get(date) ?? { count: 0, seconds: 0 }
    const isCurrentMonth = day.getMonth() === month - 1
    const cell: CalendarCell = {
      date,
      day: day.getDate(),
      month: day.getMonth() + 1,
      year: day.getFullYear(),
      count: stat.count,
      seconds: stat.seconds,
      isToday: date === todayKey,
      isCurrentMonth,
      isFuture: date > todayKey,
    }
    if (isCurrentMonth) {
      if (stat.count > 0) studyDays += 1
      studyCount += stat.count
      studySeconds += stat.seconds
    }
    cells.push(cell)
  }

  return {
    year,
    month,
    label: `${year}年${month}月`,
    cells,
    studyDays,
    studyCount,
    studySeconds,
  }
}

/** 月份加减（返回规范化后的 { year, month }） */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/** YYYY-MM-DD → 「11月14日 · 周六」 */
export function formatDayTitle(date: string): string {
  const [y, m, d] = date.split('-').map((part) => Number(part))
  const value = new Date(y, m - 1, d)
  return `${value.getMonth() + 1}月${value.getDate()}日 · ${WEEKDAY_LABELS[value.getDay()]}`
}

/** 从学习记录里筛出某一天的全部记录（保持传入顺序：时间倒序） */
export function recordsForDate(records: StudyRecord[], date: string): StudyRecord[] {
  return records.filter((record) => localDateKey(record.at) === date)
}

/** 最近 N 天每天的学习量（用于「本周/今天」统计） */
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
