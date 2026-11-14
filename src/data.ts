import bundledRaw from '../data/courses.json'
import type {
  CoursesData,
  FlatSystemItem,
  FlatTopicVideo,
  ModuleInfo,
  TopicInfo,
} from './types'

/** 本地覆盖数据的 key（「检查内容更新」下载的新数据存这里，优先于内置数据） */
export const DATA_OVERRIDE_KEY = 'yishu-review:courses:v2'

/** 校验任意来源的课程数据是否可用（内置 / 远程更新 / localStorage 覆盖） */
export function isValidCoursesData(value: unknown): value is CoursesData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<CoursesData>
  if (typeof data.version !== 'number' || data.version < 2) return false
  if (typeof data.generatedAt !== 'string' || !data.generatedAt) return false
  const system = data.systemCourse
  if (!system || typeof system !== 'object') return false
  if (typeof system.bvid !== 'string' || !Array.isArray(system.modules)) return false
  if (system.modules.length === 0) return false
  for (const module of system.modules) {
    if (!module || typeof module.id !== 'string' || !Array.isArray(module.items)) return false
    for (const item of module.items) {
      if (typeof item?.p !== 'number' || typeof item?.name !== 'string') return false
      if (typeof item?.duration !== 'number') return false
    }
  }
  if (!Array.isArray(data.topics)) return false
  for (const topic of data.topics) {
    if (!topic || typeof topic.seasonId !== 'number' || !Array.isArray(topic.videos)) return false
    for (const video of topic.videos) {
      if (typeof video?.bvid !== 'string' || typeof video?.title !== 'string') return false
    }
  }
  return true
}

