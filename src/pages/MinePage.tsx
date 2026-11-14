import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import './MinePage.css'
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  FlameIcon,
  PlayIcon,
  SettingsIcon,
  TrashIcon,
  UploadIcon,
  VideoIcon,
} from '../components/Icons'
import { Segmented, type SegmentedItem } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { APP_VERSION } from '../config'
import {
  DATA_GENERATED_AT,
  DATA_SOURCE,
  DATA_VERSION,
  SYSTEM_BVID,
  TOTAL_KP,
  TOTAL_MODULES,
  TOTAL_TOPICS,
  TOTAL_TOPIC_VIDEOS,
  UP,
} from '../data'
import { diagnoseBilibiliJump, type DeepLinkDiagnostics } from '../lib/bilibili'
import { formatCount, formatHoursLabel, formatStamp, percent } from '../lib/format'
import {
  buildHeatmap,
  buildStudyRecords,
  formatRecordTime,
  groupRecordsByDay,
  studySummary,
} from '../lib/history'
import { moduleStats, streakDays, watchedCount, watchedSeconds } from '../lib/progress'
import {
  applyDataUpdate,
  checkContentUpdate,
  clearDataOverride,
  hasDataOverride,
  resolveUpdateUrl,
  type UpdateCheckResult,
} from '../lib/updates'
import { normalizeState, useApp } from '../store/AppStore'
import type { AppState, PlayTarget, ThemeMode } from '../types'

const THEME_ITEMS: SegmentedItem<ThemeMode>[] = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'auto', label: '跟随系统' },
]

const EXPORT_APP = 'yishu-review'
/** 学习时间表默认展示的记录条数（跨天截断） */
const STUDY_PAGE_SIZE = 30
/** 热力图周数：12 周 × 7 天 */
const HEATMAP_WEEKS = 12

/** 「测试 B站 跳转」用的诊断目标（系统课第 5 个分P） */
const TEST_JUMP_TARGET: PlayTarget = {
  kind: 'system',
  key: 's:5',
  name: '集合的概念',
  bvid: SYSTEM_BVID,
  p: 5,
}

/** 累计时长 → 大数字 + 单位（沿用 formatHoursLabel 的文案，拆开排版） */
function splitDurationLabel(seconds: number): { value: string; unit: string } {
  if (seconds <= 0) return { value: '0', unit: '分钟' }
  const [value, unit = ''] = formatHoursLabel(seconds).replace(/^约\s*/, '').split(' ')
  return { value, unit }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 当天完成数 → 热力图 4 档（0 / 1 / 2 / 3+） */
function heatTier(count: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(count) || count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  return 3
}

/** 当天完成时长（秒）→ 「75 分钟」 */
function formatDayMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes <= 0) return '不足 1 分钟'
  return `${minutes} 分钟`
}

/** 应用数据 / 恢复内置数据后需要刷新页面才能生效 */
function reloadSoon(): void {
  window.setTimeout(() => window.location.reload(), 500)
}

function biliInstalledLabel(value: boolean | null): string {
  if (value === null) return '未知（浏览器环境不检测）'
  return value ? '已检测到 tv.danmaku.bili' : '未检测到，请确认已安装「哔哩哔哩」'
}

/**
 * 页面 3 · 我的
 * 学习统计 + 打卡热力图 + 学习时间表 + 数据管理（内容更新 / 导出 / 导入 / 重置）
 * + 设置（跳转确认 / 返回提醒 / 排序 / 自动检查更新 / 主题 / 跳转诊断）+ 关于。
 * 所有进度数据都来自本机 localStorage（store 收口），除「检查内容更新」外不请求网络。
 */
