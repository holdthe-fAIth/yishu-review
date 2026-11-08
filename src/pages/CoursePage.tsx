import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { CheckButton } from '../components/CheckButton'
import { GeneratedCover, RemoteCover } from '../components/Cover'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlayIcon,
  SearchIcon,
} from '../components/Icons'
import { LevelTag } from '../components/LevelTag'
import { ProgressRing } from '../components/ProgressRing'
import { Segmented, type SegmentedItem } from '../components/Segmented'
import { ActionSheet, type ActionSheetItem } from '../components/Sheet'
import { useToast } from '../components/Toast'
import {
  MODULES,
  SYSTEM_BVID,
  SYSTEM_ITEMS,
  TOPICS,
  TOPIC_VIDEOS,
  TOTAL_KP,
  UP,
  moduleChar,
  moduleColor,
  topicGradient,
  type GradientPair,
} from '../data'
import { openInBrowser } from '../lib/bilibili'
import { formatCount, formatHoursLabel, percent } from '../lib/format'
import { useJump } from '../lib/jump'
import {
  firstUnfinished,
  moduleStats,
  topicStat,
  totalSystemProgress,
  type ModuleStat,
} from '../lib/progress'
import { useApp } from '../store/AppStore'
import type { DoneEntry, FlatSystemItem, FlatTopicVideo, PlayTarget } from '../types'
import './CoursePage.css'

/* ============================== 常量 / 类型 ============================== */

type CourseView = 'system' | 'topic'

const VIEW_ITEMS: SegmentedItem<CourseView>[] = [
  { key: 'system', label: '系统课' },
  { key: 'topic', label: '专题课' },
]

/** 长按 500ms 弹操作菜单；手指移动超过 8px 视为滚动，取消长按 */
const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 8

/** 长按 / 右键菜单需要的上下文 */
interface CardMenuState {
  target: PlayTarget
  bvid: string
  done: boolean
  toggleKey: string
}

interface LongPressHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void
}

/**
 * 卡片长按手势（pointer events）。
 * 长按触发 / 位移超过阈值后，会吃掉随后合成的那一次 click，保证「长按后不误跳转」。
 */
function useLongPress(onLongPress: () => void): {
  handlers: LongPressHandlers
  consumeSuppressedClick: () => boolean
} {
  const timerRef = useRef<number | null>(null)
  const originRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const suppressClickRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    originRef.current = null
  }, [])

  // 组件卸载时清掉挂起的定时器
  useEffect(() => clearTimer, [clearTimer])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // 只响应鼠标左键；右键交给 onContextMenu
      if (event.pointerType === 'mouse' && event.button !== 0) return
      clearTimer()
      suppressClickRef.current = false
      originRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        originRef.current = null
        suppressClickRef.current = true
        onLongPress()
      }, LONG_PRESS_MS)
    },
    [clearTimer, onLongPress],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = originRef.current
      if (!origin || origin.pointerId !== event.pointerId) return
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_TOLERANCE) {
        // 手指在滚动/拖拽：不算长按，也别把这次手势当成点击
        suppressClickRef.current = true
        clearTimer()
      }
    },
    [clearTimer],
  )

  const onPointerUp = useCallback(() => clearTimer(), [clearTimer])
  const onPointerCancel = useCallback(() => clearTimer(), [clearTimer])
  const onPointerLeave = useCallback(() => clearTimer(), [clearTimer])

  const onContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault()
      clearTimer()
      suppressClickRef.current = true
      onLongPress()
    },
    [clearTimer, onLongPress],
  )

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onContextMenu,
    },
    consumeSuppressedClick,
  }
}

/* ============================== 系统课卡片 ============================== */

interface SystemCardProps {
  item: FlatSystemItem
  moduleName: string
  colors: GradientPair
  done: boolean
  onToggleDone: (key: string) => void
  onPlay: (target: PlayTarget) => void
  onMenu: (menu: CardMenuState) => void
}

