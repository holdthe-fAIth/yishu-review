import { useEffect, useRef, useState } from 'react'

interface CommonCoverProps {
  durationText: string
  className?: string
}

interface GeneratedCoverProps extends CommonCoverProps {
  /** 模块名首字 */
  char: string
  from: string
  to: string
  /** 左上角小标签（例如模块名） */
  label?: string
}

/** 系统课没有封面图：用模块主题色渐变 + 模块名首字自己生成 */
export function GeneratedCover({
  char,
  from,
  to,
  label,
  durationText,
  className = '',
}: GeneratedCoverProps) {
  return (
    <div
      className={`cover cover--generated ${className}`.trim()}
      style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      aria-hidden="true"
    >
      <span className="cover__char">{char}</span>
      {label ? <span className="cover__label">{label}</span> : null}
      <span className="cover__dur">{durationText}</span>
    </div>
  )
}

interface RemoteCoverProps extends CommonCoverProps {
  src: string
  alt: string
  fallbackChar: string
  from: string
  to: string
}

/** 专题课真实封面：加载失败（离线/防盗链/网络抖动）时自动重试，最终退化为渐变 + 首字 */
export function RemoteCover({
  src,
  alt,
  fallbackChar,
  from,
  to,
  durationText,
  className = '',
}: RemoteCoverProps) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const retryTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current)
    }
  }, [])

  function handleError() {
    if (attempt >= 2) {
      setFailed(true)
      return
    }
    retryTimer.current = window.setTimeout(() => setAttempt((value) => value + 1), 350)
  }

  // 重试时加一个 query 参数绕过浏览器/Service Worker 对失败请求的缓存
  const imageSrc =
    attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`

  return (
    <div
      className={`cover cover--remote ${className}`.trim()}
      style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {failed ? (
        <span className="cover__char" aria-hidden="true">
          {fallbackChar}
        </span>
      ) : (
        <img
          key={attempt}
          className="cover__img"
          src={imageSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
        />
      )}
      <span className="cover__dur">{durationText}</span>
    </div>
  )
}
