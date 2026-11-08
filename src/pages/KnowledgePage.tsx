import { useMemo, useState } from 'react'
import './KnowledgePage.css'
import { CheckIcon, ChevronDownIcon, ClockIcon } from '../components/Icons'
import { normalizeLevel } from '../components/LevelTag'
import { ProgressRing } from '../components/ProgressRing'
import { MODULES, SYSTEM_BVID, TOTAL_KP, TOTAL_MODULES, UP, systemKey } from '../data'
import { formatHoursLabel, percent } from '../lib/format'
import { useJump } from '../lib/jump'
import { moduleStats, totalSystemProgress, weakestModules } from '../lib/progress'
import { useApp } from '../store/AppStore'

/** 难度 → 未点亮 chip 的边框色（基础绿 / 中档橙 / 拔高红） */
const LEVEL_CHIP_CLASS: Record<string, string> = {
  基础: 'k-chip--basic',
  中档: 'k-chip--mid',
  拔高: 'k-chip--hard',
}

/**
 * 页面 2 · 知识体系
 * 总进度大环 + 24 个模块折叠列表（模块 24px 小环、知识点 chip 点击直达 B站）+ 最弱模块。
 * 模块顺序严格取 courses.json 原顺序（MODULES），绝不重排。
 */
export function KnowledgePage() {
  const { state } = useApp()
  const { play } = useJump()

  const progress = useMemo(() => totalSystemProgress(state.done), [state.done])
  const stats = useMemo(() => moduleStats(state.done), [state.done])
  const weakest = useMemo(() => weakestModules(state.done, 3), [state.done])
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set<number>())

  const allExpanded = expanded.size >= MODULES.length
  const allDone = progress.total > 0 && progress.done >= progress.total
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
            {UP.name} · {TOTAL_MODULES} 个模块 · {TOTAL_KP} 个知识点
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
        {stats.map((stat) => {
          const module = stat.module
          const open = expanded.has(stat.index)
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
                  {module.items.map((item) => {
                    const done = Boolean(state.done[systemKey(item.p)])
                    const level = normalizeLevel(item.level, item.difficulty)
                    const levelClass = done ? '' : LEVEL_CHIP_CLASS[level] ?? ''
                    return (
                      <button
                        key={item.p}
                        type="button"
                        className={`chip k-chip ${done ? 'is-active' : ''} ${levelClass}`.trim()}
                        title={`${module.name} · ${item.name} · ${item.durationText}`}
                        onClick={() => jumpToItem(module.name, item.p, item.name)}
                      >
                        {done ? <CheckIcon size={12} strokeWidth={3} /> : null}
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

      {weakest.length > 0 ? (
        <>
          <div className="section-title">
            <span>最弱模块</span>
            <span className="section-title__extra">
              {allDone ? '全部已完成 🎉' : '建议先复习'}
            </span>
          </div>
          <section className="card k-weak">
            {weakest.map((stat) => (
              <div className="k-weak__row" key={stat.module.id}>
                <div className="k-weak__top">
                  <span className="k-weak__name">{stat.module.name}</span>
                  <span className="k-weak__pct">{percent(stat.ratio)}%</span>
                </div>
                <div className="progress-bar k-weak__bar">
                  <div
                    className="progress-bar__fill"
                    style={{ width: `${percent(stat.ratio)}%` }}
                  />
                </div>
                <p className="k-weak__meta">
                  已看 {stat.done} / {stat.total} 个知识点
                </p>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  )
}
