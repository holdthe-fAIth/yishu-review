import type { TabKey } from '../types'
import { BookIcon, LayersIcon, UserIcon } from './Icons'

interface TabBarProps {
  tab: TabKey
  onChange: (tab: TabKey) => void
}

const TABS: Array<{ key: TabKey; label: string; icon: (active: boolean) => JSX.Element }> = [
  { key: 'course', label: '课程', icon: () => <BookIcon size={22} /> },
  { key: 'knowledge', label: '知识体系', icon: () => <LayersIcon size={22} /> },
  { key: 'mine', label: '我的', icon: () => <UserIcon size={22} /> },
]

/** 底部 3 tab 导航：固定在最底部，padding-bottom 吃掉 iPhone 手势条安全区 */
export function TabBar({ tab, onChange }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="主导航">
      <div className="tabbar__inner">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tabbar__item ${tab === item.key ? 'is-active' : ''}`}
            aria-current={tab === item.key ? 'page' : undefined}
            onClick={() => onChange(item.key)}
          >
            {item.icon(tab === item.key)}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
