import { useState } from 'react'
import { useStore } from '../state/store'
import { notifier } from '../lib/notifier'
import type { Context } from '../types'

const CONTEXTS: { id: Context; label: string; emoji: string }[] = [
  { id: 'trabalho', label: 'Trabalho', emoji: '💼' },
  { id: 'faculdade', label: 'Faculdade', emoji: '🎓' },
  { id: 'escola', label: 'Escola', emoji: '🎒' },
  { id: 'casa', label: 'Casa', emoji: '🏠' },
  { id: 'outro', label: 'Outra coisa', emoji: '✨' },
]

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useStore()
  const [step, setStep] = useState(0)
  const { profile, care } = state
  const total = 5
  const next = () => setStep((s) => s + 1)
  const back = () => setStep((s) => Math.max(0, s - 1))

  const finish = async (askNotifications: boolean) => {
    if (askNotifications) {
      const granted = await notifier.requestPermission().catch(() => false)
      dispatch({ type: 'settings', patch: { notifications: granted } })
    } else {
      dispatch({ type: 'settings', patch: { notifications: false } })
    }
    dispatch({ type: 'profile', patch: { onboarded: true } })
    onDone()
  }

  const toggleContext = (c: Context) => {
    const has = profile.contexts.includes(c)
    dispatch({ type: 'profile', patch: { contexts: has ? profile.contexts.filter((x) => x !== c) : [...profile.contexts, c] } })
  }

  return (
    <div className="screen">
      <div className="progress" aria-hidden><div style={{ width: `${((step + 1) / total) * 100}%` }} /></div>

      {step === 0 && (
        <>
          <img className="splash-logo" src="./icons/logo.webp" alt="Kairós" />
          <h1>Oi! Eu sou o Kairós.</h1>
          <p className="muted">
            Kairós é o momento certo. Eu te ajudo a perceber o que é mais importante <em>agora</em> —
            inclusive comer, beber água e descansar.
          </p>
          <label className="field">
            <span>Como posso te chamar?</span>
            <input type="text" autoComplete="given-name" value={profile.name}
              onChange={(e) => dispatch({ type: 'profile', patch: { name: e.target.value } })} />
          </label>
          <button className="btn primary block" onClick={next}>Vamos lá</button>
        </>
      )}

      {step === 1 && (
        <>
          <h1>Seu ritmo</h1>
          <p className="muted">Assim eu não te chamo enquanto você dorme.</p>
          <label className="field">
            <span>Costumo acordar às</span>
            <input type="time" value={profile.wake} onChange={(e) => dispatch({ type: 'profile', patch: { wake: e.target.value } })} />
          </label>
          <label className="field">
            <span>Costumo dormir às</span>
            <input type="time" value={profile.sleep} onChange={(e) => dispatch({ type: 'profile', patch: { sleep: e.target.value } })} />
          </label>
          <Nav back={back} next={next} />
        </>
      )}

      {step === 2 && (
        <>
          <h1>Onde vai sua energia?</h1>
          <p className="muted">Escolha quantos quiser. Dá para mudar depois.</p>
          <div className="options">
            {CONTEXTS.map((c) => (
              <button key={c.id} className="option" aria-pressed={profile.contexts.includes(c.id)} onClick={() => toggleContext(c.id)}>
                <span className="emoji">{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <Nav back={back} next={next} />
        </>
      )}

      {step === 3 && (
        <>
          <h1>Do que você quer lembrar?</h1>
          <p className="muted">Coisas simples que às vezes passam batido. Sem julgamento.</p>
          <div className="card">
            {care.map((c) => (
              <div key={c.id}>
                <label className="switch">
                  <span><span aria-hidden>{c.emoji}</span> {c.label}</span>
                  <input type="checkbox" checked={c.enabled}
                    onChange={(e) => dispatch({ type: 'care:update', id: c.id, patch: { enabled: e.target.checked } })} />
                </label>
                {c.id === 'medicacao' && c.enabled && (
                  <label className="field">
                    <span className="small">Horário da medicação</span>
                    <input type="time" value={c.fixedTimes?.[0] ?? '08:00'}
                      onChange={(e) => dispatch({ type: 'care:update', id: c.id, patch: { fixedTimes: [e.target.value] } })} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <Nav back={back} next={next} />
        </>
      )}

      {step === 4 && (
        <>
          <h1>Posso te chamar?</h1>
          <p className="muted">
            Vou mandar notificações gentis ao longo do dia. Você pode tocar em <strong>Feito</strong> ou
            <strong> Mais tarde</strong> direto nelas, sem abrir o app.
          </p>
          <div className="stack">
            <button className="btn primary block" onClick={() => finish(true)}>Pode sim</button>
            <button className="btn ghost block" onClick={() => finish(false)}>Agora não</button>
          </div>
        </>
      )}
    </div>
  )
}

function Nav({ back, next }: { back: () => void; next: () => void }) {
  return (
    <div className="row">
      <button className="btn ghost" onClick={back}>Voltar</button>
      <button className="btn primary" onClick={next}>Continuar</button>
    </div>
  )
}
