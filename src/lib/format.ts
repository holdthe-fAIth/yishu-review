/** 秒 → 25:09 / 1:02:34 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** 秒 → 小时数（保留 digits 位小数） */
export function formatHours(seconds: number, digits = 1): string {
  const hours = seconds / 3600
  if (hours > 0 && hours < 0.1) return '0.1'
  return hours.toFixed(digits)
}

/** 秒 → 「约 48 小时」/「约 35 分钟」 */
export function formatHoursLabel(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60))
  if (totalMinutes <= 0) return '约 0 分钟'
  if (totalMinutes < 60) return `约 ${totalMinutes} 分钟`
  const hours = totalMinutes / 60
  return `约 ${hours >= 100 ? Math.round(hours) : hours.toFixed(1).replace(/\.0$/, '')} 小时`
}

/** 本地时区的 YYYY-MM-DD，用于连续打卡统计 */
export function localDateKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 本地时区的「昨天」 */
export function previousDateKey(ts: number): string {
  const d = new Date(ts)
  d.setDate(d.getDate() - 1)
  return localDateKey(d.getTime())
}

/** 2026-11-08T16:10 → 11月8日 16:10 */
export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

/** 导出文件名用：20261108-1610 */
export function formatStamp(ts: number): string {
  const d = new Date(ts)
  return (
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` +
    `-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  )
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 0..1 → 0..100 整数 */
export function percent(ratio: number): number {
  return Math.round(clamp(ratio, 0, 1) * 100)
}

/** 千分位 */
export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return String(n)
}
