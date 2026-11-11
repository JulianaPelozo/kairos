import { useStore } from '../state/store'
import { useCareDone } from '../state/hooks'
import { prioritize } from '../engine/priority'
import { formatDuration } from '../engine/time'
import type { Suggestion } from '../types'
import { resolveTheme } from '../lib/theme'

function greeting(now: number) {
  const h = new Date(now).getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function Now({ now, onTriage }: { now: number; onTriage: () => void }) {
  const { state, dispatch } = useStore()
  const careDone = useCareDone()
  const list = prioritize(state, now)
  const [top, ...rest] = list
  const focusTask = state.focus && state.tasks.find((t) => t.id === state.focus!.taskId)
  const triageOld = !state.triage || now - state.triage.at > 4 * 3_600_000

  const complete = (s: Suggestion) => {
    if (s.kind === 'care') careDone(s.refId)
    else if (s.kind === 'task') dispatch({ type: 'task:update', id: s.refId, patch: { done: true } })
    else if (s.refId === 'pausa-foco') { careDone('pausa'); dispatch({ type: 'focus:stop' }) }
    else dispatch({ type: 'snooze', key: s.key, minutes: 12 * 60 })
  }
  const later = (s: Suggestion) => dispatch({ type: 'snooze', key: s.key, minutes: 30 })

  return (
    <div className="screen">
      <header className="topbar">
        <img src="./icons/icon-192.png" alt="" />
        <div>
          <div className="greet">{greeting(now)}{state.profile.name ? `, ${state.profile.name}` : ''}.</div>
          <div className="muted small">Um passo de cada vez.</div>
        </div>
        <ThemeToggle />
      </header>

      {focusTask && (
        <div className="card focus-banner">
          <div style={{ flex: 1 }}>
            <div className="chip">Em foco</div>
            <div className="title" style={{ fontWeight: 700, marginTop: 4 }}>{focusTask.title}</div>
            <div className="muted small">há {formatDuration((now - state.focus!.startedAt) / 60_000)}</div>
          </div>
          <button className="btn ghost" onClick={() => dispatch({ type: 'focus:stop' })}>Pausar</button>
        </div>
      )}

      {top ? (
        <section className="card hero" aria-live="polite">
          <div className="label">Seu próximo passo</div>
          <div className="emoji" aria-hidden>{top.emoji}</div>
          <h2>{top.title}</h2>
          <p className="reason">{top.reason}</p>
          <div className="step">💡 <strong>Para começar:</strong> {top.firstStep}</div>
          <div className="row">
            {top.kind === 'task' && !state.focus && (
              <button className="btn primary" onClick={() => dispatch({ type: 'focus:start', taskId: top.refId })}>Começar agora</button>
            )}
            <button className={`btn ${top.kind === 'task' && !state.focus ? 'ghost' : 'primary'}`} onClick={() => complete(top)}>
              {top.kind === 'task' ? 'Já terminei' : top.kind === 'special' && top.refId !== 'pausa-foco' ? 'Ok' : 'Feito ✓'}
            </button>
            <button className="btn ghost" onClick={() => later(top)}>Mais tarde</button>
          </div>
        </section>
      ) : (
        <section className="card hero">
          <div className="emoji" aria-hidden>🌿</div>
          <h2>Tudo em dia por agora</h2>
          <p className="reason">Nada urgente. Se quiser, aproveite para descansar — isso também é cuidar de si.</p>
        </section>
      )}

      {triageOld && (
        <button className="btn lilac block" onClick={onTriage} style={{ marginBottom: 14 }}>
          🧭 Como você está agora? Fazer triagem rápida
        </button>
      )}

      {rest.length > 0 && (
        <section className="card">
          <h2>Depois disso</h2>
          <ul className="list">
            {rest.slice(0, 4).map((s) => (
              <li key={s.key} className="item">
                <span className="emoji" aria-hidden>{s.emoji}</span>
                <div className="body">
                  <div className="title">{s.title}</div>
                  <div className="muted small">{s.reason}</div>
                </div>
                <button className="btn ghost" aria-label={`Marcar ${s.title} como feito`} onClick={() => complete(s)}>✓</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!triageOld && (
        <button className="btn ghost block" onClick={onTriage}>Refazer triagem</button>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { state, dispatch } = useStore()
  const current = resolveTheme(state.settings.theme)
  const next = current === 'escuro' ? 'claro' : 'escuro'
  return (
    <button className="icon-btn" aria-label={`Mudar para modo ${next}`} title={`Modo ${next}`}
      onClick={() => dispatch({ type: 'settings', patch: { theme: next } })}>
      {current === 'escuro' ? '☀️' : '🌙'}
    </button>
  )
}