function SystemCard({
  item,
  moduleName,
  colors,
  done,
  onToggleDone,
  onPlay,
  onMenu,
}: SystemCardProps) {
  const target = useMemo<PlayTarget>(
    () => ({
      kind: 'system',
      key: item.key,
      name: item.name,
      bvid: SYSTEM_BVID,
      p: item.p,
      subtitle: moduleName,
    }),
    [item, moduleName],
  )

  const openMenu = useCallback(() => {
    onMenu({ target, bvid: SYSTEM_BVID, done, toggleKey: item.key })
  }, [onMenu, target, done, item.key])

  const { handlers, consumeSuppressedClick } = useLongPress(openMenu)

  const handleClick = useCallback(() => {
    if (consumeSuppressedClick()) return
    onPlay(target)
  }, [consumeSuppressedClick, onPlay, target])

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      // 焦点在内部打勾按钮上时不抢键盘事件
      if (event.target !== event.currentTarget) return
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onPlay(target)
    },
    [onPlay, target],
  )

  return (
    <article
      className={`cp-card card pressable ${done ? 'is-done' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${item.name}${done ? '（已完成）' : ''}`}
      {...handlers}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="cp-card__cover">
        <GeneratedCover
          char={moduleChar(moduleName)}
          from={colors.from}
          to={colors.to}
          durationText={item.durationText}
        />
        <CheckButton
          className="cp-card__check"
          variant="on-cover"
          done={done}
          onToggle={() => onToggleDone(item.key)}
          label={done ? `取消完成：${item.name}` : `标记完成：${item.name}`}
        />
      </div>
      <div className="cp-card__body">
        <h3 className="cp-card__title">{item.name}</h3>
        <div className="cp-card__meta">
          <LevelTag level={item.level} difficulty={item.difficulty} />
        </div>
      </div>
    </article>
  )
}

/* ============================== 模块折叠分组 ============================== */

interface SystemModuleProps {
  stat: ModuleStat
  expanded: boolean
  done: Record<string, DoneEntry>
  onToggleModule: (id: string) => void
  onToggleDone: (key: string) => void
  onPlay: (target: PlayTarget) => void
  onMenu: (menu: CardMenuState) => void
}

