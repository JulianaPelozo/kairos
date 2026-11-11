import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { AppState, CareItem, Energy, Profile, Settings, Task } from '../types'
import { initialState, DEFAULT_CARE } from '../data/defaults'

const STORAGE_KEY = 'kairos:v1'

export type Action =
  | { type: 'replace'; state: AppState }
  | { type: 'profile'; patch: Partial<Profile> }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'care:update'; id: string; patch: Partial<CareItem> }
  | { type: 'care:done'; id: string; at?: number }
  | { type: 'care:set-last'; id: string; at: number | null }
  | { type: 'snooze'; key: string; minutes: number }
  | { type: 'task:add'; task: Omit<Task, 'id' | 'updatedAt' | 'done'> }
  | { type: 'task:update'; id: string; patch: Partial<Task> }
  | { type: 'task:delete'; id: string }
  | { type: 'triage'; energy: Energy }
  | { type: 'focus:start'; taskId: string }
  | { type: 'focus:stop' }

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

function reduce(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'replace': return a.state
    case 'profile': return { ...s, profile: { ...s.profile, ...a.patch } }
    case 'settings': return { ...s, settings: { ...s.settings, ...a.patch } }
    case 'care:update':
      return { ...s, care: s.care.map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) }
    case 'care:done': {
      const { [`care:${a.id}`]: _, ...snoozed } = s.snoozed
      return {
        ...s, snoozed,
        care: s.care.map((c) => (c.id === a.id ? { ...c, lastDone: a.at ?? Date.now() } : c)),
      }
    }
    case 'care:set-last':
      return { ...s, care: s.care.map((c) => (c.id === a.id ? { ...c, lastDone: a.at } : c)) }
    case 'snooze':
      return { ...s, snoozed: { ...s.snoozed, [a.key]: Date.now() + a.minutes * 60_000 } }
    case 'task:add':
      return { ...s, tasks: [...s.tasks, { ...a.task, id: uid(), done: false, updatedAt: Date.now() }] }
    case 'task:update':
      return {
        ...s,
        tasks: s.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch, updatedAt: Date.now() } : t)),
        focus: a.patch.done && s.focus?.taskId === a.id ? null : s.focus,
      }
    case 'task:delete':
      return {
        ...s, tasks: s.tasks.filter((t) => t.id !== a.id),
        focus: s.focus?.taskId === a.id ? null : s.focus,
      }
    case 'triage': return { ...s, triage: { at: Date.now(), energy: a.energy } }
    case 'focus:start': return { ...s, focus: { taskId: a.taskId, startedAt: Date.now() } }
    case 'focus:stop': return { ...s, focus: null }
  }
}

function reducer(s: AppState, a: Action): AppState {
  const next = reduce(s, a)
  return a.type === 'replace' ? next : { ...next, updatedAt: Date.now() }
}

/** Garante que estados antigos recebam cuidados novos adicionados em versões futuras. */
export function migrate(raw: Partial<AppState>): AppState {
  const base = initialState()
  const care = [...(raw.care ?? base.care)]
  for (const d of DEFAULT_CARE) if (!care.some((c) => c.id === d.id)) care.push({ ...d })
  return {
    ...base, ...raw,
    profile: { ...base.profile, ...raw.profile },
    settings: { ...base.settings, ...raw.settings },
    care,
    snoozed: raw.snoozed ?? {},
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch { /* estado corrompido: recomeça */ }
  return initialState()
}

const Ctx = createContext<{ state: AppState; dispatch: (a: Action) => void } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* sem espaço */ }
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore fora do StoreProvider')
  return v
}
