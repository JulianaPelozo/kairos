import type { AppState, CareItem, Suggestion, Task } from '../types'
import { atTimeOn, formatClock, formatDuration, isSleepTime, minutesUntil, nextAwake } from './time'

const MIN = 60_000
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** Itens que só fazem sentido como necessidade básica do corpo. */
const BODY = new Set(['agua', 'comer', 'pausa', 'banheiro'])

function careSuggestion(item: CareItem, state: AppState, now: number): Suggestion | null {
  const base = {
    key: `care:${item.id}`, kind: 'care' as const, refId: item.id,
    title: item.label, emoji: item.emoji, firstStep: item.firstStep,
  }

  // Itens com horário fixo (medicação): cobra quando o horário de hoje já passou e não foi feito.
  if (item.fixedTimes?.length) {
    const pending = item.fixedTimes
      .map((t) => atTimeOn(now, t))
      .filter((t) => t <= now && (item.lastDone ?? 0) < t)
    if (!pending.length) return null
    const since = (now - Math.max(...pending)) / MIN
    return {
      ...base,
      reason: `Estava marcado para ${formatClock(Math.max(...pending))}.`,
      score: clamp(since > 240 ? 80 : 95),
    }
  }

  // Sem registro: conta a partir do horário de acordar de hoje, para não cobrar tudo de uma vez.
  const wakeToday = atTimeOn(now, state.profile.wake)
  const since = item.lastDone ?? (wakeToday <= now ? wakeToday : now)
  const elapsedMin = (now - since) / MIN
  const ratio = elapsedMin / item.intervalMin
  if (ratio < 0.75) return null

  let score = item.weight * ratio * 55
  const energy = state.triage?.energy ?? 3
  if (energy <= 2 && BODY.has(item.id)) score *= 1.25

  if (state.focus && BODY.has(item.id)) {
    const focusMin = (now - state.focus.startedAt) / MIN
    if (focusMin >= state.settings.focusLimitMin) score += 15
  }

  const reason =
    item.lastDone == null
      ? `Sem registro desde que você acordou (${formatDuration(elapsedMin)}).`
      : `Faz ${formatDuration(elapsedMin)} desde a última vez.`

  return { ...base, reason, score: clamp(score) }
}

function taskSuggestion(task: Task, state: AppState, now: number): Suggestion | null {
  if (task.done) return null
  if (state.focus?.taskId === task.id) return null

  let score = 0
  let reason = ''
  let title = task.title
  let firstStep = 'Abra o que você precisa e faça só os primeiros 5 minutos.'

  if (task.startAt != null) {
    const m = (task.startAt - now) / MIN
    if (m <= 15 && m >= -60) {
      score = 85
      reason = m > 0 ? `Começa em ${formatDuration(m)}.` : 'Está na hora de começar.'
      title = `Começar: ${task.title}`
      firstStep = 'Separe o material. Começar já conta.'
    }
  }

  if (task.dueAt != null) {
    const m = (task.dueAt - now) / MIN
    let s: number
    let r: string
    if (m < 0) { s = 70; r = 'O prazo passou — tudo bem, ainda dá para resolver ou renegociar.' }
    else if (m < 60) { s = 90; r = `Prazo em ${formatDuration(m)}.` }
    else if (m < 180) { s = 75; r = `Prazo em ${formatDuration(m)}.` }
    else if (m < 720) { s = 58; r = `Prazo hoje, às ${formatClock(task.dueAt)}.` }
    else if (m < 1440) { s = 42; r = 'Prazo nas próximas 24h.' }
    else { s = 20; r = 'Ainda tem tempo, mas dá para adiantar.' }
    if (s > score) { score = s; reason = r }
  }

  if (task.startAt == null && task.dueAt == null) { score = 25; reason = 'Sem prazo — quando tiver energia.' }
  if (!score) return null

  const energy = state.triage?.energy ?? 3
  if (energy <= 2) score *= task.effort === 'pesada' ? 0.7 : task.effort === 'leve' ? 1.1 : 0.9
  if (energy >= 4 && task.effort === 'pesada') score *= 1.05

  return {
    key: `task:${task.id}`, kind: 'task', refId: task.id,
    title, emoji: '📌', reason, firstStep, score: clamp(score),
  }
}

/**
 * Lista ordenada do que é mais prioritário agora.
 * Regra de ouro: o corpo vem antes da tarefa quando a necessidade está bem atrasada.
 */
