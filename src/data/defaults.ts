import type { AppState, CareItem } from '../types'

export const DEFAULT_CARE: CareItem[] = [
  {
    id: 'agua', label: 'Beber água', emoji: '💧', intervalMin: 120, weight: 1.1,
    enabled: true, lastDone: null, firstStep: 'Só encha um copo e deixe perto de você.',
  },
  {
    id: 'comer', label: 'Comer algo', emoji: '🍽️', intervalMin: 240, weight: 1.3,
    enabled: true, lastDone: null, firstStep: 'Pode ser simples: uma fruta, um pão, um iogurte.',
  },
  {
    id: 'pausa', label: 'Levantar e se mexer', emoji: '🧘', intervalMin: 90, weight: 0.9,
    enabled: true, lastDone: null, firstStep: 'Fique em pé e estique os braços por 30 segundos.',
  },
  {
    id: 'banheiro', label: 'Ir ao banheiro', emoji: '🚻', intervalMin: 180, weight: 0.8,
    enabled: true, lastDone: null, firstStep: 'Vai lá rapidinho, a tarefa espera.',
  },
  {
    id: 'banho', label: 'Tomar banho', emoji: '🚿', intervalMin: 1440, weight: 0.8,
    enabled: true, lastDone: null, firstStep: 'Separe só a toalha e a roupa. O resto vem depois.',
  },
  {
    id: 'dentes', label: 'Escovar os dentes', emoji: '🪥', intervalMin: 720, weight: 0.6,
    enabled: true, lastDone: null, firstStep: 'Coloque pasta na escova. Só isso, por enquanto.',
  },
  {
    id: 'medicacao', label: 'Tomar medicação', emoji: '💊', intervalMin: 1440, weight: 1.5,
    enabled: false, lastDone: null, firstStep: 'Pegue o remédio e um copo d’água.', fixedTimes: ['08:00'],
  },
  {
    id: 'ar', label: 'Tomar um ar / ver a luz do dia', emoji: '🌤️', intervalMin: 480, weight: 0.5,
    enabled: false, lastDone: null, firstStep: 'Abra uma janela ou vá até a porta por um minuto.',
  },
]

export function initialState(): AppState {
  return {
    profile: { name: '', wake: '07:00', sleep: '23:00', contexts: [], onboarded: false },
    care: DEFAULT_CARE.map((c) => ({ ...c })),
    tasks: [],
    triage: null,
    focus: null,
    settings: { notifications: true, focusLimitMin: 120, windDownMin: 45 },
    snoozed: {},
    updatedAt: Date.now(),
  }
}
