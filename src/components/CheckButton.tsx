import { CheckIcon } from './Icons'

interface CheckButtonProps {
  done: boolean
  onToggle: () => void
  /** 视觉圆点尺寸 */
  size?: number
  /** on-cover：封面上的深色底；light：白底卡片上用 */
  variant?: 'on-cover' | 'light'
  label?: string
  className?: string
}

/**
 * 卡片右上角的「打勾」热区（A 版关键：和卡片主体跳转完全分开）
 * 自带 stopPropagation，点它绝不会触发跳转。
 */
export function CheckButton({
  done,
  onToggle,
  size = 18,
  variant = 'on-cover',
  label,
  className = '',
}: CheckButtonProps) {
  const hotSize = size + 16

  return (
    <button
      type="button"
      className={`check-btn check-btn--${variant} ${done ? 'is-done' : ''} ${className}`.trim()}
      style={{ width: hotSize, height: hotSize }}
      aria-label={label ?? (done ? '取消完成' : '标记完成')}
      aria-pressed={done}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        event.preventDefault()
        onToggle()
      }}
    >
      <span className="check-btn__circle" style={{ width: size, height: size }}>
        <CheckIcon size={Math.round(size * 0.66)} strokeWidth={3.2} />
      </span>
    </button>
  )
}
