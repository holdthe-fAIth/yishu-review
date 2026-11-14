import { DEFAULT_UPDATE_URL } from '../config'
import {
  DATA_GENERATED_AT,
  DATA_VERSION,
  clearDataOverride,
  hasDataOverride,
  isValidCoursesData,
  saveDataOverride,
} from '../data'
import { isNativeApp } from './bilibili'
import type { CoursesData, Settings } from '../types'

/** 上次自动检查的时间（毫秒），用于「每天最多自动检查一次」 */
export const LAST_CHECK_KEY = 'yishu-review:last-update-check'
export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

export type UpdateStatus = 'updated' | 'up-to-date' | 'unavailable' | 'error'

export interface UpdateCheckResult {
  status: UpdateStatus
  message: string
  /** 发现新内容时带回完整数据 */
  remote?: CoursesData
  remoteGeneratedAt?: string
  localGeneratedAt: string
  sourceUrl: string
}

/**
 * 更新源解析：
 * - 用户手动设置了「内容更新源」→ 用它（可填 GitHub Pages / jsDelivr 等地址）
 * - 浏览器 PWA → 同源 data/courses.json（部署时由构建脚本拷贝进 dist）
 * - APK 内未手动设置 → 用内置默认的线上地址（Pages 数据文件）
 */
export function resolveUpdateUrl(settings: Settings): string {
  const manual = settings.updateUrl.trim()
  if (manual) return manual
  if (isNativeApp()) return DEFAULT_UPDATE_URL
  return 'data/courses.json'
}

/** 拉取并校验远程课程数据 */
export async function fetchRemoteCourses(url: string): Promise<CoursesData> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json: unknown = await response.json()
    if (!isValidCoursesData(json)) throw new Error('数据格式不正确（需要 v2 结构）')
    return json
  } finally {
    window.clearTimeout(timer)
  }
}

function timeOf(iso: string): number {
  const value = new Date(iso).getTime()
  return Number.isFinite(value) ? value : 0
}

/** 远程数据是否比本地新（按 generatedAt 判断） */
export function isRemoteNewer(remote: CoursesData): boolean {
  return timeOf(remote.generatedAt) > timeOf(DATA_GENERATED_AT)
}

/** 检查内容更新（供「我的 → 检查内容更新」和启动自动检查共用） */
export async function checkContentUpdate(settings: Settings): Promise<UpdateCheckResult> {
  const sourceUrl = resolveUpdateUrl(settings)
  const base = { localGeneratedAt: DATA_GENERATED_AT, sourceUrl }
  if (!sourceUrl) {
    return {
      ...base,
      status: 'unavailable',
      message: '未配置内容更新源，请到「我的 → 内容更新源」填写数据地址',
    }
  }
  try {
    const remote = await fetchRemoteCourses(sourceUrl)
    if (isRemoteNewer(remote)) {
      return {
        ...base,
        status: 'updated',
        message: `发现新内容（更新于 ${remote.generatedAt.slice(0, 10)}）`,
        remote,
        remoteGeneratedAt: remote.generatedAt,
      }
    }
    return {
      ...base,
      status: 'up-to-date',
      message: '已是最新内容',
      remoteGeneratedAt: remote.generatedAt,
    }
  } catch (error) {
    return {
      ...base,
      status: 'error',
      message: `检查失败：${(error as Error).message}`,
    }
  }
}

/** 应用远程数据（写入 localStorage 覆盖），调用方需要刷新页面 */
export function applyDataUpdate(remote: CoursesData): void {
  saveDataOverride(remote)
  markUpdateChecked()
}

export function markUpdateChecked(): void {
  try {
    window.localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

export function lastCheckTime(): number {
  try {
    const value = Number(window.localStorage.getItem(LAST_CHECK_KEY))
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

/** 是否到了自动检查的时间（每天最多一次） */
export function isAutoCheckDue(now = Date.now()): boolean {
  return now - lastCheckTime() > AUTO_CHECK_INTERVAL_MS
}

export { clearDataOverride, hasDataOverride, DATA_VERSION }
