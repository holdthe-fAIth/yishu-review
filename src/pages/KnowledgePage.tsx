import { useMemo, useState } from 'react'
import './KnowledgePage.css'
import { CheckIcon, ChevronDownIcon, ClockIcon } from '../components/Icons'
import { normalizeLevel } from '../components/LevelTag'
import { ProgressRing } from '../components/ProgressRing'
import {
  DATA_GENERATED_AT,
  MODULES,
  SYSTEM_BVID,
  TOTAL_KP,
  TOTAL_MODULES,
  UP,
  systemKey,
} from '../data'
import { formatHoursLabel, percent } from '../lib/format'
import { useJump } from '../lib/jump'
import { moduleStats, totalSystemProgress } from '../lib/progress'
import { orderItems, orderModules } from '../lib/sort'
import { useApp } from '../store/AppStore'
import type { SystemItem } from '../types'

/** 难度 → 未点亮 chip 的边框色（基础绿 / 中档橙 / 拔高红） */
const LEVEL_CHIP_CLASS: Record<string, string> = {
  基础: 'k-chip--basic',
  中档: 'k-chip--mid',
  拔高: 'k-chip--hard',
}

/** 展开后的知识点 chip 行（带存储 key 与打勾状态，供排序复用） */
interface ChipRow extends SystemItem {
  key: string
  done: boolean
}

/**
 * 页面 2 · 知识体系
 * 总进度大环 + 24 个模块折叠列表（模块 24px 小环、知识点 chip 点击直达 B站）。
 * 开启「已学内容排到最后」时：全部学完的模块排到列表末尾、已打勾的 chip 排到模块末尾；
 * 未学内容保持 courses.json 原复习顺序。
 */
export function KnowledgePage() {
  const { state, settings } = useApp()
  const { play } = useJump()

  const progress = useMemo(() => totalSystemProgress(state.done), [state.done])
  const stats = useMemo(() => moduleStats(state.done), [state.done])
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set<number>())

  /**
   * 模块顺序：全部学完的模块排到最后（受设置项 sortCompletedLast 控制）。
   * moduleStats 的 index 对应 MODULES 原顺序，排序后仍按 index 取回原始 stat。
   */
  const orderedStats = useMemo(() => {
    const statByIndex = new Map(stats.map((stat) => [stat.index, stat]))
    const ordered = orderModules(
      stats.map((stat) => ({ ...stat.module, index: stat.index })),
      state.done,
      settings.sortCompletedLast,
    )
    return ordered.flatMap((module) => {
      const stat = statByIndex.get(module.index)
      return stat ? [stat] : []
    })
  }, [stats, state.done, settings.sortCompletedLast])

  /** 每个模块展开后的 chip 顺序：已打勾的排到末尾，未学保持原顺序 */
  const chipsByModule = useMemo(() => {
    const map = new Map<number, ChipRow[]>()
    for (const stat of stats) {
      const rows: ChipRow[] = stat.module.items.map((item) => {
        const key = systemKey(item.p)
        return { ...item, key, done: Boolean(state.done[key]) }
      })
      map.set(stat.index, orderItems(rows, state.done, settings.sortCompletedLast))
    }
    return map
  }, [stats, state.done, settings.sortCompletedLast])

  const allExpanded = expanded.size >= MODULES.length
  const watchedLabel =
    progress.secondsDone > 0 ? formatHoursLabel(progress.secondsDone) : '约 0 分钟'

  function toggleModule(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleAll() {
    setExpanded((prev) =>
      prev.size >= MODULES.length ? new Set<number>() : new Set<number>(MODULES.map((_, i) => i)),
    )
  }

  /** 点 chip 直接深链跳 B站对应分P（不带打勾，打勾在 course 页卡片热区 / 返回浮条） */
  function jumpToItem(moduleName: string, p: number, name: string) {
    play({
      kind: 'system',
      key: systemKey(p),
      name,
      bvid: SYSTEM_BVID,
      p,
      subtitle: moduleName,
    })
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">知识体系</h1>
          <p className="page-subtitle">
            {UP.name} · {TOTAL_MODULES} 个模块 · {TOTAL_KP} 个知识点 · 内容更新于{' '}
            {DATA_GENERATED_AT.slice(0, 10)}
          </p>
        </div>
      </header>

      <section className="card k-hero">
        <ProgressRing size={124} stroke={10} value={progress.ratio} label="系统课总进度">
          <span className="k-hero__pct">
            {percent(progress.ratio)}
            <i>%</i>
          </span>
          <span className="k-hero__pct-label">总进度</span>
        </ProgressRing>
        <div className="k-hero__info">
          <p className="k-hero__done">
            已完成 <b>{progress.done}</b> / {TOTAL_KP} 个知识点
          </p>
          <p className="k-hero__time">
            <ClockIcon size={14} />
            {watchedLabel}
          </p>
          <p className="k-hero__hint">按模块顺序复习 · 点知识点直达 B站对应分P</p>
        </div>
      </section>

      <div className="section-title">
        <span>全部模块</span>
        <button type="button" className="k-expandall" onClick={toggleAll}>
          {allExpanded ? '收起全部' : '展开全部'}
        </button>
      </div>

      <section className="card k-modules">
        {orderedStats.map((stat) => {
          const module = stat.module
          const open = expanded.has(stat.index)
          const chips = chipsByModule.get(stat.index) ?? []
          return (
            <article className={`k-module ${open ? 'is-open' : ''}`.trim()} key={module.id}>
              <button
                type="button"
                className="k-module__head"
                aria-expanded={open}
                aria-controls={`k-items-${module.id}`}
                onClick={() => toggleModule(stat.index)}
              >
                <ProgressRing
                  size={24}
                  stroke={3}
                  value={stat.ratio}
                  label={`${module.name} 完成 ${percent(stat.ratio)}%`}
                />
                <span className="k-module__name">{module.name}</span>
                <span className="k-module__count">
                  已看 <b>{stat.done}</b> / {stat.total}
                </span>
                <ChevronDownIcon
                  size={16}
                  className={`k-module__chev ${open ? 'is-open' : ''}`.trim()}
                />
              </button>

              {open ? (
                <div className="k-module__items" id={`k-items-${module.id}`}>
                  {chips.map((item) => {
                    const level = normalizeLevel(item.level, item.difficulty)
                    const levelClass = item.done ? '' : LEVEL_CHIP_CLASS[level] ?? ''
                    return (
                      <button
                        key={item.p}
                        type="button"
                        className={`chip k-chip ${item.done ? 'is-active' : ''} ${levelClass}`.trim()}
                        title={`${module.name} · ${item.name} · ${item.durationText}`}
                        onClick={() => jumpToItem(module.name, item.p, item.name)}
                      >
                        {item.done ? <CheckIcon size={12} strokeWidth={3} /> : null}
                        <span className="k-chip__text">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </article>
          )
        })}
      </section>
    </div>
  )
}
