import { useCallback, useState } from 'react'
import { AppProvider } from './store/AppStore'
import { ToastProvider } from './components/Toast'
import { JumpProvider } from './lib/jump'
import { TabBar } from './components/TabBar'
import { ReturnPromptBar } from './components/ReturnPromptBar'
import { CoursePage } from './pages/CoursePage'
import { KnowledgePage } from './pages/KnowledgePage'
import { MinePage } from './pages/MinePage'
import { SearchPage } from './pages/SearchPage'
import type { TabKey } from './types'

function AppShell() {
  const [tab, setTab] = useState<TabKey>('course')
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  return (
    <div className="app">
      <div className="app__frame">
        <main className="screen" key={tab}>
          {tab === 'course' ? <CoursePage onOpenSearch={openSearch} /> : null}
          {tab === 'knowledge' ? <KnowledgePage /> : null}
          {tab === 'mine' ? <MinePage /> : null}
        </main>
        <ReturnPromptBar />
        <TabBar tab={tab} onChange={setTab} />
        <SearchPage open={searchOpen} onClose={closeSearch} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <JumpProvider>
          <AppShell />
        </JumpProvider>
      </ToastProvider>
    </AppProvider>
  )
}
