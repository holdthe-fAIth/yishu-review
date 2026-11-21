import bundledRaw from '../data/courses.json'
import type {
  CoursesData,
  FlatSystemItem,
  FlatTopicVideo,
  ModuleInfo,
  SubjectInfo,
  SystemCourse,
  TopicInfo,
} from './types'

/** 本地覆盖数据的 key（「检查内容更新」下载的新数据存这里，优先于内置数据） */
export const DATA_OVERRIDE_KEY = 'yishu-review:courses:v3'
const LEGACY_DATA_OVERRIDE_KEYS = ['yishu-review:courses:v2']

/** 校验任意来源的课程数据是否可用（内置 / 远程更新 / localStorage 覆盖） */
export function isValidCoursesData(value: unknown): value is CoursesData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<CoursesData>
  if (typeof data.version !== 'number' || data.version < 3) return false
  if (typeof data.generatedAt !== 'string' || !data.generatedAt) return false
  if (!Array.isArray(data.subjects) || data.subjects.length === 0) return false

  const subjectIds = new Set<string>()
  for (const subject of data.subjects) {
    if (!subject || typeof subject !== 'object') return false
    if (typeof subject.id !== 'string' || !subject.id) return false
    if (subjectIds.has(subject.id)) return false
    subjectIds.add(subject.id)
    if (typeof subject.name !== 'string' || !subject.name) return false
    if (!subject.up || typeof subject.up !== 'object') return false
    if (typeof subject.up.mid !== 'number' || typeof subject.up.name !== 'string') return false

    const system = subject.systemCourse
    if (!system || typeof system !== 'object') return false
    if (typeof system.id !== 'string' || !Array.isArray(system.modules)) return false
    if (system.modules.length === 0) return false
    for (const module of system.modules) {
      if (!module || typeof module.id !== 'string' || !Array.isArray(module.items)) return false
      if (typeof module.name !== 'string' || typeof module.durationMin !== 'number') return false
      for (const item of module.items) {
        if (typeof item?.p !== 'undefined' && typeof item.p !== 'number') return false
        if (typeof item?.bvid !== 'undefined' && typeof item.bvid !== 'string') return false
        if (typeof item?.name !== 'string' || typeof item?.duration !== 'number') return false
      }
    }

    if (!Array.isArray(subject.topics)) return false
    for (const topic of subject.topics) {
      if (!topic || typeof topic.seasonId !== 'number' || !Array.isArray(topic.videos)) return false
      if (typeof topic.id !== 'string' || typeof topic.title !== 'string') return false
      for (const video of topic.videos) {
        if (typeof video?.bvid !== 'string' || typeof video?.title !== 'string') return false
        if (typeof video?.duration !== 'number') return false
      }
    }
  }
  return true
}

