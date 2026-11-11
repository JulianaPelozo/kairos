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

export type ReminderAction = 'done' | 'snooze'

/**
 * Aplica "Feito" / "Mais tarde" vindo de qualquer lugar: notificação nativa,
 * notificação do navegador ou o pop-up dentro do app.
 * Chaves: "care:agua", "care:medicacao:08:00", "task:<id>:start", "task:<id>:due", "special:...".
 */
export function useApplyReminderAction() {
  const { dispatch } = useStore()
  const done = useCareDone()
  return useCallback(
    (key: string, action: ReminderAction, at = Date.now(), source: 'app' | 'notificacao' = 'notificacao') => {
      const [kind, id, extra] = key.split(':')
      if (action === 'snooze') {
        dispatch({ type: 'snooze', key: `${kind}:${id}`, minutes: 30 })
        return
      }
      if (kind === 'care') done(id, at, source)
      else if (kind === 'task' && extra === 'start') dispatch({ type: 'focus:start', taskId: id })
      else if (kind === 'task' && extra === 'due') dispatch({ type: 'task:update', id, patch: { done: true } })
    },
    [dispatch, done],
  )
}

/** Aplica o que a pessoa tocou nas notificações, inclusive com o app fechado. */
export function useNotificationActions() {
  const apply = useApplyReminderAction()

  useEffect(() => {
    // Android: ações guardadas pelo Kotlin enquanto o app estava fechado.
    const consume = async () => {
      const actions = await notifier.consumeActions().catch(() => [])
      for (const a of actions) apply(a.key, a.action, a.at)
    }
    consume()

    // Navegador: o service worker abriu o app com ?acao=done&chave=... na URL.
    const params = new URLSearchParams(location.search)
    const acao = params.get('acao')
    const chave = params.get('chave')
    if ((acao === 'done' || acao === 'snooze') && chave) {
      apply(chave, acao)
      history.replaceState(null, '', location.pathname)
    }

    // Navegador: botão tocado com o app já aberto.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'kairos-action') apply(e.data.key, e.data.action)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)

    const sub = isNative ? CapApp.addListener('appStateChange', ({ isActive }) => isActive && consume()) : null
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage)
      sub?.then((s) => s.remove())
    }
  }, [apply])
}
