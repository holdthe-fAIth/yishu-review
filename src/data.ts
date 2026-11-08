import raw from '../data/courses.json'
import type {
  CoursesData,
  FlatSystemItem,
  FlatTopicVideo,
  ModuleInfo,
  TopicInfo,
} from './types'

/** 静态导入课程数据：运行时绝不请求任何 B站接口 */
export const DATA = raw as unknown as CoursesData

export const UP = DATA.up
export const SYSTEM = DATA.systemCourse
export const MODULES: ModuleInfo[] = SYSTEM.modules
export const TOPICS: TopicInfo[] = DATA.topics

/** 系统课大合集 BV 号：194 个知识点都在这个 BV 下，靠 p 区分 */
export const SYSTEM_BVID = SYSTEM.bvid

export const TOTAL_KP = MODULES.reduce((sum, m) => sum + m.items.length, 0)
export const TOTAL_MODULES = MODULES.length
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

export const ITEM_BY_P: Map<number, FlatSystemItem> = new Map(SYSTEM_ITEMS.map((it) => [it.p, it]))

/** 所有可打勾 key → 视频时长（秒），用于「累计视频时长」统计 */
export const DURATION_BY_KEY: Record<string, number> = Object.fromEntries([
  ...SYSTEM_ITEMS.map((it) => [it.key, it.duration] as const),
  ...TOPIC_VIDEOS.map((v) => [v.key, v.duration] as const),
])

export const ALL_TRACKABLE_KEYS: string[] = Object.keys(DURATION_BY_KEY)

/** 模块主题色：根据模块序号生成稳定的渐变色，用来自己画系统课「封面」 */
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