export function MinePage() {
  const { state, settings, updateSettings, replaceState, reset } = useApp()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 待确认覆盖的导入数据（解析成功后才弹 Sheet） */
  const [pendingImport, setPendingImport] = useState<AppState | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  // 学习时间表：默认最近 30 条，可展开全部
  const [expanded, setExpanded] = useState(false)

  // 数据管理 · 检查内容更新
  const [checking, setChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  // 数据管理 · 内容更新源
  const [sourceOpen, setSourceOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  // 数据管理 · 恢复内置数据（仅当本地存在在线更新的数据时出现）
  const [overridePresent, setOverridePresent] = useState(() => hasDataOverride())
  const [restoreOpen, setRestoreOpen] = useState(false)

  // 设置 · 测试 B站 跳转
  const [diagOpen, setDiagOpen] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diag, setDiag] = useState<DeepLinkDiagnostics | null>(null)

  const stats = useMemo(() => moduleStats(state.done), [state.done])
  const records = useMemo(() => buildStudyRecords(state.done), [state.done])
  const heatCells = useMemo(() => buildHeatmap(state.done, HEATMAP_WEEKS), [state.done])
  const summary = useMemo(() => studySummary(state.done), [state.done])

  const visibleRecords = expanded ? records : records.slice(0, STUDY_PAGE_SIZE)
  const studyDays = groupRecordsByDay(visibleRecords)

  const doneCount = Object.keys(state.done).length
  const videoCount = watchedCount(state.done)
  const secondsWatched = watchedSeconds(state.done)
  const duration = splitDurationLabel(secondsWatched)
  const streak = streakDays(state.done)
  const todayKey = heatCells.find((cell) => cell.isToday)?.date ?? ''
  const remoteUpdate = updateInfo?.remote ?? null
  const sourcePreview = resolveUpdateUrl({ ...settings, updateUrl: urlDraft })
  const sourceLabel = settings.updateUrl.trim() || '同源 data/courses.json'

  function handleExport() {
    const payload = {
      v: 1,
      app: EXPORT_APP,
      dataVersion: DATA_VERSION,
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

  async function handleCheckUpdate() {
    if (checking) return
    setChecking(true)
    try {
      const result = await checkContentUpdate(settings)
      if (result.status === 'updated' && result.remote) {
        setUpdateInfo(result)
        setUpdateOpen(true)
      } else {
        showToast(result.message)
      }
    } catch {
      showToast('检查失败，请稍后再试')
    } finally {
      setChecking(false)
    }
  }

  function confirmUpdate() {
    if (!remoteUpdate) return
    applyDataUpdate(remoteUpdate)
    setUpdateOpen(false)
    setUpdateInfo(null)
    showToast('内容已更新，正在刷新…')
    reloadSoon()
  }

  function openSourceSheet() {
    setUrlDraft(settings.updateUrl)
    setSourceOpen(true)
  }

  function saveSource() {
    const next = urlDraft.trim()
    updateSettings({ updateUrl: next })
    setSourceOpen(false)
    showToast(next ? '已保存内容更新源' : '已改为同源 data/courses.json')
  }

  function confirmRestore() {
    clearDataOverride()
    setOverridePresent(false)
    setRestoreOpen(false)
    showToast('已恢复内置数据，正在刷新…')
    reloadSoon()
  }

  async function handleDiagnose() {
    setDiag(null)
    setDiagLoading(true)
    setDiagOpen(true)
    try {
      const result = await diagnoseBilibiliJump(TEST_JUMP_TARGET)
      setDiag(result)
    } catch {
      showToast('诊断失败，请稍后再试')
    } finally {
      setDiagLoading(false)
    }
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
        <span>打卡热力图</span>
      </div>
      <section className="card m-heat">
        <p className="m-heat__head">
          最近 {HEATMAP_WEEKS} 周 · 本周 {summary.week} 个 · 今天 {summary.today} 个
        </p>
        <div
          className="m-heat__grid"
          role="img"
          aria-label={`最近 ${HEATMAP_WEEKS} 周打卡热力图，本周 ${summary.week} 个，今天 ${summary.today} 个`}
        >
          {heatCells.map((cell) => (
            <span
              key={cell.date}
              className={`m-heat__cell is-${heatTier(cell.count)} ${
                cell.isToday ? 'is-today' : ''
              } ${todayKey && cell.date > todayKey ? 'is-future' : ''}`.trim()}
              title={`${cell.date} · ${cell.count} 个`}
            />
          ))}
        </div>
        <div className="m-heat__legend" aria-hidden="true">
          <span>少</span>
          <span className="m-heat__swatch m-heat__cell is-0" />
          <span className="m-heat__swatch m-heat__cell is-1" />
          <span className="m-heat__swatch m-heat__cell is-2" />
          <span className="m-heat__swatch m-heat__cell is-3" />
          <span>多</span>
        </div>
      </section>

      <div className="section-title">
        <span>学习时间表</span>
        <span className="section-title__extra">
          {records.length > 0 ? `共 ${records.length} 条` : '按完成时间倒序'}
        </span>
      </div>
      <section className="card m-study">
        {records.length === 0 ? (
          <div className="empty">
            <p className="empty__title">还没有学习记录</p>
            <p>去课程页给看完的视频打勾试试。</p>
          </div>
        ) : (
          studyDays.map((day) => (
            <div className="m-day" key={day.date}>
              <div className="m-day__head">
                <span className="m-day__date">{day.label}</span>
                <span className="m-day__meta">
                  {day.count} 个 · {formatDayMinutes(day.seconds)}
                </span>
              </div>
              <ul className="m-day__list">
                {day.records.map((record) => (
                  <li className="m-rec" key={record.key}>
                    <span className="m-rec__time">{formatRecordTime(record.at)}</span>
                    <span className="m-rec__main">
                      <span className="m-rec__name">
                        <i
                          className={`m-rec__tag ${
                            record.kind === 'system' ? 'is-system' : 'is-topic'
                          }`}
                        >
                          {record.kind === 'system' ? '系统课' : '专题'}
                        </i>
                        <b>{record.name}</b>
                      </span>
                      <span className="m-rec__group">{record.groupName}</span>
                    </span>
                    <span className="m-rec__dur">{record.durationText}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {records.length > STUDY_PAGE_SIZE ? (
          <button
            type="button"
            className="m-study__more"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? '收起' : `展开全部 (${records.length})`}
          </button>
        ) : null}
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
        <button
          type="button"
          className="m-row m-row--action"
          onClick={handleCheckUpdate}
          disabled={checking}
          aria-busy={checking}
        >
          <span className="m-row__label m-row__label--stack">
            <span className="m-row__title">
              <DownloadIcon size={18} />
              {checking ? '正在检查内容更新…' : '检查内容更新'}
            </span>
            <small className="m-row__sub">
              当前 v{DATA_VERSION} · 更新于 {DATA_GENERATED_AT.slice(0, 10)} · 数据来源
              {DATA_SOURCE === 'remote' ? '已更新' : '内置'}
            </small>
          </span>
          <ChevronRightIcon size={16} className="m-row__chev" />
        </button>
        <button type="button" className="m-row m-row--action" onClick={openSourceSheet}>
          <span className="m-row__label m-row__label--stack">
            <span className="m-row__title">
              <SettingsIcon size={18} />
              内容更新源
            </span>
            <small className="m-row__sub m-row__sub--url">{sourceLabel}</small>
          </span>
          <ChevronRightIcon size={16} className="m-row__chev" />
        </button>
        {overridePresent ? (
          <button
            type="button"
            className="m-row m-row--action"
            onClick={() => setRestoreOpen(true)}
          >
            <span className="m-row__label">
              <ArrowLeftIcon size={18} />
              恢复内置数据
            </span>
            <span className="m-row__hint">当前为在线更新数据</span>
            <ChevronRightIcon size={16} className="m-row__chev" />
          </button>
        ) : null}
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
        <div className="m-row">
          <span className="m-row__label m-row__label--stack">
            已学内容自动排到最后
            <small className="m-row__sub">课程页把已打勾的模块 / 视频排到末尾</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.sortCompletedLast}
            aria-label="已学内容自动排到最后"
            className={`m-switch ${settings.sortCompletedLast ? 'is-on' : ''}`.trim()}
            onClick={() => updateSettings({ sortCompletedLast: !settings.sortCompletedLast })}
          >
            <span className="m-switch__dot" />
          </button>
        </div>
        <div className="m-row">
          <span className="m-row__label m-row__label--stack">
            启动时自动检查内容更新
            <small className="m-row__sub">每天最多检查一次，需要网络</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoCheckUpdate}
            aria-label="启动时自动检查内容更新"
            className={`m-switch ${settings.autoCheckUpdate ? 'is-on' : ''}`.trim()}
            onClick={() => updateSettings({ autoCheckUpdate: !settings.autoCheckUpdate })}
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
        <button type="button" className="m-row m-row--action" onClick={handleDiagnose}>
          <span className="m-row__label">
            <PlayIcon size={18} />
            测试 B站 跳转
          </span>
          <span className="m-row__hint">诊断深链</span>
          <ChevronRightIcon size={16} className="m-row__chev" />
        </button>
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
            {TOTAL_TOPICS} 个专题合集 / {TOTAL_TOPIC_VIDEOS} 条视频 + {TOTAL_MODULES} 模块 /{' '}
            {TOTAL_KP} 知识点
          </b>
        </div>
        <div className="m-about__row">
          <span>版本</span>
          <b>v{APP_VERSION}</b>
        </div>
        <div className="m-about__row">
          <span>数据生成</span>
          <b>{DATA_GENERATED_AT.slice(0, 10)}</b>
        </div>
        <p className="m-about__note">
          跳转使用 B站 深链，未安装 App 会自动打开网页版。所有进度只保存在本机，换设备请用「导出 /
          导入」迁移。
        </p>
      </section>

      <Sheet open={pendingImport !== null} onClose={() => setPendingImport(null)} title="确认导入进度">
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

      <Sheet open={updateOpen} onClose={() => setUpdateOpen(false)} title="发现新内容">
        {remoteUpdate ? (
          <>
            <p className="m-sheet__desc">
              远程课程数据更新于 {remoteUpdate.generatedAt.slice(0, 10)}
              ，更新后会覆盖当前课程数据并刷新页面，学习进度不受影响。
            </p>
            <div className="m-kv">
              <div className="m-kv__row">
                <span>当前数据</span>
                <b>
                  v{DATA_VERSION} · {DATA_GENERATED_AT.slice(0, 10)}
                </b>
              </div>
              <div className="m-kv__row">
                <span>远程数据</span>
                <b>
                  v{remoteUpdate.version} · {remoteUpdate.generatedAt.slice(0, 10)}
                </b>
              </div>
            </div>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setUpdateOpen(false)}
              >
                以后再说
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmUpdate}>
                确认更新
              </button>
            </div>
          </>
        ) : null}
      </Sheet>

      <Sheet open={sourceOpen} onClose={() => setSourceOpen(false)} title="内容更新源">
        <p className="m-sheet__desc">
          留空时读取同源的 data/courses.json（浏览器 PWA）；APK 内无法读取同源文件，请填写 GitHub
          raw 地址。
        </p>
        <input
          type="url"
          inputMode="url"
          className="m-input"
          value={urlDraft}
          placeholder="https://raw.githubusercontent.com/用户名/仓库/main/data/courses.json"
          onChange={(event) => setUrlDraft(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-label="内容更新源地址"
        />
        <p className="m-field-hint">
          当前生效：{sourcePreview || '未设置（APK 内需手动填写 GitHub raw 地址）'}
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setSourceOpen(false)}>
            取消
          </button>
          <button type="button" className="btn btn--primary" onClick={saveSource}>
            保存
          </button>
        </div>
      </Sheet>

      <Sheet open={restoreOpen} onClose={() => setRestoreOpen(false)} title="恢复内置数据">
        <p className="m-sheet__text">
          将 <b>清除在线更新的课程数据</b>
          ，恢复应用内置版本并刷新页面，学习进度不会受影响。
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setRestoreOpen(false)}>
            取消
          </button>
          <button type="button" className="btn btn--danger" onClick={confirmRestore}>
            确认恢复
          </button>
        </div>
      </Sheet>

      <Sheet open={diagOpen} onClose={() => setDiagOpen(false)} title="B站 跳转诊断">
        {diagLoading && !diag ? (
          <p className="m-sheet__text">正在检测运行环境…</p>
        ) : diag ? (
          <>
            <div className="m-kv">
              <div className="m-kv__row">
                <span>运行环境</span>
                <b>{diag.environment}</b>
              </div>
              <div className="m-kv__row">
                <span>B站 App</span>
                <b>{biliInstalledLabel(diag.biliInstalled)}</b>
              </div>
            </div>
            <div className="m-diag">
              <div className="m-diag__row">
                <span className="m-diag__label">深链（唤起 B站 App）</span>
                <code className="m-diag__url">{diag.deepUrl}</code>
              </div>
              <div className="m-diag__row">
                <span className="m-diag__label">网页兜底</span>
                <code className="m-diag__url">{diag.webUrl}</code>
              </div>
            </div>
            <p className="m-sheet__desc">{diag.detail}</p>
            <div className="sheet-actions">
              <button type="button" className="btn btn--primary" onClick={() => setDiagOpen(false)}>
                知道了
              </button>
            </div>
          </>
        ) : null}
      </Sheet>
    </div>
  )
}