export function prioritize(state: AppState, now = Date.now()): Suggestion[] {
  const { wake, sleep } = state.profile
  const isSnoozed = (key: string) => (state.snoozed[key] ?? 0) > now

  if (isSleepTime(now, wake, sleep)) {
    return [{
      key: 'special:dormir', kind: 'special', refId: 'dormir', emoji: '🌙',
      title: 'Descansar', reason: 'Já é seu horário de sono. O resto pode esperar até amanhã.',
      firstStep: 'Deixe o celular longe da cama.', score: 100,
    }]
  }

  const out: Suggestion[] = []
  for (const c of state.care) {
    if (!c.enabled) continue
    const s = careSuggestion(c, state, now)
    if (s) out.push(s)
  }

  const toSleep = minutesUntil(now, sleep)
  const windingDown = toSleep <= state.settings.windDownMin

  for (const t of state.tasks) {
    const s = taskSuggestion(t, state, now)
    if (!s) continue
    if (windingDown && s.score < 90) s.score = clamp(s.score * 0.6)
    out.push(s)
  }

  if (windingDown) {
    out.push({
      key: 'special:desacelerar', kind: 'special', refId: 'desacelerar', emoji: '🌙',
      title: 'Começar a desacelerar', reason: `Faltam ${formatDuration(toSleep)} para seu horário de dormir.`,
      firstStep: 'Diminua a luz e anote o que ficou para amanhã.', score: 80,
    })
  }

  if (state.focus) {
    const focusMin = (now - state.focus.startedAt) / MIN
    if (focusMin >= state.settings.focusLimitMin && !out.some((s) => s.refId === 'pausa')) {
      out.push({
        key: 'special:pausa-foco', kind: 'special', refId: 'pausa-foco', emoji: '🫧',
        title: 'Fazer uma pausa', reason: `Você está em foco há ${formatDuration(focusMin)}.`,
        firstStep: 'Tire os olhos da tela e respire fundo três vezes.', score: 78,
      })
    }
  }

  return out.filter((s) => !isSnoozed(s.key)).sort((a, b) => b.score - a.score)
}

export interface Reminder {
  /** Identificador estável — reagendar substitui o anterior. */
  key: string
  at: number
  title: string
  body: string
  /** Se for cuidado recorrente, o nativo reagenda sozinho após "Feito". */
  repeatMin?: number
  /** Horário fixo diário (medicação): o nativo reagenda para o dia seguinte. */
  daily?: boolean
}

/**
 * Agenda dos próximos lembretes, entregue ao módulo nativo (Kotlin).
 * Como o JS não roda com o app fechado, calculamos aqui os horários e o Android dispara.
 */
export function upcomingReminders(state: AppState, now = Date.now(), horizonMin = 24 * 60): Reminder[] {
  const { wake, sleep } = state.profile
  const end = now + horizonMin * MIN
  const out: Reminder[] = []

  for (const c of state.care) {
    if (!c.enabled) continue
    if (c.fixedTimes?.length) {
      for (const t of c.fixedTimes) {
        let at = atTimeOn(now, t)
        if (at <= now) at += 86_400_000
        out.push({ key: `care:${c.id}:${t}`, at, title: `${c.emoji} ${c.label}`, body: c.firstStep, daily: true })
      }
      continue
    }
    const snoozedUntil = state.snoozed[`care:${c.id}`] ?? 0
    let at = Math.max(c.lastDone == null ? now + 30 * MIN : c.lastDone + c.intervalMin * MIN, snoozedUntil, now + MIN)
    at = nextAwake(at, wake, sleep)
    out.push({
      key: `care:${c.id}`, at, title: `${c.emoji} ${c.label}`, body: c.firstStep,
      repeatMin: c.intervalMin,
    })
  }

  for (const t of state.tasks) {
    if (t.done) continue
    if (t.startAt && t.startAt > now) {
      out.push({ key: `task:${t.id}:start`, at: t.startAt, title: `📌 Hora de começar: ${t.title}`, body: 'Começar já conta. Só os primeiros 5 minutos.' })
    }
    if (t.dueAt && t.dueAt - 60 * MIN > now) {
      out.push({ key: `task:${t.id}:due`, at: t.dueAt - 60 * MIN, title: `⏳ Falta 1h: ${t.title}`, body: 'Quer finalizar ou ajustar o prazo?' })
    }
  }

  const windDown = atTimeOn(now, sleep) - state.settings.windDownMin * MIN
  out.push({
    key: 'special:desacelerar',
    at: windDown > now ? windDown : windDown + 86_400_000,
    title: '🌙 Hora de desacelerar',
    body: 'Anote o que ficou para amanhã. Você fez o que deu hoje.',
  })

  return out.filter((r) => r.at <= end).sort((a, b) => a.at - b.at)
}
