import { useState } from 'react'
import { useStore } from '../state/store'
import { useSession } from '../state/session'
import { isNative, notifier } from '../lib/notifier'
import { sendCode, supabase, verifyCode } from '../lib/supabase'
import { formatDuration } from '../engine/time'

export function Settings() {
  const { state, dispatch } = useStore()
  const { profile, settings } = state

  const toggleNotifications = async (on: boolean) => {
    const granted = on ? await notifier.requestPermission().catch(() => false) : false
    dispatch({ type: 'settings', patch: { notifications: on && granted } })
  }

  return (
    <div className="screen">
      <h1>Ajustes</h1>

      <section className="card">
        <h2>Você</h2>
        <label className="field">
          <span>Nome</span>
          <input type="text" value={profile.name} onChange={(e) => dispatch({ type: 'profile', patch: { name: e.target.value } })} />
        </label>
        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            <span>Acordo às</span>
            <input type="time" value={profile.wake} onChange={(e) => dispatch({ type: 'profile', patch: { wake: e.target.value } })} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Durmo às</span>
            <input type="time" value={profile.sleep} onChange={(e) => dispatch({ type: 'profile', patch: { sleep: e.target.value } })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Aparência</h2>
        <div className="segmented" role="group" aria-label="Tema">
          {([['sistema', '🖥️ Sistema'], ['claro', '☀️ Claro'], ['escuro', '🌙 Escuro']] as const).map(([id, label]) => (
            <button key={id} aria-pressed={settings.theme === id}
              onClick={() => dispatch({ type: 'settings', patch: { theme: id } })}>{label}</button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
          “Sistema” acompanha o modo do seu celular ou computador.
        </p>
      </section>

      <section className="card">
        <h2>Lembretes</h2>
        <label className="switch">
          <span>Notificações</span>
          <input type="checkbox" checked={settings.notifications} onChange={(e) => toggleNotifications(e.target.checked)} />
        </label>
        {isNative && settings.notifications && (
          <>
            <p className="muted small">
              Os lembretes aparecem em pop-up no topo da tela. Se não estiverem aparecendo, ligue
              <strong> “Pop-up”</strong> ou <strong>“Notificações flutuantes”</strong> nas configurações do celular.
            </p>
            <button className="btn ghost block" style={{ marginBottom: 14 }} onClick={() => notifier.openSettings()}>
              Abrir configurações de notificação
            </button>
          </>
        )}
        <label className="field">
          <span>Pedir uma pausa depois de quanto tempo em foco?</span>
          <select value={settings.focusLimitMin} onChange={(e) => dispatch({ type: 'settings', patch: { focusLimitMin: Number(e.target.value) } })}>
            {[45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{formatDuration(m)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Começar a desacelerar quanto antes de dormir?</span>
          <select value={settings.windDownMin} onChange={(e) => dispatch({ type: 'settings', patch: { windDownMin: Number(e.target.value) } })}>
            {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
      </section>

      <Account />

      <section className="card">
        <h2>Dados neste aparelho</h2>
        <button className="btn danger block" onClick={() => {
          if (confirm('Apagar tudo deste aparelho e recomeçar?')) {
            localStorage.clear()
            notifier.cancelAll().finally(() => location.reload())
          }
        }}>Apagar e recomeçar</button>
      </section>
    </div>
  )
}

function Account() {
  const { session, status } = useSession()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (!supabase) {
    return (
      <section className="card">
        <h2>Conta</h2>
        <p className="muted small">Sincronização desativada (Supabase não configurado). Tudo fica salvo neste aparelho.</p>
      </section>
    )
  }

  if (session) {
    const label = { off: '', sincronizando: 'Sincronizando…', ok: 'Tudo salvo na nuvem ✓', erro: 'Não consegui sincronizar agora. Tento de novo depois.' }[status]
    return (
      <section className="card">
        <h2>Conta</h2>
        <p>{session.user.email}</p>
        <p className="muted small" aria-live="polite">{label}</p>
        <button className="btn ghost block" onClick={() => supabase!.auth.signOut()}>Sair</button>
      </section>
    )
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg('')
    try { await fn() } catch (e) { setMsg(e instanceof Error ? e.message : 'Algo deu errado.') } finally { setBusy(false) }
  }

  return (
    <section className="card">
      <h2>Conta (opcional)</h2>
      <p className="muted small">Entre para guardar seus dados na nuvem e usar em outro aparelho. Sem senha: mando um código por e-mail.</p>
      {stage === 'email' ? (
        <form onSubmit={(e) => { e.preventDefault(); run(async () => { await sendCode(email.trim()); setStage('code') }) }}>
          <label className="field">
            <span>E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary block" disabled={busy || !email.includes('@')}>Enviar código</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); run(() => verifyCode(email.trim(), code.trim())) }}>
          <label className="field">
            <span>Código que chegou no e-mail</span>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setStage('email')}>Voltar</button>
            <button className="btn primary" disabled={busy || code.trim().length < 6}>Entrar</button>
          </div>
        </form>
      )}
      {msg && <p className="small" role="alert" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
