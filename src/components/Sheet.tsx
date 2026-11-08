import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
}

/** 底部弹层（确认弹窗 / 长按菜单 / 重置确认共用） */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-handle" />
        {title ? <h3 className="sheet-title">{title}</h3> : null}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export interface ActionSheetItem {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick: () => void
}

interface ActionSheetProps {
  open: boolean
  title?: string
  items: ActionSheetItem[]
  onClose: () => void
}

/** 长按卡片弹出的操作菜单 */
export function ActionSheet({ open, title, items, onClose }: ActionSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="action-list">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`action-list__item ${item.danger ? 'action-list__item--danger' : ''}`}
            onClick={() => {
              onClose()
              item.onClick()
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="sheet-cancel" onClick={onClose}>
        取消
      </button>
    </Sheet>
  )
}