export function loadDataOverride(): CoursesData | null {
  try {
    // v2 覆盖数据不兼容 v3 结构，清掉避免误用；App 会回退到内置 v3 数据
    for (const key of LEGACY_DATA_OVERRIDE_KEYS) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // ignore
      }
    }
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
  for (const key of LEGACY_DATA_OVERRIDE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
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

export const SUBJECTS: SubjectInfo[] = DATA.subjects
export const SUBJECT_BY_ID: Map<string, SubjectInfo> = new Map(
  SUBJECTS.map((subject) => [subject.id, subject]),
)
export const DEFAULT_SUBJECT_ID = SUBJECTS[0]?.id ?? 'math'
export const TOTAL_SUBJECTS = SUBJECTS.length

/** 系统课知识点的存储 key：数学带分P；物理/独立视频带 BV */
export function systemKey(
  subjectId: string,
  item: { bvid: string; p?: number },
  sharedBvid?: string,
): string {
  if (typeof item.p === 'number') {
    return sharedBvid && item.bvid === sharedBvid
      ? `${subjectId}:s:${item.p}`
      : `${subjectId}:s:${item.bvid}:${item.p}`
  }
  return `${subjectId}:s:${item.bvid}`
}

/** 专题视频的存储 key */
export function topicKey(subjectId: string, seasonId: number, bvid: string): string {
  return `${subjectId}:t:${seasonId}:${bvid}`
}

/** B站封面统一走 https，避免 https 页面下混合内容被拦截 */
export function normalizeCover(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
}

/** 一个科目拍平后的全部派生数据 */
export interface SubjectView {
  info: SubjectInfo
  systemCourse: SystemCourse
  modules: ModuleInfo[]
  topics: TopicInfo[]
  systemItems: FlatSystemItem[]
  topicVideos: FlatTopicVideo[]
  itemByKey: Map<string, FlatSystemItem>
  videoByKey: Map<string, FlatTopicVideo>
  topicById: Map<string, TopicInfo>
  totalKp: number
  totalModules: number
  totalTopics: number
  totalTopicVideos: number
  totalSystemSeconds: number
}

function buildSubject(info: SubjectInfo): SubjectView {
  const systemCourse = info.systemCourse
  const sharedBvid = systemCourse.bvid

  const systemItems: FlatSystemItem[] = systemCourse.modules.flatMap((module, moduleIndex) => {
    const moduleBvid = module.bvid ?? sharedBvid
    return module.items.map((item) => {
      const bvid = item.bvid ?? moduleBvid ?? ''
      return {
        ...item,
        subjectId: info.id,
        subjectName: info.name,
        bvid,
        moduleId: module.id,
        moduleName: module.name,
        moduleIndex,
        key: systemKey(info.id, { bvid, p: item.p }, sharedBvid),
      }
    })
  })

  const topicVideos: FlatTopicVideo[] = info.topics.flatMap((topic) =>
    topic.videos.map((video) => ({
      ...video,
      cover: normalizeCover(video.cover),
      subjectId: info.id,
      subjectName: info.name,
      topicId: topic.id,
      topicTitle: topic.title,
      seasonId: topic.seasonId,
      key: topicKey(info.id, topic.seasonId, video.bvid),
    })),
  )

  const totalSystemSeconds = systemItems.reduce((sum, item) => sum + item.duration, 0)

  return {
    info,
    systemCourse,
    modules: systemCourse.modules,
    topics: info.topics,
    systemItems,
    topicVideos,
    itemByKey: new Map(systemItems.map((item) => [item.key, item])),
    videoByKey: new Map(topicVideos.map((video) => [video.key, video])),
    topicById: new Map(info.topics.map((topic) => [topic.id, topic])),
    totalKp: systemItems.length,
    totalModules: systemCourse.modules.length,
    totalTopics: info.topics.length,
    totalTopicVideos: topicVideos.length,
    totalSystemSeconds,
  }
}

export const SUBJECT_VIEWS: SubjectView[] = SUBJECTS.map(buildSubject)
export const SUBJECT_VIEW_BY_ID: Map<string, SubjectView> = new Map(
  SUBJECT_VIEWS.map((subject) => [subject.info.id, subject]),
)

/** 按 id 取科目；id 失效时回退到第一个科目 */
export function getSubject(id?: string): SubjectView {
  return (id ? SUBJECT_VIEW_BY_ID.get(id) : undefined) ?? SUBJECT_VIEWS[0]
}

export const ALL_SYSTEM_ITEMS: FlatSystemItem[] = SUBJECT_VIEWS.flatMap(
  (subject) => subject.systemItems,
)
export const ALL_TOPIC_VIDEOS: FlatTopicVideo[] = SUBJECT_VIEWS.flatMap(
  (subject) => subject.topicVideos,
)
export const ALL_MODULES: ModuleInfo[] = SUBJECT_VIEWS.flatMap((subject) => subject.modules)

export const TOTAL_KP = ALL_SYSTEM_ITEMS.length
export const TOTAL_MODULES = ALL_MODULES.length
export const TOTAL_TOPICS = SUBJECT_VIEWS.reduce((sum, subject) => sum + subject.totalTopics, 0)
export const TOTAL_TOPIC_VIDEOS = ALL_TOPIC_VIDEOS.length
export const TOTAL_SYSTEM_SECONDS = ALL_SYSTEM_ITEMS.reduce(
  (sum, item) => sum + item.duration,
  0,
)

/** 供「学习日历」等场景按 key 反查名称/时长 */
export const SYSTEM_ITEM_BY_KEY: Map<string, FlatSystemItem> = new Map(
  ALL_SYSTEM_ITEMS.map((item) => [item.key, item]),
)
export const TOPIC_VIDEO_BY_KEY: Map<string, FlatTopicVideo> = new Map(
  ALL_TOPIC_VIDEOS.map((video) => [video.key, video]),
)

/** 所有可打勾 key → 视频时长（秒），用于「累计视频时长」统计 */
export const DURATION_BY_KEY: Record<string, number> = Object.fromEntries([
  ...ALL_SYSTEM_ITEMS.map((it) => [it.key, it.duration] as const),
  ...ALL_TOPIC_VIDEOS.map((v) => [v.key, v.duration] as const),
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
