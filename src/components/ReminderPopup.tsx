import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { useApplyReminderAction } from '../state/hooks'
import { upcomingReminders, type Reminder } from '../engine/priority'

const MIN = 60_000
const MAX_TIMEOUT = 2 ** 31 - 1

/**
 * Pop-up no meio da tela quando chega a hora de um lembrete e o app está aberto.
 * Fora do app, quem avisa é a notificação do sistema (Android ou navegador).
 */
export function ReminderPopup() {
  const { state } = useStore()
  const apply = useApplyReminderAction()
  const [current, setCurrent] = useState<Reminder | null>(null)
  // Evita mostrar o mesmo lembrete de novo logo em seguida: chave → até quando ficar quieto.
  const quietUntil = useRef(new Map<string, number>())
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!state.profile.onboarded || current) return
    const now = Date.now()
    const next = upcomingReminders(state, now).find((r) => (quietUntil.current.get(r.key) ?? 0) <= r.at)
    if (!next) return
    const t = setTimeout(() => {
      quietUntil.current.set(next.key, Date.now() + (next.repeatMin ?? 24 * 60) * MIN)
      setCurrent(next)
    }, Math.min(Math.max(next.at - now, 0), MAX_TIMEOUT))
    return () => clearTimeout(t)
  }, [state, current])

  useEffect(() => {
    if (!current) return
    primary.current?.focus()
    navigator.vibrate?.([200, 100, 200])
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCurrent(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  if (!current) return null

  const act = (action: 'done' | 'snooze') => {
    if (action === 'snooze') quietUntil.current.set(current.key, Date.now() + 30 * MIN)
    apply(current.key, action, Date.now(), 'app')
    setCurrent(null)
  }

  // O título vem como "💧 Beber água": separa o emoji para destacá-lo.
  const [emoji, ...rest] = current.title.split(' ')
  const hasEmoji = /\p{Extended_Pictographic}/u.test(emoji)

  return (
    <div className="popup-backdrop" onClick={() => setCurrent(null)}>
      <div
        className="card hero popup"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="popup-title"
        aria-describedby="popup-body"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label">Lembrete gentil</div>
        {hasEmoji && <div className="emoji" aria-hidden>{emoji}</div>}
        <h2 id="popup-title">{hasEmoji ? rest.join(' ') : current.title}</h2>
        <p id="popup-body" className="reason">{current.body}</p>
        <div className="row">
          <button ref={primary} className="btn primary" onClick={() => act('done')}>Feito ✓</button>
          <button className="btn ghost" onClick={() => act('snooze')}>Mais tarde</button>
        </div>
      </div>
    </div>
  )
}
