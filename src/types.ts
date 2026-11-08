/** ============ courses.json 数据结构 ============ */

export interface UpInfo {
  mid: number
  name: string
  space: string
}

/** 系统课的一个知识点 = 大合集里的一个分P */
export interface SystemItem {
  p: number
  no: number | null
  name: string
  difficulty: string
  level: string
  /** 秒 */
  duration: number
  durationText: string
}

export interface ModuleInfo {
  id: string
  name: string
  count: number
  durationMin: number
  items: SystemItem[]
}

export interface SystemCourse {
  id: string
  bvid: string
  title: string
  subtitle: string
  kpCount: number
  durationMin: number
  modules: ModuleInfo[]
}

/** 专题合集里的一个视频（独立 BV 号） */
export interface TopicVideo {
  bvid: string
  title: string
  cover: string
  duration: number
  durationText: string
  pubdate?: number
  views?: number
}

export interface TopicInfo {
  id: string
  seasonId: number
  title: string
  count: number
  durationMin?: number
  videos: TopicVideo[]
}

export interface CoursesData {
  version: number
  generatedAt: string
  up: UpInfo
  systemCourse: SystemCourse
  topics: TopicInfo[]
}

/** ============ 前端派生结构 ============ */

/** 拍平后的系统课知识点（带模块信息 + 存储 key） */
export interface FlatSystemItem extends SystemItem {
  moduleId: string
  moduleName: string
  moduleIndex: number
  /** `s:${p}` */
  key: string
}

/** 拍平后的专题视频（带合集信息 + 存储 key） */
export interface FlatTopicVideo extends TopicVideo {
  topicId: string
  topicTitle: string
  seasonId: number
  /** `t:${seasonId}:${bvid}` */
  key: string
}

/** ============ 本地状态 ============ */

export type TabKey = 'course' | 'knowledge' | 'mine'

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface DoneEntry {
  /** 打勾时间戳（毫秒） */
  at: number
}

/** 跳转前埋下的一条「待确认打勾」记录，只保留一条 */
export interface PendingItem {
  key: string
  name: string
  at: number
}

export interface Settings {
  /** 跳转前是否弹确认 */
  confirmBeforeJump: boolean
  /** 从 B站 切回来是否弹「看完了？」浮条 */
  returnPrompt: boolean
  theme: ThemeMode
}

export interface AppState {
  v: 1
  /** key：系统课 `s:${p}`；专题 `t:${seasonId}:${bvid}` */
  done: Record<string, DoneEntry>
  pending?: PendingItem
  settings: Settings
}

/** ============ 跳转目标 ============ */

export interface PlayTarget {
  kind: 'system' | 'topic'
  key: string
  name: string
  bvid: string
  /** 系统课分P号（数据里从 1 开始）；专题视频没有分P */
  p?: number
  /** 卡片/行上显示的补充信息，用于确认弹窗 */
  subtitle?: string
}
