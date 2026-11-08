import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

interface ToastApi {
  showToast(message: string): void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const showToast = useCallback((text: string) => {
    setMessage(text)
    setTick((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), 2400)
    return () => window.clearTimeout(timer)
  }, [message, tick])

  const value = useMemo<ToastApi>(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message
        ? createPortal(
            <div className="toast" role="status" aria-live="polite" key={tick}>
              {message}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast 必须在 <ToastProvider> 内使用')
  return context
}
