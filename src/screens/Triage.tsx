import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useCareDone } from '../state/hooks'
import { atTimeOn } from '../engine/time'
import type { Energy } from '../types'

const H = 3_600_000

interface Option {
  label: string
  emoji?: string
  apply: () => void
  /** A própria opção já navega para outro lugar; não avança a triagem. */
  leaves?: boolean
}
interface Question { id: string; title: string; hint?: string; options: Option[] }

/**
 * Triagem: uma pergunta por tela, botões grandes, sempre dá para pular.
 * As respostas ajustam "quando foi a última vez" de cada cuidado e a energia do momento,
 * e o motor de prioridade faz o resto.
 */
export function Triage({ onDone, onAddTask }: { onDone: () => void; onAddTask: () => void }) {
  const { state, dispatch } = useStore()
  const done = useCareDone()
  const [i, setI] = useState(0)
  const enabled = (id: string) => state.care.some((c) => c.id === id && c.enabled)

  const questions = useMemo<Question[]>(() => {
    const now = Date.now()
    const setLast = (id: string, at: number | null) => () => dispatch({ type: 'care:set-last', id, at })
    const energy = (e: Energy) => () => dispatch({ type: 'triage', energy: e })
    const qs: Question[] = []

    if (enabled('comer')) qs.push({
      id: 'comer', title: 'Quando você comeu pela última vez?', options: [
        { emoji: '😋', label: 'Agora há pouco', apply: () => done('comer', now - 0.25 * H) },
        { emoji: '🕐', label: 'Entre 1 e 3 horas', apply: setLast('comer', now - 2 * H) },
        { emoji: '🕓', label: 'Entre 3 e 5 horas', apply: setLast('comer', now - 4 * H) },
        { emoji: '🤷', label: 'Mais que isso / não lembro', apply: setLast('comer', now - 6 * H) },
      ],
    })
    if (enabled('agua')) qs.push({
      id: 'agua', title: 'E água?', options: [
        { emoji: '💧', label: 'Bebi na última hora', apply: () => done('agua', now - 0.5 * H) },
        { emoji: '🕑', label: 'Faz umas horas', apply: setLast('agua', now - 2.5 * H) },
        { emoji: '🤷', label: 'Não lembro', apply: setLast('agua', now - 4 * H) },
      ],
    })
    if (enabled('pausa')) qs.push({
      id: 'pausa', title: 'Quando foi a última vez que você levantou?', options: [
        { emoji: '🚶', label: 'Agora há pouco', apply: () => done('pausa', now - 0.15 * H) },
        { emoji: '🪑', label: 'Faz um tempinho', apply: setLast('pausa', now - 1 * H) },
        { emoji: '🧱', label: 'Faz muito tempo', apply: setLast('pausa', now - 2.5 * H) },
      ],
    })
    if (enabled('banho')) qs.push({
      id: 'banho', title: 'Já tomou banho hoje?', options: [
        { emoji: '🚿', label: 'Sim', apply: () => done('banho', Math.min(now, atTimeOn(now, state.profile.wake) + H)) },
        { emoji: '⏳', label: 'Ainda não', apply: setLast('banho', now - 24 * H) },
      ],
    })
    if (enabled('medicacao')) qs.push({
      id: 'medicacao', title: 'Já tomou sua medicação de hoje?', options: [
        { emoji: '💊', label: 'Sim', apply: () => done('medicacao', now) },
        { emoji: '⏳', label: 'Ainda não', apply: setLast('medicacao', null) },
      ],
    })
    qs.push({
      id: 'energia', title: 'Como está sua energia agora?', hint: 'Isso muda o tipo de coisa que eu vou sugerir.', options: [
        { emoji: '🪫', label: 'Muito baixa', apply: energy(1) },
        { emoji: '😮‍💨', label: 'Baixa', apply: energy(2) },
        { emoji: '🙂', label: 'Ok', apply: energy(3) },
        { emoji: '⚡', label: 'Boa', apply: energy(4) },
      ],
    })
    qs.push({
      id: 'prazo', title: 'Tem algo com prazo ou horário hoje?', options: [
        { emoji: '📝', label: 'Sim, quero anotar', apply: onAddTask, leaves: true },
        { emoji: '👌', label: 'Não / já está anotado', apply: () => {} },
      ],
    })
    return qs
    // As perguntas são montadas uma vez por triagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q = questions[i]
  const advance = () => (i + 1 >= questions.length ? onDone() : setI(i + 1))

  return (
    <div className="screen">
      <div className="progress" aria-hidden><div style={{ width: `${((i + 1) / questions.length) * 100}%` }} /></div>
      <p className="muted small">Pergunta {i + 1} de {questions.length}</p>
      <h1>{q.title}</h1>
      {q.hint && <p className="muted">{q.hint}</p>}
      <div className="options" role="group" aria-label={q.title}>
        {q.options.map((o) => (
          <button key={o.label} className="option" onClick={() => {
            o.apply()
            if (!o.leaves) advance()
          }}>
            {o.emoji && <span className="emoji" aria-hidden>{o.emoji}</span>}{o.label}
          </button>
        ))}
      </div>
      <div className="spacer" />
      <div className="row">
        {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Voltar</button>}
        <button className="btn ghost" onClick={advance}>Pular</button>
      </div>
    </div>
  )
}
