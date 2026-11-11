import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, pullState, pushState } from '../lib/supabase'
import { migrate, useStore } from './store'

type SyncStatus = 'off' | 'sincronizando' | 'ok' | 'erro'

const Ctx = createContext<{ session: Session | null; status: SyncStatus }>({ session: null, status: 'off' })

/**
 * Sessão do Supabase + sincronização.
 * O app é local-first: funciona sem conta; com conta, o estado é espelhado na nuvem
 * e o mais recente (updatedAt) vence ao entrar em outro aparelho.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SyncStatus>('off')
  const ready = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Ao entrar: puxa da nuvem e decide quem é mais novo.
  const userId = session?.user.id
  useEffect(() => {
    ready.current = false
    if (!userId) { setStatus('off'); return }
    let cancelled = false
    setStatus('sincronizando')
    pullState(userId)
      .then(async (remote) => {
        if (cancelled) return
        const local = stateRef.current
        if (remote && remote.updatedAt > local.updatedAt) dispatch({ type: 'replace', state: migrate(remote) })
        else await pushState(userId, local)
        ready.current = true
        setStatus('ok')
      })
      .catch(() => !cancelled && setStatus('erro'))
    return () => { cancelled = true }
  }, [userId, dispatch])

  // A cada mudança, envia com um pequeno atraso para agrupar alterações.
  useEffect(() => {
    if (!userId || !ready.current) return
    const t = setTimeout(() => {
      pushState(userId, state).then(() => setStatus('ok')).catch(() => setStatus('erro'))
    }, 1500)
    return () => clearTimeout(t)
  }, [state, userId])

  return <Ctx.Provider value={{ session, status }}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
