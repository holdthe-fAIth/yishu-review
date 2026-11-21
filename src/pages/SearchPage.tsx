import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ALL_SYSTEM_ITEMS,
  ALL_TOPIC_VIDEOS,
  TOTAL_KP,
  TOTAL_TOPIC_VIDEOS,
  getSubject,
  moduleChar,
  moduleColor,
  topicGradient,
} from '../data'
import { useApp } from '../store/AppStore'
import { useJump } from '../lib/jump'
import { LevelTag, normalizeLevel } from '../components/LevelTag'
import { ArrowLeftIcon, CloseIcon, SearchIcon } from '../components/Icons'
import { GeneratedCover, RemoteCover } from '../components/Cover'
import { CheckButton } from '../components/CheckButton'
import type { FlatSystemItem, FlatTopicVideo } from '../types'
import './SearchPage.css'

interface SearchPageProps {
  open: boolean
  onClose: () => void
}

type LevelFilter = '全部' | '基础' | '中档' | '拔高'

type SearchResult =
  | { kind: 'system'; item: FlatSystemItem }
  | { kind: 'topic'; video: FlatTopicVideo }

const LEVEL_FILTERS: LevelFilter[] = ['全部', '基础', '中档', '拔高']

/** 全屏搜索页：跨科目搜索系统课知识点 + 专题视频，支持难度筛选 */
export function SearchPage({ open, onClose }: SearchPageProps) {
  const { state, toggleDone } = useApp()
  const { play } = useJump()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<LevelFilter>('全部')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setLevel('全部')
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const keyword = query.trim().toLowerCase()

  const results = useMemo<SearchResult[]>(() => {
    if (!keyword) return []
    const systemResults: SearchResult[] = ALL_SYSTEM_ITEMS.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.moduleName.toLowerCase().includes(keyword) ||
        item.subjectName.toLowerCase().includes(keyword),
    ).map((item) => ({ kind: 'system', item }))
    const topicResults: SearchResult[] = ALL_TOPIC_VIDEOS.filter(
      (video) =>
        video.title.toLowerCase().includes(keyword) ||
        video.topicTitle.toLowerCase().includes(keyword) ||
        video.subjectName.toLowerCase().includes(keyword),
    ).map((video) => ({ kind: 'topic', video }))

    let merged = [...systemResults, ...topicResults]
    if (level !== '全部') {
      merged = merged.filter((result) => {
        if (result.kind !== 'system') return false
        return normalizeLevel(result.item.level, result.item.difficulty) === level
      })
    }
    return merged.slice(0, 60)
  }, [keyword, level])

  if (!open) return null

  const jumpToSystem = (item: FlatSystemItem) => {
    play({
      kind: 'system',
      key: item.key,
      name: item.name,
      bvid: item.bvid,
      p: item.p,
      subtitle: item.moduleName,
    })
    onClose()
  }

  const jumpToTopic = (video: FlatTopicVideo) => {
    play({
      kind: 'topic',
      key: video.key,
      name: video.title,
      bvid: video.bvid,
      subtitle: video.topicTitle,
    })
    onClose()
  }

  return (
    <div className="search-page" role="dialog" aria-modal="true" aria-label="搜索">
      <div className="search-page__head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="返回">
          <ArrowLeftIcon size={22} />
        </button>
        <div className="search-page__input-wrap">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索知识点 / 专题视频"
            aria-label="搜索知识点或专题视频"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              className="search-page__clear"
              onClick={() => setQuery('')}
              aria-label="清空搜索"
            >
              <CloseIcon size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="search-page__filters hscroll">
        {LEVEL_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip ${level === item ? 'is-active' : ''}`}
            onClick={() => setLevel(item)}
            aria-pressed={level === item}
          >
            {item === '全部' ? '全部难度' : item}
          </button>
        ))}
      </div>

      <div className="search-page__body">
        {!keyword ? (
          <div className="empty">
            <div className="empty__title">搜点什么</div>
            输入关键词，搜索 {TOTAL_KP} 个知识点和 {TOTAL_TOPIC_VIDEOS} 条专题视频
          </div>
        ) : results.length === 0 ? (
          <div className="empty">
            <div className="empty__title">没有找到</div>
            换个关键词试试，或切换难度筛选
          </div>
        ) : (
          <ul className="search-results">
            {results.map((result) => {
              if (result.kind === 'system') {
                const { item } = result
                const gradient = moduleColor(item.moduleIndex)
                return (
                  <li key={`s-${item.key}`} className="search-result">
                    <button
                      type="button"
                      className="search-result__main pressable"
                      onClick={() => jumpToSystem(item)}
                    >
                      <div className="search-result__cover">
                        <GeneratedCover
                          char={moduleChar(item.moduleName)}
                          from={gradient.from}
                          to={gradient.to}
                          durationText={item.durationText}
                        />
                      </div>
                      <div className="search-result__info">
                        <div className="search-result__title">{item.name}</div>
                        <div className="search-result__meta">
                          <span>{item.subjectName} · {item.moduleName}</span>
                          {item.no ? <span>第 {item.no} 讲</span> : null}
                          <LevelTag level={item.level} difficulty={item.difficulty} />
                        </div>
                      </div>
                    </button>
                    <CheckButton
                      variant="light"
                      done={Boolean(state.done[item.key])}
                      onToggle={() => toggleDone(item.key)}
                      label={`${state.done[item.key] ? '取消' : '标记'}完成：${item.name}`}
                    />
                  </li>
                )
              }

              const { video } = result
              const topicIndex = getSubject(video.subjectId).topics.findIndex(
                (topic) => topic.seasonId === video.seasonId,
              )
              const gradient = topicGradient(Math.max(0, topicIndex))
              return (
                <li key={`t-${video.key}`} className="search-result">
                  <button
                    type="button"
                    className="search-result__main pressable"
                    onClick={() => jumpToTopic(video)}
                  >
                    <div className="search-result__cover">
                      <RemoteCover
                        src={video.cover}
                        alt={video.title}
                        fallbackChar={video.topicTitle.charAt(0)}
                        from={gradient.from}
                        to={gradient.to}
                        durationText={
                          video.partCount && video.partCount > 1
                            ? `${video.partCount} 讲`
                            : video.durationText
                        }
                      />
                    </div>
                    <div className="search-result__info">
                      <div className="search-result__title">{video.title}</div>
                      <div className="search-result__meta">
                        <span>{video.subjectName} · 专题 · {video.topicTitle}</span>
                      </div>
                    </div>
                  </button>
                  <CheckButton
                    variant="light"
                    done={Boolean(state.done[video.key])}
                    onToggle={() => toggleDone(video.key)}
                    label={`${state.done[video.key] ? '取消' : '标记'}完成：${video.title}`}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
