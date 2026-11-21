import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { AppState, DoneEntry, PendingItem, Settings } from '../types'

/** localStorage 只用一个 key，所有状态读写都收口在这里 */
export const STORAGE_KEY = 'yishu-review:state:v1'

export const DEFAULT_SETTINGS: Settings = {
  confirmBeforeJump: false,
  returnPrompt: true,
  theme: 'auto',
  sortCompletedLast: true,
  autoCheckUpdate: true,
  updateUrl: '',
  activeSubject: 'math',
}

export function createDefaultState(): AppState {
  return { v: 1, done: {}, settings: { ...DEFAULT_SETTINGS } }
}

/**
 * 旧版 key 迁移：`s:{p}` / `t:{seasonId}:{bvid}` 都是数学；
 * 新版统一带科目前缀（`math:s:2`、`physics:s:BV...`）。
 */
function migrateDoneKey(key: string): string {
  if (key.startsWith('s:')) return `math:${key}`
  if (key.startsWith('t:')) return `math:${key}`
  return key
}

function isThemeMode(value: unknown): value is Settings['theme'] {
  return value === 'light' || value === 'dark' || value === 'auto'
}

function sanitizeDone(raw: unknown): Record<string, DoneEntry> {
  const out: Record<string, DoneEntry> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [rawKey, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof rawKey !== 'string' || rawKey.length === 0) continue
    const key = migrateDoneKey(rawKey)
    const at = (value as { at?: unknown } | null)?.at
    if (typeof at === 'number' && Number.isFinite(at)) {
      if (!out[key] || at > out[key].at) out[key] = { at }
    } else if (value === true) {
      // 兼容「只有 key 没有时间」的旧数据
      if (!out[key]) out[key] = { at: Date.now() }
    }
  }
  return out
}

function normalizePending(raw: unknown): PendingItem | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<PendingItem>
  if (typeof value.key !== 'string' || !value.key) return undefined
  if (typeof value.name !== 'string' || !value.name) return undefined
  if (typeof value.at !== 'number' || !Number.isFinite(value.at)) return undefined
  return { key: migrateDoneKey(value.key), name: value.name, at: value.at }
}

/** 把任意来源（localStorage / 导入文件）的数据规范化成合法 AppState */
export function normalizeState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return createDefaultState()
  const value = raw as { done?: unknown; pending?: unknown; settings?: Partial<Settings> }
  const settings: Partial<Settings> = value.settings ?? {}
  return {
    v: 1,
    done: sanitizeDone(value.done),
    pending: normalizePending(value.pending),
    settings: {
      confirmBeforeJump:
        typeof settings.confirmBeforeJump === 'boolean'
          ? settings.confirmBeforeJump
          : DEFAULT_SETTINGS.confirmBeforeJump,
      returnPrompt:
        typeof settings.returnPrompt === 'boolean'
          ? settings.returnPrompt
          : DEFAULT_SETTINGS.returnPrompt,
      theme: isThemeMode(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme,
      sortCompletedLast:
        typeof settings.sortCompletedLast === 'boolean'
          ? settings.sortCompletedLast
          : DEFAULT_SETTINGS.sortCompletedLast,
      autoCheckUpdate:
        typeof settings.autoCheckUpdate === 'boolean'
          ? settings.autoCheckUpdate
          : DEFAULT_SETTINGS.autoCheckUpdate,
      updateUrl:
        typeof settings.updateUrl === 'string' ? settings.updateUrl : DEFAULT_SETTINGS.updateUrl,
      activeSubject:
        typeof settings.activeSubject === 'string' && settings.activeSubject
          ? settings.activeSubject
          : DEFAULT_SETTINGS.activeSubject,
    },
  }
}

export function loadState(): AppState {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY)
    if (!text) return createDefaultState()
    return normalizeState(JSON.parse(text))
  } catch {
    return createDefaultState()
  }
}

function persistState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 隐私模式 / 存储满时静默失败，不阻塞使用
  }
}

type Action =
  | { type: 'toggleDone'; key: string }
  | { type: 'markDone'; key: string; at?: number }
  | { type: 'markUndone'; key: string }
  | { type: 'setPending'; pending: PendingItem }
  | { type: 'clearPending' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'replaceState'; state: AppState }
  | { type: 'reset' }

function withDone(state: AppState, key: string, entry: DoneEntry): AppState {
  const done = { ...state.done, [key]: entry }
  const pending =
    state.pending && state.pending.key === key ? undefined : state.pending
  return { ...state, done, pending }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'toggleDone': {
      if (state.done[action.key]) {
        const done = { ...state.done }
        delete done[action.key]
        return { ...state, done }
      }
      return withDone(state, action.key, { at: Date.now() })
    }
    case 'markDone':
      return withDone(state, action.key, { at: action.at ?? Date.now() })
    case 'markUndone': {
      if (!state.done[action.key]) return state
      const done = { ...state.done }
      delete done[action.key]
      return { ...state, done }
    }
    case 'setPending':
      return { ...state, pending: action.pending }
    case 'clearPending':
      return state.pending === undefined ? state : { ...state, pending: undefined }
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'replaceState':
      return normalizeState(action.state)
    case 'reset':
      return createDefaultState()
    default:
      return state
  }
}

export interface AppActions {
  toggleDone(key: string): void
  markDone(key: string, at?: number): void
  markUndone(key: string): void
  setPending(pending: PendingItem): void
  clearPending(): void
  updateSettings(patch: Partial<Settings>): void
  replaceState(next: AppState): void
  reset(): void
}

interface AppContextValue extends AppActions {
  state: AppState
  settings: Settings
  /** 系统课已完成知识点数 */
  doneCount: number
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  // 任何状态变化都同步写入 localStorage（一个 key）
  useEffect(() => {
    persistState(state)
  }, [state])

  // 多标签页同步
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        dispatch({ type: 'replaceState', state: normalizeState(JSON.parse(event.newValue)) })
      } catch {
        // 忽略坏数据
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 主题：light / dark / auto（跟随系统），同时更新浏览器 theme-color
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const mode = state.settings.theme
      const resolved = mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode
      root.dataset.theme = resolved
      root.style.colorScheme = resolved
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#17181A' : '#FB7299')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [state.settings.theme])

  const toggleDone = useCallback((key: string) => dispatch({ type: 'toggleDone', key }), [])
  const markDone = useCallback(
    (key: string, at?: number) => dispatch({ type: 'markDone', key, at }),
    [],
  )
  const markUndone = useCallback((key: string) => dispatch({ type: 'markUndone', key }), [])
  const setPending = useCallback(
    (pending: PendingItem) => dispatch({ type: 'setPending', pending }),
    [],
  )
  const clearPending = useCallback(() => dispatch({ type: 'clearPending' }), [])
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => dispatch({ type: 'updateSettings', patch }),
    [],
  )
  const replaceState = useCallback(
    (next: AppState) => dispatch({ type: 'replaceState', state: next }),
    [],
  )
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  const doneCount = useMemo(() => {
    let count = 0
    for (const key of Object.keys(state.done)) {
      if (key.includes(':s:')) count += 1
    }
    return count
  }, [state.done])

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      settings: state.settings,
      doneCount,
      toggleDone,
      markDone,
      markUndone,
      setPending,
      clearPending,
      updateSettings,
      replaceState,
      reset,
    }),
    [
      state,
      doneCount,
      toggleDone,
      markDone,
      markUndone,
      setPending,
      clearPending,
      updateSettings,
      replaceState,
      reset,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp 必须在 <AppProvider> 内使用')
  return context
}

/** 只读 state 的便捷 hook */
export function useAppState(): AppState {
  return useApp().state
}
