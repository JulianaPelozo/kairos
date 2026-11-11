/** "HH:MM" → minutos desde 00:00 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesOfDay(ts: number): number {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}

/** Verdadeiro se `ts` cai no período de sono (lida com virada da meia-noite). */
export function isSleepTime(ts: number, wake: string, sleep: string): boolean {
  const now = minutesOfDay(ts)
  const w = toMinutes(wake)
  const s = toMinutes(sleep)
  if (w === s) return false
  return s > w ? now >= s || now < w : now >= s && now < w
}

/** Minutos até o horário de dormir (sempre ≥ 0, olhando para frente). */
export function minutesUntil(ts: number, hhmm: string): number {
  const diff = toMinutes(hhmm) - minutesOfDay(ts)
  return diff >= 0 ? diff : diff + 1440
}

/** Timestamp do horário "HH:MM" no mesmo dia de `ts`. */
export function atTimeOn(ts: number, hhmm: string): number {
  const d = new Date(ts)
  const mins = toMinutes(hhmm)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d.getTime()
}

/** Próximo instante acordado a partir de `ts` (se estiver dormindo, pula para o horário de acordar). */
export function nextAwake(ts: number, wake: string, sleep: string): number {
  if (!isSleepTime(ts, wake, sleep)) return ts
  let t = atTimeOn(ts, wake)
  if (t <= ts) t += 86_400_000
  return t
}

export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
