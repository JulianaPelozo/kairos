import { useState } from 'react'
import { StoreProvider, useStore } from './state/store'
import { SessionProvider } from './state/session'
import { useNotificationActions, useNow, useReminderSync } from './state/hooks'
import { Onboarding } from './screens/Onboarding'
import { Triage } from './screens/Triage'
import { Now } from './screens/Now'
import { Tasks } from './screens/Tasks'
import { Care } from './screens/Care'
import { Settings } from './screens/Settings'

type Tab = 'agora' | 'tarefas' | 'cuidados' | 'ajustes'
type Overlay = null | 'triagem'

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: 'agora', label: 'Agora', ico: '🧭' },
  { id: 'tarefas', label: 'Tarefas', ico: '📌' },
  { id: 'cuidados', label: 'Autocuidado', ico: '💜' },
  { id: 'ajustes', label: 'Ajustes', ico: '⚙️' },
]

function Shell() {
  const { state } = useStore()
  const now = useNow()
  const [tab, setTab] = useState<Tab>('agora')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [addingTask, setAddingTask] = useState(false)

  useReminderSync()
  useNotificationActions()

  if (!state.profile.onboarded) {
    return <main className="app"><Onboarding onDone={() => setOverlay('triagem')} /></main>
  }

  if (overlay === 'triagem') {
    return (
      <main className="app">
        <Triage
          onDone={() => { setOverlay(null); setTab('agora') }}
          onAddTask={() => { setOverlay(null); setAddingTask(true); setTab('tarefas') }}
        />
      </main>
    )
  }

  return (
    <main className="app">
      {tab === 'agora' && <Now now={now} onTriage={() => setOverlay('triagem')} />}
      {tab === 'tarefas' && <Tasks key={String(addingTask)} startOpen={addingTask} />}
      {tab === 'cuidados' && <Care now={now} />}
      {tab === 'ajustes' && <Settings />}

      <nav className="tabbar" aria-label="Navegação principal">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => { setTab(t.id); setAddingTask(false) }}>
              <span className="ico" aria-hidden>{t.ico}</span>{t.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </StoreProvider>
  )
}
