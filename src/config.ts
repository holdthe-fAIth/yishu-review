export const APP_NAME = '数理复习'
export const APP_VERSION = '3.1.0'

/**
 * APK 内默认的内容更新源（GitHub Pages 上的 data/courses.json，带 CORS: *）。
 * - 浏览器 PWA 默认用同源 data/courses.json（无需这个地址）
 * - raw.githubusercontent.com 在国内经常无法访问，所以用 Pages 域名；也可在 App 设置里改
 */
export const DEFAULT_UPDATE_URL =
  'https://holdthe-faith.github.io/yishu-review/data/courses.json'

/** 跳转确认 / 返回浮条等可调参数 */
export const RETURN_THRESHOLD_MS = 30_000
