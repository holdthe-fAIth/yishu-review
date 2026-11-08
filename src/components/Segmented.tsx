export interface SegmentedItem<T extends string = string> {
  key: T
  label: string
}

interface SegmentedProps<T extends string> {
  items: SegmentedItem<T>[]
  value: T
  onChange: (key: T) => void
  className?: string
  size?: 'md' | 'sm'
  ariaLabel?: string
}

/** 胶囊分段控件：课程页「系统课/专题课」、我的页「浅色/深色/跟随系统」共用 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className = '',
  size = 'md',
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      className={`segmented segmented--${size} ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          className={`segmented__item ${value === item.key ? 'is-active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
