import { useCallback, useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useStore } from './store'
import { useSession } from './session'
import { logCare } from '../lib/supabase'
import { isNative, notifier } from '../lib/notifier'
import { upcomingReminders } from '../engine/priority'

/** Relógio que atualiza sozinho, para as prioridades mudarem com o passar do tempo. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    const onVis = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [intervalMs])
  return now
}

export function useCareDone() {
  const { dispatch } = useStore()
  const { session } = useSession()
  return useCallback(
    (id: string, at = Date.now(), source: 'app' | 'notificacao' = 'app') => {
      dispatch({ type: 'care:done', id, at })
      if (session) logCare(session.user.id, id, at, source).catch(() => {})
    },
    [dispatch, session],
  )
}

/** Mantém o agendamento nativo de notificações em dia com o estado. */
export function useReminderSync() {
  const { state } = useStore()
  const { care, tasks, profile, settings, snoozed } = state

  useEffect(() => {
    if (!profile.onboarded) return
    const t = setTimeout(() => {
      if (settings.notifications) notifier.schedule(upcomingReminders(state), { wake: profile.wake, sleep: profile.sleep }).catch(console.error)
      else notifier.cancelAll().catch(console.error)
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [care, tasks, profile, settings, snoozed])
}

/** Aplica o que a pessoa tocou nas notificações ("Feito" / "Mais tarde") com o app fechado. */
export function useNotificationActions() {
  const { dispatch } = useStore()
  const done = useCareDone()

  useEffect(() => {
    const consume = async () => {
      const actions = await notifier.consumeActions().catch(() => [])
      for (const a of actions) {
        // chaves: "care:agua", "care:medicacao:08:00", "task:<id>:start"...
        const [kind, id] = a.key.split(':')
        if (a.action === 'done' && kind === 'care') done(id, a.at, 'notificacao')
        if (a.action === 'snooze') dispatch({ type: 'snooze', key: `${kind}:${id}`, minutes: 30 })
      }
    }
    consume()
    if (!isNative) return
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => isActive && consume())
    return () => { sub.then((s) => s.remove()) }
  }, [dispatch, done])
}