function SystemModule({
  stat,
  expanded,
  done,
  onToggleModule,
  onToggleDone,
  onPlay,
  onMenu,
}: SystemModuleProps) {
  const module = stat.module
  const colors = useMemo(() => moduleColor(stat.index), [stat.index])
  const items = useMemo(
    () => SYSTEM_ITEMS.filter((item) => item.moduleId === module.id),
    [module.id],
  )
  const donePercent = percent(stat.ratio)
  const gridId = `cp-module-${module.id}`

  return (
    <section className={`cp-module ${expanded ? 'is-open' : ''}`}>
      <div className="cp-module__panel card">
        <button
          type="button"
          className="cp-module__head"
          onClick={() => onToggleModule(module.id)}
          aria-expanded={expanded}
          aria-controls={gridId}
        >
          <span className="cp-module__name">{module.name}</span>
          <span className="cp-module__count">
            {stat.done}/{stat.total}
          </span>
          <ChevronDownIcon
            size={16}
            className={`cp-module__chevron ${expanded ? 'is-open' : ''}`}
          />
        </button>
        <div className="cp-module__bar progress-bar" aria-hidden="true">
          <div className="progress-bar__fill" style={{ width: `${donePercent}%` }} />
        </div>
      </div>
      {expanded ? (
        <div className="cp-grid" id={gridId} role="group" aria-label={`${module.name}知识点`}>
          {items.map((item) => (
            <SystemCard
              key={item.key}
              item={item}
              moduleName={module.name}
              colors={colors}
              done={Boolean(done[item.key])}
              onToggleDone={onToggleDone}
              onPlay={onPlay}
              onMenu={onMenu}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

/* ============================== 专题课卡片 ============================== */

interface TopicVideoCardProps {
  video: FlatTopicVideo
  colors: GradientPair
  done: boolean
  onToggleDone: (key: string) => void
  onPlay: (target: PlayTarget) => void
  onMenu: (menu: CardMenuState) => void
}

function TopicVideoCard({
  video,
  colors,
  done,
  onToggleDone,
  onPlay,
  onMenu,
}: TopicVideoCardProps) {
  const target = useMemo<PlayTarget>(
    () => ({
      kind: 'topic',
      key: video.key,
      name: video.title,
      bvid: video.bvid,
      subtitle: video.topicTitle,
    }),
    [video],
  )

  const openMenu = useCallback(() => {
    onMenu({ target, bvid: video.bvid, done, toggleKey: video.key })
  }, [onMenu, target, done, video.bvid, video.key])

  const { handlers, consumeSuppressedClick } = useLongPress(openMenu)

  const handleClick = useCallback(() => {
    if (consumeSuppressedClick()) return
    onPlay(target)
  }, [consumeSuppressedClick, onPlay, target])

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onPlay(target)
    },
    [onPlay, target],
  )

  return (
    <article
      className={`cp-card card pressable ${done ? 'is-done' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${video.title}${done ? '（已完成）' : ''}`}
      {...handlers}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="cp-card__cover">
        <RemoteCover
          src={video.cover}
          alt={video.title}
          fallbackChar={video.topicTitle.charAt(0) || '数'}
          from={colors.from}
          to={colors.to}
          durationText={video.durationText}
        />
        <CheckButton
          className="cp-card__check"
          variant="on-cover"
          done={done}
          onToggle={() => onToggleDone(video.key)}
          label={done ? `取消完成：${video.title}` : `标记完成：${video.title}`}
        />
      </div>
      <div className="cp-card__body">
        <h3 className="cp-card__title">{video.title}</h3>
        <div className="cp-card__meta">
          {typeof video.views === 'number' ? (
            <span className="cp-card__views">
              <PlayIcon size={11} />
              {formatCount(video.views)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/* ============================== 专题课视图 ============================== */

interface TopicViewProps {
  activeIndex: number
  onSelectTopic: (index: number) => void
  done: Record<string, DoneEntry>
  onToggleDone: (key: string) => void
  onPlay: (target: PlayTarget) => void
  onMenu: (menu: CardMenuState) => void
}

function TopicView({
  activeIndex,
  onSelectTopic,
  done,
  onToggleDone,
  onPlay,
  onMenu,
}: TopicViewProps) {
  const activeTopic = TOPICS[activeIndex]
  const videos = useMemo(
    () => (activeTopic ? TOPIC_VIDEOS.filter((video) => video.topicId === activeTopic.id) : []),
    [activeTopic],
  )
  const colors = useMemo(() => topicGradient(activeIndex), [activeIndex])

  return (
    <div className="cp-topic">
      <div className="cp-tabs hscroll" role="tablist" aria-label="专题合集">
        {TOPICS.map((topic, index) => {
          const stat = topicStat(done, topic.seasonId)
          const active = index === activeIndex
          return (
            <button
              key={topic.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`chip cp-tab ${active ? 'is-active' : ''}`}
              onClick={() => onSelectTopic(index)}
            >
              <span className="cp-tab__title">{topic.title}</span>
              <span className="cp-tab__count">
                {stat.done}/{stat.total}
              </span>
            </button>
          )
        })}
      </div>
      {activeTopic ? (
        videos.length > 0 ? (
          <div className="cp-grid">
            {videos.map((video) => (
              <TopicVideoCard
                key={video.key}
                video={video}
                colors={colors}
                done={Boolean(done[video.key])}
                onToggleDone={onToggleDone}
                onPlay={onPlay}
                onMenu={onMenu}
              />
            ))}
          </div>
        ) : (
          <div className="empty">这个合集还没有视频</div>
        )
      ) : (
        <div className="empty">暂无专题合集</div>
      )}
    </div>
  )
}

/* ============================== 页面 ============================== */

export function CoursePage({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { state, toggleDone } = useApp()
  const { play } = useJump()
  const { showToast } = useToast()

  const [view, setView] = useState<CourseView>('system')
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const first = MODULES[0]
    return new Set(first ? [first.id] : [])
  })
  const [topicIndex, setTopicIndex] = useState(0)
  const [menu, setMenu] = useState<CardMenuState | null>(null)

  const progress = useMemo(() => totalSystemProgress(state.done), [state.done])
  const stats = useMemo(() => moduleStats(state.done), [state.done])
  const nextTarget = useMemo(() => firstUnfinished(state.done), [state.done])
  const progressPercent = percent(progress.ratio)

  const toggleModule = useCallback((id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleContinue = useCallback(() => {
    if (!nextTarget) return
    play({
      kind: 'system',
      key: nextTarget.key,
      name: nextTarget.name,
      bvid: SYSTEM_BVID,
      p: nextTarget.p,
      subtitle: nextTarget.moduleName,
    })
  }, [nextTarget, play])

  const openMenu = useCallback((next: CardMenuState) => {
    setMenu(next)
  }, [])

  const copyBv = useCallback(
    (bvid: string) => {
      const succeed = () => showToast('已复制 BV 号')
      const fallback = () => {
        try {
          const textarea = document.createElement('textarea')
          textarea.value = bvid
          textarea.setAttribute('readonly', '')
          textarea.style.position = 'fixed'
          textarea.style.top = '-1000px'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          const ok = document.execCommand('copy')
          document.body.removeChild(textarea)
          if (ok) succeed()
          else showToast('复制失败，请手动复制')
        } catch {
          showToast('复制失败，请手动复制')
        }
      }
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        void navigator.clipboard.writeText(bvid).then(succeed, fallback)
      } else {
        fallback()
      }
    },
    [showToast],
  )

  const menuItems: ActionSheetItem[] = menu
    ? [
        {
          key: 'toggle',
          label: menu.done ? '取消完成' : '标记完成',
          icon: <CheckIcon size={18} />,
          onClick: () => {
            toggleDone(menu.toggleKey)
            showToast(menu.done ? '已取消完成' : '已标记完成 ✓')
          },
        },
        {
          key: 'copy',
          label: '复制 BV 号',
          icon: <CopyIcon size={18} />,
          onClick: () => copyBv(menu.bvid),
        },
        {
          key: 'browser',
          label: '在浏览器打开',
          icon: <ExternalLinkIcon size={18} />,
          onClick: () => openInBrowser(menu.target),
        },
      ]
    : []

  return (
    <div className="page cp-page">
      <header className="page-head cp-head">
        <div className="cp-head__text">
          <h1 className="page-title">一数复习</h1>
          <p className="page-subtitle">
            {UP.name} · 高中数学 · {TOTAL_KP} 个知识点
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onOpenSearch} aria-label="搜索知识点">
          <SearchIcon size={20} />
        </button>
      </header>

      {/* Hero：总进度 + 继续复习 */}
      <section className="cp-hero card" aria-label="系统课总进度">
        <div className="cp-hero__ring">
          <ProgressRing
            value={progress.ratio}
            size={92}
            stroke={8}
            label={`系统课总进度 ${progressPercent}%`}
          >
            <span className="cp-hero__percent">
              {progressPercent}
              <span className="cp-hero__percent-unit">%</span>
            </span>
          </ProgressRing>
        </div>
        <div className="cp-hero__info">
          <p className="cp-hero__eyebrow">系统课总进度</p>
          <p className="cp-hero__meta">
            已完成 <strong>{progress.done}</strong> / {progress.total} 个知识点 ·{' '}
            {formatHoursLabel(progress.secondsDone)}
          </p>
          <button
            type="button"
            className="btn btn--primary cp-hero__btn"
            onClick={handleContinue}
            disabled={!nextTarget}
          >
            {nextTarget ? (
              <>
                <PlayIcon size={16} />
                继续复习
              </>
            ) : (
              '🎉 全部完成'
            )}
          </button>
        </div>
      </section>

      <div className="cp-seg">
        <Segmented items={VIEW_ITEMS} value={view} onChange={setView} ariaLabel="课程类型" />
      </div>

      {view === 'system' ? (
        stats.length > 0 ? (
          <div className="cp-modules">
            {stats.map((stat) => (
              <SystemModule
                key={stat.module.id}
                stat={stat}
                expanded={expanded.has(stat.module.id)}
                done={state.done}
                onToggleModule={toggleModule}
                onToggleDone={toggleDone}
                onPlay={play}
                onMenu={openMenu}
              />
            ))}
          </div>
        ) : (
          <div className="empty">暂无系统课模块</div>
        )
      ) : (
        <TopicView
          activeIndex={topicIndex}
          onSelectTopic={setTopicIndex}
          done={state.done}
          onToggleDone={toggleDone}
          onPlay={play}
          onMenu={openMenu}
        />
      )}

      <ActionSheet
        open={menu !== null}
        title={menu?.target.name}
        items={menuItems}
        onClose={() => setMenu(null)}
      />
    </div>
  )
}
