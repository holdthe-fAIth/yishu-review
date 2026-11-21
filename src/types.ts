/** ============ courses.json 数据结构（v3 多科目） ============ */

export interface UpInfo {
  mid: number
  name: string
  space: string
}

/** 系统课的一个知识点 = 合集里的一个分P，或一节独立视频 */
export interface SystemItem {
  /** 同一 BV 的分P号；独立视频没有分P */
  p?: number
  /** 该知识点自己的 BV 号；缺省时继承模块/系统课的 BV */
  bvid?: string
  no: number | null
  name: string
  difficulty: string
  level: string
  /** 时长（秒） */
  duration: number
  durationText: string
  /** 该视频的发布时间（Unix 秒） */
  pubdate?: number
}

export interface ModuleInfo {
  id: string
  name: string
  count: number
  durationMin: number
  /** 模块自己的 BV 号（如物理的每个合集是一个独立 BV） */
  bvid?: string
  items: SystemItem[]
}

export interface SystemCourse {
  id: string
  /** 整个系统课共用的 BV 号（如数学的一整个大合集） */
  bvid?: string
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
  /** 发布时间（Unix 秒） */
  pubdate?: number
  views?: number
  /** 多P 合集视频的分P数（如「100讲」教辅），卡片显示「N 讲」而不是超长时长 */
  partCount?: number
}

export interface TopicInfo {
  id: string
  seasonId: number
  title: string
  count: number
  durationMin?: number
  videos: TopicVideo[]
}

/** 一个科目：自己的 UP 主、系统课和专题合集 */
export interface SubjectInfo {
  id: string
  name: string
  up: UpInfo
  systemCourse: SystemCourse
  topics: TopicInfo[]
}

export interface CoursesData {
  version: number
  generatedAt: string
  subjects: SubjectInfo[]
}

/** ============ 前端派生结构 ============ */

/** 拍平后的系统课知识点（带科目/模块信息 + 存储 key） */
export interface FlatSystemItem extends Omit<SystemItem, 'bvid'> {
  subjectId: string
  subjectName: string
  /** 实际用于跳转的 BV 号（已解析继承关系） */
  bvid: string
  moduleId: string
  moduleName: string
  moduleIndex: number
  /** `${subjectId}:s:...` */
  key: string
}

/** 拍平后的专题视频（带科目/合集信息 + 存储 key） */
export interface FlatTopicVideo extends TopicVideo {
  subjectId: string
  subjectName: string
  topicId: string
  topicTitle: string
  seasonId: number
  /** `${subjectId}:t:${seasonId}:${bvid}` */
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
  /** 已学完的模块/视频自动排到最后 */
  sortCompletedLast: boolean
  /** 启动时自动检查内容更新（每天最多一次） */
  autoCheckUpdate: boolean
  /** 内容更新源；留空则使用同源 data/courses.json（APK 内需手动填 GitHub raw 地址） */
  updateUrl: string
  /** 当前科目 id；旧数据没有时默认数学 */
  activeSubject: string
}

export interface AppState {
  v: 1
  /** key：数学 `math:s:${p}`；物理 `physics:s:${bvid}`；专题 `${subjectId}:t:${seasonId}:${bvid}` */
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
  /** 系统课分P号（数据里从 1 开始）；独立视频没有分P */
  p?: number
  /** 卡片/行上显示的补充信息，用于确认弹窗 */
  subtitle?: string
}
