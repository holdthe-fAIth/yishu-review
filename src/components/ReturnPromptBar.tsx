import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { useApp } from '../store/AppStore'
import { useToast } from './Toast'

/** 离开超过 30 秒才认为是「看完回来」 */
export const RETURN_THRESHOLD_MS = 30_000

/**
 * A 版灵魂之二：从 B站 切回来后的底部浮条
 * 「看完了《集合的概念》？ [✓ 打勾] [× 忽略]」
 */
export function ReturnPromptBar() {
  const { state, markDone, clearPending } = useApp()
  const { showToast } = useToast()
  const [visible, setVisible] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  // 切回页面（visibilitychange / focus）且 pending 已超过 30 秒 → 弹浮条
  useEffect(() => {
    function check() {
      if (document.visibilityState !== 'visible') return
      const current = stateRef.current
      const pending = current.pending
      if (!pending) {
        setVisible(false)
        return
      }
      if (Date.now() - pending.at < RETURN_THRESHOLD_MS) return
      if (!current.settings.returnPrompt) {
        clearPending()
        return
      }
      setVisible(true)
    }

    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)

    // APK（Capacitor）里额外监听原生前台切换，保证从 B站 切回来一定触发
    let nativeListener: { remove: () => Promise<void> } | undefined
    if (Capacitor.isNativePlatform()) {
      void NativeApp.addListener('appStateChange', (appState) => {
        if (appState.isActive) check()
      }).then((listener) => {
        nativeListener = listener
      })
    }

    check()
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      void nativeListener?.remove()
    }
  }, [clearPending])

  // 在页面可见时，pending 满 30 秒也主动弹（桌面新标签页场景）
  useEffect(() => {
    const pending = state.pending
    if (!pending || !state.settings.returnPrompt) {
      if (!pending) setVisible(false)
      return
    }
    const remain = RETURN_THRESHOLD_MS - (Date.now() - pending.at)
    if (remain <= 0) {
      if (document.visibilityState === 'visible') setVisible(true)
      return
    }
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setVisible(true)
    }, remain)
    return () => window.clearTimeout(timer)
  }, [state.pending, state.settings.returnPrompt])

  // pending 被清掉 → 关闭浮条
  useEffect(() => {
    if (!state.pending) setVisible(false)
  }, [state.pending])

  const pending = state.pending
  if (!visible || !pending) return null

  return createPortal(
    <div className="return-bar" role="dialog" aria-label="完成确认">
      <div className="return-bar__text">
        看完了《<em>{pending.name}</em>》？
      </div>
      <div className="return-bar__actions">
        <button
          type="button"
          className="return-bar__ignore"
          onClick={() => {
            clearPending()
            setVisible(false)
          }}
        >
          忽略
        </button>
        <button
          type="button"
          className="return-bar__done"
          onClick={() => {
            markDone(pending.key)
            clearPending()
            setVisible(false)
            showToast('已打勾 ✓')
          }}
        >
          ✓ 打勾
        </button>
      </div>
    </div>,
    document.body,
  )
}
