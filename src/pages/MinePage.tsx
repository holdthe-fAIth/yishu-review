import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import './MinePage.css'
import {
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  FlameIcon,
  TrashIcon,
  UploadIcon,
  VideoIcon,
} from '../components/Icons'
import { Segmented, type SegmentedItem } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { TOTAL_KP, TOTAL_MODULES, UP } from '../data'
import { formatCount, formatHoursLabel, formatStamp, percent } from '../lib/format'
import { moduleStats, streakDays, watchedCount, watchedSeconds } from '../lib/progress'
import { normalizeState, useApp } from '../store/AppStore'
import type { AppState, ThemeMode } from '../types'

const THEME_ITEMS: SegmentedItem<ThemeMode>[] = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'auto', label: '跟随系统' },
]

const EXPORT_APP = 'yishu-review'

/** 累计时长 → 大数字 + 单位（沿用 formatHoursLabel 的文案，拆开排版） */
function splitDurationLabel(seconds: number): { value: string; unit: string } {
  if (seconds <= 0) return { value: '0', unit: '分钟' }
  const [value, unit = ''] = formatHoursLabel(seconds).replace(/^约\s*/, '').split(' ')
  return { value, unit }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 页面 3 · 我的
 * 学习统计 + 24 个模块完成率条形图 + 数据管理（导出 / 导入 / 重置）+ 设置 + 关于。
 * 所有数据都来自本机 localStorage（store 收口），不请求任何网络接口。
 */
export function MinePage() {
  const { state, settings, updateSettings, replaceState, reset } = useApp()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 待确认覆盖的导入数据（解析成功后才弹 Sheet） */
  const [pendingImport, setPendingImport] = useState<AppState | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const stats = useMemo(() => moduleStats(state.done), [state.done])

  const doneCount = Object.keys(state.done).length
  const videoCount = watchedCount(state.done)
  const secondsWatched = watchedSeconds(state.done)
  const duration = splitDurationLabel(secondsWatched)
  const streak = streakDays(state.done)

  function handleExport() {
    const payload = {
      v: 1,
      app: EXPORT_APP,
      exportedAt: new Date().toISOString(),
      done: state.done,
      settings: state.settings,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `yishu-review-progress-${formatStamp(Date.now())}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    // 部分浏览器需要下载真正开始后再回收 blob URL
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(`已导出 ${doneCount} 条进度记录`)
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // 允许连续两次选择同一个文件
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (!isRecord(parsed) || !isRecord(parsed.done)) {
        throw new Error('invalid progress file')
      }
      setPendingImport(normalizeState(parsed))
    } catch {
      showToast('导入失败：文件格式不正确')
    }
  }

  function confirmImport() {
    if (!pendingImport) return
    const count = Object.keys(pendingImport.done).length
    replaceState(pendingImport)
    setPendingImport(null)
    showToast(`导入成功，已恢复 ${count} 条记录`)
  }

  function confirmReset() {
    reset()
    setResetOpen(false)
    showToast('已重置所有进度')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">我的</h1>
          <p className="page-subtitle">数据只存在本机 · 无需登录</p>
        </div>
      </header>

      <section className="m-stats">
        <div className="card m-stat m-stat--video">
          <span className="m-stat__icon">
            <VideoIcon size={16} />
          </span>
          <p className="m-stat__num">
            {formatCount(videoCount)}
            <i>个</i>
          </p>
          <p className="m-stat__label">已看视频</p>
        </div>
        <div className="card m-stat m-stat--time">
          <span className="m-stat__icon">
            <ClockIcon size={16} />
          </span>
          <p className="m-stat__num">
            {duration.value}
            <i>{duration.unit}</i>
          </p>
          <p className="m-stat__label">累计时长</p>
        </div>
        <div className="card m-stat m-stat--streak">
          <span className="m-stat__icon">
            <FlameIcon size={16} />
          </span>
          <p className="m-stat__num">
            {formatCount(streak)}
            <i>天</i>
          </p>
          <p className="m-stat__label">连续打卡</p>
        </div>
      </section>

      <div className="section-title">
        <span>模块完成率</span>
        <span className="section-title__extra">共 {TOTAL_MODULES} 个模块</span>
      </div>
      <section className="card m-bars">
        {stats.map((stat) => (
          <div className="m-bar" key={stat.module.id}>
            <div className="m-bar__top">
              <span className="m-bar__name">{stat.module.name}</span>
              <span className={`m-bar__pct ${stat.ratio >= 1 ? 'is-full' : ''}`.trim()}>
                {percent(stat.ratio)}%
              </span>
            </div>
            <div className="progress-bar m-bar__track">
              <div className="progress-bar__fill" style={{ width: `${percent(stat.ratio)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <div className="section-title">
        <span>数据管理</span>
        <span className="section-title__extra">共 {doneCount} 条记录</span>
      </div>
      <section className="card m-list">
        {/* 隐藏的文件选择框：放在列表最前面，避免打乱相邻行分隔线 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={handleImportFile}
          aria-label="选择要导入的进度 JSON 文件"
        />
        <button type="button" className="m-row m-row--action" onClick={handleExport}>
          <span className="m-row__label">
            <DownloadIcon size={18} />
            导出 JSON 备份
          </span>
          <ChevronRightIcon size={16} className="m-row__chev" />
        </button>
        <button
          type="button"
          className="m-row m-row--action"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="m-row__label">
            <UploadIcon size={18} />
            导入 JSON 备份
          </span>
          <span className="m-row__hint">会覆盖当前进度</span>
          <ChevronRightIcon size={16} className="m-row__chev" />
        </button>
        <button
          type="button"
          className="m-row m-row--action m-row--danger"
          onClick={() => setResetOpen(true)}
        >
          <span className="m-row__label">
            <TrashIcon size={18} />
            重置所有进度
          </span>
          <ChevronRightIcon size={16} className="m-row__chev" />
        </button>
      </section>

      <div className="section-title">
        <span>设置</span>
      </div>
      <section className="card m-list">
        <div className="m-row">
          <span className="m-row__label m-row__label--stack">
            跳转前先确认
            <small className="m-row__sub">点知识点先弹确认再唤起 B站</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.confirmBeforeJump}
            aria-label="跳转前先确认"
            className={`m-switch ${settings.confirmBeforeJump ? 'is-on' : ''}`.trim()}
            onClick={() => updateSettings({ confirmBeforeJump: !settings.confirmBeforeJump })}
          >
            <span className="m-switch__dot" />
          </button>
        </div>
        <div className="m-row">
          <span className="m-row__label m-row__label--stack">
            从 B站回来提醒打勾
            <small className="m-row__sub">切回 App 时弹出「看完了？」浮条</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.returnPrompt}
            aria-label="从 B站回来提醒打勾"
            className={`m-switch ${settings.returnPrompt ? 'is-on' : ''}`.trim()}
            onClick={() => updateSettings({ returnPrompt: !settings.returnPrompt })}
          >
            <span className="m-switch__dot" />
          </button>
        </div>
        <div className="m-row m-row--theme">
          <span className="m-row__label">主题</span>
          <Segmented
            items={THEME_ITEMS}
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            size="sm"
            className="m-theme"
            ariaLabel="主题模式"
          />
        </div>
      </section>

      <div className="section-title">
        <span>关于</span>
      </div>
      <section className="card m-about">
        <div className="m-about__row">
          <span>数据来源</span>
          <b>
            {UP.name} · B站 mid {UP.mid}
          </b>
        </div>
        <div className="m-about__row">
          <span>课程数据</span>
          <b>
            data/courses.json · {TOTAL_KP} 个知识点
          </b>
        </div>
        <div className="m-about__row">
          <span>版本</span>
          <b>1.0.0</b>
        </div>
        <p className="m-about__note">
          跳转使用 B站 深链，未安装 App 会自动打开网页版。所有进度只保存在本机，换设备请用「导出 /
          导入」迁移。
        </p>
      </section>

      <Sheet
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="确认导入进度"
      >
        <p className="m-sheet__text">
          导入将 <b>覆盖当前全部进度</b>
          {pendingImport
            ? `（当前 ${doneCount} 条 → 文件内 ${Object.keys(pendingImport.done).length} 条）`
            : ''}
          ，覆盖后无法撤销，建议先导出一份备份。
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setPendingImport(null)}>
            取消
          </button>
          <button type="button" className="btn btn--primary" onClick={confirmImport}>
            确认导入
          </button>
        </div>
      </Sheet>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="重置所有进度">
        <p className="m-sheet__text">
          将 <b>清空全部打勾记录</b>（当前 {doneCount} 条）并恢复默认设置，重置后无法撤销。
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setResetOpen(false)}>
            取消
          </button>
          <button type="button" className="btn btn--danger" onClick={confirmReset}>
            确认重置
          </button>
        </div>
      </Sheet>
    </div>
  )
}
