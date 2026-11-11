import { useStore } from '../state/store'
import { useCareDone } from '../state/hooks'
import { formatDuration } from '../engine/time'

const INTERVALS = [30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440]

export function Care({ now }: { now: number }) {
  const { state, dispatch } = useStore()
  const done = useCareDone()

  return (
    <div className="screen">
      <h1>Autocuidado</h1>
      <p className="muted">Ajuste de quanto em quanto tempo eu te lembro. Toque em <strong>Fiz agora</strong> sempre que fizer.</p>

      {state.care.map((c) => (
        <section key={c.id} className="card">
          <div className="item" style={{ padding: 0, border: 0 }}>
            <span className="emoji" aria-hidden>{c.emoji}</span>
            <div className="body">
              <div className="title">{c.label}</div>
              <div className="muted small">
                {c.lastDone ? `Última vez há ${formatDuration((now - c.lastDone) / 60_000)}` : 'Sem registro ainda'}
              </div>
            </div>
            {c.enabled && <button className="btn primary" onClick={() => done(c.id)}>Fiz agora</button>}
          </div>

          <label className="switch">
            <span>Lembrar disso</span>
            <input type="checkbox" checked={c.enabled}
              onChange={(e) => dispatch({ type: 'care:update', id: c.id, patch: { enabled: e.target.checked } })} />
          </label>

          {c.enabled && (c.fixedTimes ? (
            <label className="field">
              <span>Horários (separados por vírgula)</span>
              <input type="text" inputMode="numeric" defaultValue={c.fixedTimes.join(', ')}
                onBlur={(e) => {
                  const times = e.target.value.split(',').map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s))
                    .map((s) => s.padStart(5, '0'))
                  if (times.length) dispatch({ type: 'care:update', id: c.id, patch: { fixedTimes: times } })
                }} />
            </label>
          ) : (
            <label className="field">
              <span>A cada</span>
              <select value={c.intervalMin}
                onChange={(e) => dispatch({ type: 'care:update', id: c.id, patch: { intervalMin: Number(e.target.value) } })}>
                {[...new Set([...INTERVALS, c.intervalMin])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>{m === 1440 ? '1 dia' : formatDuration(m)}</option>
                ))}
              </select>
            </label>
          ))}
        </section>
      ))}
    </div>
  )
}
