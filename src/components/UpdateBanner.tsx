import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../store/AppStore'
import {
  applyDataUpdate,
  checkContentUpdate,
  isAutoCheckDue,
  markUpdateChecked,
  type UpdateCheckResult,
} from '../lib/updates'
import { useToast } from './Toast'

/**
 * 启动时自动检查内容更新（每天最多一次）：
 * 发现新数据 → 顶部浮条提示，点「更新」写入本地并刷新。
 */
export function UpdateBanner() {
  const { settings } = useApp()
  const { showToast } = useToast()
  const [result, setResult] = useState<UpdateCheckResult | null>(null)

  useEffect(() => {
    if (!settings.autoCheckUpdate || !isAutoCheckDue()) return
    let cancelled = false
    void checkContentUpdate(settings).then((next) => {
      if (cancelled) return
      markUpdateChecked()
      if (next.status === 'updated' && next.remote) setResult(next)
    })
    return () => {
      cancelled = true
    }
  }, [settings])

  const remote = result?.remote
  if (!remote) return null

  return createPortal(
    <div className="update-bar" role="dialog" aria-label="内容更新">
      <div className="update-bar__text">
        发现新内容 <span>（{remote.generatedAt.slice(0, 10)} 更新）</span>
      </div>
      <div className="update-bar__actions">
        <button
          type="button"
          className="update-bar__later"
          onClick={() => setResult(null)}
        >
          稍后
        </button>
        <button
          type="button"
          className="update-bar__apply"
          onClick={() => {
            applyDataUpdate(remote)
            showToast('内容已更新，正在刷新…')
            window.setTimeout(() => window.location.reload(), 350)
          }}
        >
          立即更新
        </button>
      </div>
    </div>,
    document.body,
  )
}
