import { useState } from 'react'
import { useStore } from '../state/store'
import { formatClock } from '../engine/time'
import type { Context, Task } from '../types'

const CONTEXT_LABEL: Record<Context, string> = {
  trabalho: 'Trabalho', faculdade: 'Faculdade', escola: 'Escola', casa: 'Casa', outro: 'Outro',
}

const toInput = (ts: number | null) => {
  if (!ts) return ''
  const d = new Date(ts)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
const fromInput = (v: string) => (v ? new Date(v).getTime() : null)

function when(t: Task) {
  const parts: string[] = []
  const fmt = (ts: number) => {
    const d = new Date(ts)
    const today = new Date().toDateString() === d.toDateString()
    return today ? `hoje ${formatClock(ts)}` : d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  if (t.startAt) parts.push(`começa ${fmt(t.startAt)}`)
  if (t.dueAt) parts.push(`prazo ${fmt(t.dueAt)}`)
  return parts.join(' · ')
}

export function Tasks({ startOpen = false }: { startOpen?: boolean }) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(startOpen)
  const contexts: Context[] = state.profile.contexts.length ? state.profile.contexts : ['outro']
  const empty = { title: '', context: contexts[0], startAt: null as number | null, dueAt: null as number | null, effort: 'media' as Task['effort'] }
  const [draft, setDraft] = useState(empty)

  const pending = state.tasks.filter((t) => !t.done)
  const done = state.tasks.filter((t) => t.done)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim()) return
    dispatch({ type: 'task:add', task: { ...draft, title: draft.title.trim() } })
    setDraft(empty)
    setOpen(false)
  }

  return (
    <div className="screen">
      <h1>Tarefas</h1>
      <p className="muted">Trabalho, estudo, compromissos. Eu aviso quando for hora de começar ou terminar.</p>

      {open ? (
        <form className="card" onSubmit={save}>
          <label className="field">
            <span>O que é?</span>
            <input type="text" autoFocus value={draft.title} placeholder="Ex.: Entregar relatório"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="field">
            <span>De onde?</span>
            <select value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value as Context })}>
              {contexts.map((c) => <option key={c} value={c}>{CONTEXT_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Quando começar? <span className="muted small">(opcional)</span></span>
            <input type="datetime-local" value={toInput(draft.startAt)} onChange={(e) => setDraft({ ...draft, startAt: fromInput(e.target.value) })} />
          </label>
          <label className="field">
            <span>Prazo <span className="muted small">(opcional)</span></span>
            <input type="datetime-local" value={toInput(draft.dueAt)} onChange={(e) => setDraft({ ...draft, dueAt: fromInput(e.target.value) })} />
          </label>
          <label className="field">
            <span>Quanto de energia pede?</span>
            <select value={draft.effort} onChange={(e) => setDraft({ ...draft, effort: e.target.value as Task['effort'] })}>
              <option value="leve">Leve</option>
              <option value="media">Média</option>
              <option value="pesada">Pesada</option>
            </select>
          </label>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={!draft.title.trim()}>Salvar</button>
          </div>
        </form>
      ) : (
        <button className="btn primary block" onClick={() => setOpen(true)} style={{ marginBottom: 14 }}>+ Nova tarefa</button>
      )}

      <section className="card">
        <h2>Pendentes</h2>
        {!pending.length && <p className="muted">Nada pendente. 🌿</p>}
        <ul className="list">
          {pending.map((t) => (
            <li key={t.id} className="item">
              <input type="checkbox" aria-label={`Concluir ${t.title}`} style={{ width: 24, height: 24, accentColor: 'var(--blue-500)' }}
                checked={false} onChange={() => dispatch({ type: 'task:update', id: t.id, patch: { done: true } })} />
              <div className="body">
                <div className="title">{t.title}</div>
                <div className="muted small"><span className="chip">{CONTEXT_LABEL[t.context]}</span> {when(t)}</div>
              </div>
              {state.focus?.taskId === t.id
                ? <span className="chip">em foco</span>
                : <button className="btn ghost" onClick={() => dispatch({ type: 'focus:start', taskId: t.id })}>Focar</button>}
            </li>
          ))}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="card">
          <h2>Feitas</h2>
          <ul className="list">
            {done.map((t) => (
              <li key={t.id} className="item done">
                <input type="checkbox" aria-label={`Reabrir ${t.title}`} style={{ width: 24, height: 24, accentColor: 'var(--blue-500)' }}
                  checked onChange={() => dispatch({ type: 'task:update', id: t.id, patch: { done: false } })} />
                <div className="body"><div className="title">{t.title}</div></div>
                <button className="btn ghost" aria-label={`Apagar ${t.title}`} onClick={() => dispatch({ type: 'task:delete', id: t.id })}>🗑</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