export function loadDataOverride(): CoursesData | null {
  try {
    const text = window.localStorage.getItem(DATA_OVERRIDE_KEY)
    if (!text) return null
    const parsed: unknown = JSON.parse(text)
    if (!isValidCoursesData(parsed)) {
      window.localStorage.removeItem(DATA_OVERRIDE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveDataOverride(data: CoursesData): void {
  window.localStorage.setItem(DATA_OVERRIDE_KEY, JSON.stringify(data))
}

export function clearDataOverride(): void {
  window.localStorage.removeItem(DATA_OVERRIDE_KEY)
}

export function hasDataOverride(): boolean {
  try {
    return Boolean(window.localStorage.getItem(DATA_OVERRIDE_KEY))
  } catch {
    return false
  }
}

const bundled = bundledRaw as unknown as CoursesData
const override = loadDataOverride()

/** 静态导入的内置课程数据（运行时绝不请求任何 B站接口） */
export const DATA: CoursesData = override ?? bundled
export const DATA_SOURCE: 'bundled' | 'remote' = override ? 'remote' : 'bundled'
export const DATA_VERSION = DATA.version
export const DATA_GENERATED_AT = DATA.generatedAt

export const UP = DATA.up
export const SYSTEM = DATA.systemCourse
export const MODULES: ModuleInfo[] = SYSTEM.modules
export const TOPICS: TopicInfo[] = DATA.topics

/** 系统课大合集 BV 号：194 个知识点都在这个 BV 下，靠 p 区分 */
export const SYSTEM_BVID = SYSTEM.bvid

export const TOTAL_KP = MODULES.reduce((sum, m) => sum + m.items.length, 0)
export const TOTAL_MODULES = MODULES.length
export const TOTAL_TOPICS = TOPICS.length
export const TOTAL_TOPIC_VIDEOS = TOPICS.reduce((sum, t) => sum + t.videos.length, 0)
export const TOTAL_SYSTEM_SECONDS = MODULES.reduce(
  (sum, m) => sum + m.items.reduce((s, it) => s + it.duration, 0),
  0,
)

export const systemKey = (p: number): string => `s:${p}`
export const topicKey = (seasonId: number, bvid: string): string => `t:${seasonId}:${bvid}`

/** B站封面统一走 https，避免 https 页面下混合内容被拦截 */
export function normalizeCover(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
}

/** 拍平系统课：模块顺序 = 复习顺序，保持 courses.json 里的顺序，绝不重排 */
export const SYSTEM_ITEMS: FlatSystemItem[] = MODULES.flatMap((m, moduleIndex) =>
  m.items.map((it) => ({
    ...it,
    moduleId: m.id,
    moduleName: m.name,
    moduleIndex,
    key: systemKey(it.p),
  })),
)

/** 拍平专题视频 */
export const TOPIC_VIDEOS: FlatTopicVideo[] = TOPICS.flatMap((t) =>
  t.videos.map((v) => ({
    ...v,
    cover: normalizeCover(v.cover),
    topicId: t.id,
    topicTitle: t.title,
    seasonId: t.seasonId,
    key: topicKey(t.seasonId, v.bvid),
  })),
)

/** 供「学习时间表」等场景按 key 反查名称/时长 */
export const SYSTEM_ITEM_BY_KEY: Map<string, FlatSystemItem> = new Map(
  SYSTEM_ITEMS.map((item) => [item.key, item]),
)
export const TOPIC_VIDEO_BY_KEY: Map<string, FlatTopicVideo> = new Map(
  TOPIC_VIDEOS.map((video) => [video.key, video]),
)

export const ITEM_BY_P: Map<number, FlatSystemItem> = new Map(SYSTEM_ITEMS.map((it) => [it.p, it]))
export const TOPIC_BY_ID: Map<string, TopicInfo> = new Map(TOPICS.map((topic) => [topic.id, topic]))

/** 所有可打勾 key → 视频时长（秒），用于「累计视频时长」统计 */
export const DURATION_BY_KEY: Record<string, number> = Object.fromEntries([
  ...SYSTEM_ITEMS.map((it) => [it.key, it.duration] as const),
  ...TOPIC_VIDEOS.map((v) => [v.key, v.duration] as const),
])

export const ALL_TRACKABLE_KEYS: string[] = Object.keys(DURATION_BY_KEY)

/* ============ 发布时间工具 ============ */

/** Unix 秒 → 2023-08-25 */
export function formatPubdate(unixSeconds?: number): string {
  if (!unixSeconds || unixSeconds <= 0) return ''
  const date = new Date(unixSeconds * 1000)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Unix 秒 → 「3 年前」「8 个月前」「今年」 */
export function pubdateRelative(unixSeconds?: number, now = Date.now()): string {
  if (!unixSeconds || unixSeconds <= 0) return ''
  const days = (now - unixSeconds * 1000) / 86_400_000
  if (days < 0) return '刚发布'
  if (days < 60) return `${Math.max(1, Math.round(days))} 天前`
  if (days < 365) return `${Math.round(days / 30)} 个月前`
  const years = days / 365
  return `${years >= 10 ? Math.round(years) : years.toFixed(1).replace(/\.0$/, '')} 年前`
}

/** 是否「老视频」（超过 2 年），用于卡片上做颜色提示 */
export function isStaleVideo(unixSeconds?: number, now = Date.now()): boolean {
  if (!unixSeconds || unixSeconds <= 0) return false
  return now - unixSeconds * 1000 > 730 * 86_400_000
}

/* ============ 模块主题色（系统课自绘封面） ============ */

const GOLDEN_ANGLE = 137.508

export interface GradientPair {
  from: string
  to: string
}

export function moduleColor(index: number): GradientPair {
  const hue = Math.round((205 + index * GOLDEN_ANGLE) % 360)
  const hue2 = (hue + 34) % 360
  return {
    from: `hsl(${hue} 68% 58%)`,
    to: `hsl(${hue2} 74% 42%)`,
  }
}

/** 模块名首字，用于自绘封面 */
export function moduleChar(name: string): string {
  return name.trim().charAt(0) || '数'
}

/** 专题封面的兜底渐变 */
export const TOPIC_FALLBACK_GRADIENTS: GradientPair[] = [
  { from: 'hsl(346 72% 60%)', to: 'hsl(320 70% 44%)' },
  { from: 'hsl(202 74% 55%)', to: 'hsl(220 72% 42%)' },
  { from: 'hsl(268 62% 60%)', to: 'hsl(292 66% 44%)' },
  { from: 'hsl(24 78% 58%)', to: 'hsl(8 72% 46%)' },
  { from: 'hsl(152 58% 50%)', to: 'hsl(172 64% 38%)' },
  { from: 'hsl(44 76% 56%)', to: 'hsl(28 78% 46%)' },
]

export function topicGradient(index: number): GradientPair {
  return TOPIC_FALLBACK_GRADIENTS[index % TOPIC_FALLBACK_GRADIENTS.length]
}
