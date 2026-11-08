import { useId, type ReactNode } from 'react'
import { clamp } from '../lib/format'

interface ProgressRingProps {
  /** 0..1 */
  value: number
  size?: number
  stroke?: number
  /** 不传则用粉→蓝渐变 */
  color?: string
  trackColor?: string
  className?: string
  children?: ReactNode
  label?: string
}

/** SVG 进度环：hero 大环 / 知识体系模块小环共用 */
export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  color,
  trackColor,
  className = '',
  children,
  label,
}: ProgressRingProps) {
  const rawId = useId()
  const gradientId = `ring-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const ratio = clamp(value, 0, 1)
  const radius = Math.max(0.5, (size - stroke) / 2)
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - ratio)

  return (
    <div
      className={`ring ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `完成 ${Math.round(ratio * 100)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--pink)" />
            <stop offset="100%" stopColor="#FFA6C1" />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor ?? 'var(--line)'}
          strokeWidth={stroke}
        />
        {ratio > 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color ?? `url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'stroke-dashoffset .3s ease' }}
          />
        ) : null}
      </svg>
      {children ? <div className="ring__center">{children}</div> : null}
    </div>
  )
}
