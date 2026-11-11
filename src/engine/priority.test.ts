import { describe, expect, it } from 'vitest'
import { prioritize, upcomingReminders } from './priority'
import { initialState } from '../data/defaults'
import type { AppState } from '../types'

const H = 3_600_000
// Quarta-feira, 14h00 (horário local)
const NOW = new Date(2026, 10, 11, 14, 0).getTime()

function base(): AppState {
  const s = initialState()
  s.profile = { ...s.profile, onboarded: true, wake: '07:00', sleep: '23:00' }
  // tudo recém-feito
  s.care = s.care.map((c) => ({ ...c, lastDone: NOW - 10 * 60_000 }))
  return s
}

describe('prioritize', () => {
  it('sem nada atrasado, não sugere nada', () => {
    expect(prioritize(base(), NOW)).toEqual([])
  })

  it('fome muito atrasada passa na frente de tarefa com prazo em 2h', () => {
    const s = base()
    s.care = s.care.map((c) => (c.id === 'comer' ? { ...c, lastDone: NOW - 7 * H } : c))
    s.tasks.push({ id: 't1', title: 'Relatório', context: 'trabalho', startAt: null, dueAt: NOW + 2 * H, effort: 'media', done: false, updatedAt: NOW })
    const [top] = prioritize(s, NOW)
    expect(top.key).toBe('care:comer')
  })

  it('prazo em menos de 1h vence água levemente atrasada', () => {
    const s = base()
    s.care = s.care.map((c) => (c.id === 'agua' ? { ...c, lastDone: NOW - 2.2 * H } : c))
    s.tasks.push({ id: 't1', title: 'Entrega', context: 'faculdade', startAt: null, dueAt: NOW + 40 * 60_000, effort: 'media', done: false, updatedAt: NOW })
    expect(prioritize(s, NOW)[0].key).toBe('task:t1')
  })

  it('energia baixa rebaixa tarefa pesada', () => {
    const s = base()
    s.tasks.push({ id: 't1', title: 'Pesada', context: 'trabalho', startAt: null, dueAt: NOW + 5 * H, effort: 'pesada', done: false, updatedAt: NOW })
    const normal = prioritize(s, NOW)[0].score
    s.triage = { at: NOW, energy: 1 }
    expect(prioritize(s, NOW)[0].score).toBeLessThan(normal)
  })

  it('foco longo puxa uma pausa', () => {
    const s = base()
    s.tasks.push({ id: 't1', title: 'Codar', context: 'trabalho', startAt: null, dueAt: null, effort: 'media', done: false, updatedAt: NOW })
    s.focus = { taskId: 't1', startedAt: NOW - 3 * H }
    expect(prioritize(s, NOW).some((x) => x.key === 'special:pausa-foco')).toBe(true)
  })

  it('medicação no horário passado e não tomada fica no topo', () => {
    const s = base()
    s.care = s.care.map((c) => (c.id === 'medicacao' ? { ...c, enabled: true, fixedTimes: ['13:30'], lastDone: NOW - 20 * H } : c))
    expect(prioritize(s, NOW)[0].key).toBe('care:medicacao')
  })

  it('durante o sono, só sugere descansar', () => {
    const s = base()
    const night = new Date(2026, 10, 11, 2, 0).getTime()
    expect(prioritize(s, night).map((x) => x.key)).toEqual(['special:dormir'])
  })

  it('cuidado sem registro conta a partir do horário de acordar', () => {
    const s = base()
    s.care = s.care.map((c) => (c.id === 'banheiro' ? { ...c, lastDone: null } : c))
    const cedo = new Date(2026, 10, 11, 8, 0).getTime() // 1h depois de acordar
    expect(prioritize(s, cedo).some((x) => x.key === 'care:banheiro')).toBe(false)
    expect(prioritize(s, NOW).some((x) => x.key === 'care:banheiro')).toBe(true)
  })

  it('itens adiados somem até o fim do adiamento', () => {
    const s = base()
    s.care = s.care.map((c) => (c.id === 'agua' ? { ...c, lastDone: NOW - 4 * H } : c))
    s.snoozed['care:agua'] = NOW + 30 * 60_000
    expect(prioritize(s, NOW).some((x) => x.key === 'care:agua')).toBe(false)
  })
})

describe('upcomingReminders', () => {
  it('não agenda cuidados durante o sono', () => {
    const s = base()
    s.care = s.care.map((c) => (c.id === 'agua' ? { ...c, lastDone: new Date(2026, 10, 11, 22, 30).getTime() } : c))
    const late = new Date(2026, 10, 11, 22, 40).getTime()
    const agua = upcomingReminders(s, late).find((r) => r.key === 'care:agua')!
    expect(new Date(agua.at).getHours()).toBe(7)
  })

  it('agenda início e prazo de tarefas', () => {
    const s = base()
    s.tasks.push({ id: 't1', title: 'Aula', context: 'faculdade', startAt: NOW + H, dueAt: NOW + 3 * H, effort: 'leve', done: false, updatedAt: NOW })
    const keys = upcomingReminders(s, NOW).map((r) => r.key)
    expect(keys).toContain('task:t1:start')
    expect(keys).toContain('task:t1:due')
  })
})
