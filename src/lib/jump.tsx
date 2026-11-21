import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../store/AppStore'
import { useToast } from '../components/Toast'
import { Sheet } from '../components/Sheet'
import { buildPlayLinks, copyTextFor, openInBilibili } from './bilibili'
import { PlayIcon } from '../components/Icons'
import type { PlayTarget } from '../types'

interface JumpApi {
  /** 点视频统一走这里：记录 pending → （可选确认）→ 唤起 B站 */
  play(target: PlayTarget): void
}

const JumpContext = createContext<JumpApi | null>(null)

export function JumpProvider({ children }: { children: ReactNode }) {
  const { settings, setPending } = useApp()
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState<PlayTarget | null>(null)

  const doJump = useCallback(
    (target: PlayTarget) => {
      // A 版灵魂：跳转前把 { key, name, at } 存进 pending（只留一条）
      setPending({ key: target.key, name: target.name, at: Date.now() })
      void openInBilibili(target).then((mode) => {
        showToast(mode === 'web' ? '已记录，看完回来点「打勾」即可' : '正在打开 B站 App…')
      })
    },
    [setPending, showToast],
  )

  const play = useCallback(
    (target: PlayTarget) => {
      if (settings.confirmBeforeJump) {
        setConfirming(target)
        return
      }
      doJump(target)
    },
    [settings.confirmBeforeJump, doJump],
  )

  const confirmNow = useCallback(() => {
    if (confirming) {
      const target = confirming
      setConfirming(null)
      doJump(target)
    }
  }, [confirming, doJump])

  const value = useMemo<JumpApi>(() => ({ play }), [play])

  const links = confirming ? buildPlayLinks(confirming) : null

  return (
    <JumpContext.Provider value={value}>
      {children}
      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title="即将跳转到 B站">
        {confirming && links ? (
          <div className="jump-confirm">
            <div className="jump-confirm__name">{confirming.name}</div>
            <p className="jump-confirm__desc">
              {confirming.kind === 'system'
                ? links.page !== undefined
                  ? `将在 B站 App 播放系统课第 ${links.page} 分P（${copyTextFor(confirming)}）。`
                  : `将在 B站 App 播放该知识点视频（${copyTextFor(confirming)}）。`
                : `将在 B站 App 播放该专题视频（${copyTextFor(confirming)}）。`}
              看完切回来，会提示你一键打勾。
            </p>
            <button type="button" className="btn btn--primary jump-confirm__ok" onClick={confirmNow}>
              <PlayIcon size={16} /> 打开 B站
            </button>
          </div>
        ) : null}
      </Sheet>
    </JumpContext.Provider>
  )
}

export function useJump(): JumpApi {
  const context = useContext(JumpContext)
  if (!context) throw new Error('useJump 必须在 <JumpProvider> 内使用')
  return context
}
