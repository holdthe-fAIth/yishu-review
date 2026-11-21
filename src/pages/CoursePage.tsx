import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { SubjectSwitch } from '../components/SubjectSwitch'
import { useToast } from '../components/Toast'
import {
  DATA_GENERATED_AT,
  formatPubdate,
  getSubject,
  isStaleVideo,
  moduleChar,
  moduleColor,
  pubdateRelative,
  topicGradient,
  type GradientPair,
  type SubjectView,
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
import { isTopicComplete, orderItems, orderTopicVideos, orderTopics } from '../lib/sort'
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
      bvid: item.bvid,
      p: item.p,
      subtitle: moduleName,
    }),
    [item, moduleName],
  )

  const openMenu = useCallback(() => {
    onMenu({ target, bvid: item.bvid, done, toggleKey: item.key })
  }, [onMenu, target, done, item.key, item.bvid])

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

  // v2：卡片上显示发布时间（封面左下角完整日期 + 标题下「3 年前」小字）
  const pubdateText = formatPubdate(item.pubdate)
  const pubdateHint = pubdateRelative(item.pubdate)

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
          dateText={pubdateText}
          dateOld={isStaleVideo(item.pubdate)}
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
          {pubdateHint ? (
            <span className="cp-card__pubdate" title={pubdateText || undefined}>
              {pubdateHint}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/* ============================== 模块折叠分组 ============================== */

interface SystemModuleProps {
  subject: SubjectView
  stat: ModuleStat
  expanded: boolean
  done: Record<string, DoneEntry>
  /** 已学完的模块 / 知识点自动排到最后（设置项） */
  sortCompletedLast: boolean
  onToggleModule: (id: string) => void
  onToggleDone: (key: string) => void
  onPlay: (target: PlayTarget) => void
  onMenu: (menu: CardMenuState) => void
}

function SystemModule({
  subject,
  stat,
  expanded,
  done,
  sortCompletedLast,
  onToggleModule,
  onToggleDone,
  onPlay,
  onMenu,
}: SystemModuleProps) {
  const module = stat.module
  // 配色必须用模块的原始下标（stat.index），它在列表排序后不会变
  const colors = useMemo(() => moduleColor(stat.index), [stat.index])
  // 模块内：未学在前、已学在后（稳定排序，未学内容相对顺序不变）
  const items = useMemo(
    () =>
      orderItems(
        subject.systemItems.filter((item) => item.moduleId === module.id),
        done,
        sortCompletedLast,
      ),
    [subject.systemItems, module.id, done, sortCompletedLast],
  )
  const donePercent = percent(stat.ratio)
  const complete = stat.total > 0 && stat.done >= stat.total
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
          <span className={`cp-module__count ${complete ? 'is-complete' : ''}`.trim()}>
            {complete ? '✓ ' : ''}
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

  // v2：封面左下角完整发布日期 + 标题下「3 年前」小字
  const pubdateText = formatPubdate(video.pubdate)
  const pubdateHint = pubdateRelative(video.pubdate)

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
          durationText={
            video.partCount && video.partCount > 1 ? `${video.partCount} 讲` : video.durationText
          }
          dateText={pubdateText}
          dateOld={isStaleVideo(video.pubdate)}
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
          {pubdateHint ? (
            <span className="cp-card__pubdate" title={pubdateText || undefined}>
              {pubdateHint}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/* ============================== 专题课视图 ============================== */

interface TopicViewProps {
  subject: SubjectView
  activeTopicId: string
  onSelectTopic: (topicId: string) => void
  done: Record<string, DoneEntry>
  /** 已刷完的合集 / 视频自动排到最后（设置项） */
  sortCompletedLast: boolean
  onToggleDone: (key: string) => void
  onPlay: (target: PlayTarget) => void
  onMenu: (menu: CardMenuState) => void
}

function TopicView({
  subject,
  activeTopicId,
  onSelectTopic,
  done,
  sortCompletedLast,
  onToggleDone,
  onPlay,
  onMenu,
}: TopicViewProps) {
  // 合集 tab：全部刷完的合集排到最后，未刷完的保持原始顺序
  const topics = useMemo(
    () => orderTopics(subject.topics, subject.info.id, done, sortCompletedLast),
    [subject.topics, subject.info.id, done, sortCompletedLast],
  )
  // 合集主题色固定按「原始下标」取，tab 重排后颜色不跟着换
  const topicColors = useMemo(() => {
    const map = new Map<string, GradientPair>()
    subject.topics.forEach((topic, index) => map.set(topic.id, topicGradient(index)))
    return map
  }, [subject.topics])

  // 选中态按合集 id 记录（不能按下标，否则排序后选中项会跑到别的合集）
  const activeTopic = subject.topicById.get(activeTopicId) ?? topics[0]
  const colors = (activeTopic && topicColors.get(activeTopic.id)) || topicGradient(0)
  // 当前合集内：未看在前、已看在后，未看视频相对顺序不变
  const videos = useMemo(
    () =>
      activeTopic
        ? orderTopicVideos(
            subject.topicVideos.filter((video) => video.topicId === activeTopic.id),
            done,
            sortCompletedLast,
          )
        : [],
    [activeTopic, subject.topicVideos, done, sortCompletedLast],
  )

  return (
    <div className="cp-topic">
      <div className="cp-tabs hscroll" role="tablist" aria-label="专题合集">
        {topics.map((topic) => {
          const stat = topicStat(subject, done, topic.seasonId)
          const active = topic.id === activeTopic?.id
          const complete = isTopicComplete(topic, subject.info.id, done)
          return (
            <button
              key={topic.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`chip cp-tab ${active ? 'is-active' : ''} ${
                complete ? 'is-complete' : ''
              }`.trim()}
              onClick={() => onSelectTopic(topic.id)}
            >
              <span className="cp-tab__title">{topic.title}</span>
              <span className="cp-tab__count">
                {complete ? '✓ ' : ''}
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

/** 模块是否已全部学完 */
function isModuleComplete(stat: ModuleStat): boolean {
  return stat.total > 0 && stat.done >= stat.total
}

/**
 * 系统课模块列表排序（v2）：
 * 全部学完的模块排到最后；未学完的保持原始复习顺序。
 * 注意 stat.index 仍是原始模块下标，配色 / 展开状态都用它，不受列表排序影响。
 */
function orderModuleStats(stats: ModuleStat[], enabled: boolean): ModuleStat[] {
  if (!enabled) return stats
  return [...stats].sort(
    (a, b) => Number(isModuleComplete(a)) - Number(isModuleComplete(b)),
  )
}

export function CoursePage({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { state, settings, toggleDone, updateSettings } = useApp()
  const { play } = useJump()
  const { showToast } = useToast()
  const subject = getSubject(settings.activeSubject)

  const [view, setView] = useState<CourseView>('system')
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // 默认展开第一个未完成模块；全部学完时不自动展开任何模块
    const first = orderModuleStats(
      moduleStats(subject, state.done),
      settings.sortCompletedLast,
    ).find((stat) => !isModuleComplete(stat))
    return new Set(first ? [first.module.id] : [])
  })
  // 选中合集按 id 记录：tab 排序后不会选错合集
  const [topicId, setTopicId] = useState<string>(
    () =>
      orderTopics(subject.topics, subject.info.id, state.done, settings.sortCompletedLast)[0]
        ?.id ??
      subject.topics[0]?.id ??
      '',
  )
  const [menu, setMenu] = useState<CardMenuState | null>(null)

  const progress = useMemo(
    () => totalSystemProgress(subject, state.done),
    [subject, state.done],
  )
  const stats = useMemo(
    () =>
      orderModuleStats(moduleStats(subject, state.done), settings.sortCompletedLast),
    [subject, state.done, settings.sortCompletedLast],
  )
  /** 当前已全部学完的模块 id；用于检测「未完成 → 完成」的瞬间 */
  const completedModuleIds = useMemo(
    () => stats.filter(isModuleComplete).map((stat) => stat.module.id),
    [stats],
  )
  /** 上一次的已完成模块集合；首次只记录基线，不触发收起 */
  const completedModuleIdsRef = useRef<Set<string> | null>(null)

  // 模块学完会被排到列表末尾，同时自动收起。
  // 只处理「未完成 → 完成」的转变，用户手动展开的已完成模块不会被误关。
  // 用 layout effect 在绘制前收起，避免模块在底部先闪一下展开态。
  useLayoutEffect(() => {
    const current = new Set(completedModuleIds)
    const previous = completedModuleIdsRef.current
    completedModuleIdsRef.current = current
    if (!previous || !settings.sortCompletedLast) return

    const justCompleted = completedModuleIds.filter((id) => !previous.has(id))
    if (justCompleted.length === 0) return

    setExpanded((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of justCompleted) {
        if (next.delete(id)) changed = true
      }
      return changed ? next : prev
    })
  }, [completedModuleIds, settings.sortCompletedLast])

  const nextTarget = useMemo(
    () => firstUnfinished(subject, state.done),
    [subject, state.done],
  )
  const progressPercent = percent(progress.ratio)

  const handleSubjectChange = useCallback(
    (subjectId: string) => {
      updateSettings({ activeSubject: subjectId })
    },
    [updateSettings],
  )

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
      bvid: nextTarget.bvid,
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
            {subject.info.up.name} · 高中{subject.info.name} · {subject.totalKp} 个知识点 ·{' '}
            <span className="cp-head__updated">
              内容更新于 {DATA_GENERATED_AT.slice(0, 10)}
            </span>
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onOpenSearch} aria-label="搜索知识点">
          <SearchIcon size={20} />
        </button>
      </header>

      <div className="cp-subject">
        <SubjectSwitch value={subject.info.id} onChange={handleSubjectChange} />
      </div>

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

      {subject.totalTopics > 0 ? (
        <div className="cp-seg">
          <Segmented items={VIEW_ITEMS} value={view} onChange={setView} ariaLabel="课程类型" />
        </div>
      ) : null}

      {view === 'system' || subject.totalTopics === 0 ? (
        stats.length > 0 ? (
          <div className="cp-modules">
            {stats.map((stat) => (
              <SystemModule
                key={stat.module.id}
                subject={subject}
                stat={stat}
                expanded={expanded.has(stat.module.id)}
                done={state.done}
                sortCompletedLast={settings.sortCompletedLast}
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
          subject={subject}
          activeTopicId={topicId}
          onSelectTopic={setTopicId}
          done={state.done}
          sortCompletedLast={settings.sortCompletedLast}
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
