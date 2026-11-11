export type Context = 'trabalho' | 'faculdade' | 'escola' | 'casa' | 'outro'

export type Energy = 1 | 2 | 3 | 4 | 5

/** Um cuidado recorrente: água, comer, pausa, banho... */
export interface CareItem {
  id: string
  label: string
  emoji: string
  /** Intervalo ideal entre uma vez e outra, em minutos. */
  intervalMin: number
  /** Peso relativo: necessidades fisiológicas pesam mais. */
  weight: number
  enabled: boolean
  /** Último momento em que foi feito (epoch ms). */
  lastDone: number | null
  /** Passo minúsculo para começar, contra a paralisia de iniciar. */
  firstStep: string
  /** Para itens com horário fixo (ex.: medicação), "HH:MM". */
  fixedTimes?: string[]
}

export interface Task {
  id: string
  title: string
  context: Context
  /** Quando começar (epoch ms), opcional. */
  startAt: number | null
  /** Prazo (epoch ms), opcional. */
  dueAt: number | null
  effort: 'leve' | 'media' | 'pesada'
  done: boolean
  updatedAt: number
}

export interface Profile {
  name: string
  wake: string // "HH:MM"
  sleep: string // "HH:MM"
  contexts: Context[]
  onboarded: boolean
}

export interface Triage {
  at: number
  energy: Energy
}

export interface Focus {
  taskId: string
  startedAt: number
}

export type Theme = 'sistema' | 'claro' | 'escuro'

export interface Settings {
  theme: Theme
  notifications: boolean
  /** Depois de quantos minutos de foco contínuo o app puxa uma pausa. */
  focusLimitMin: number
  /** Minutos antes de dormir em que o app começa a sugerir desacelerar. */
  windDownMin: number
}

export interface AppState {
  profile: Profile
  care: CareItem[]
  tasks: Task[]
  triage: Triage | null
  focus: Focus | null
  settings: Settings
  /** Itens adiados: id → até quando (epoch ms). */
  snoozed: Record<string, number>
  updatedAt: number
}

export interface Suggestion {
  /** "care:agua", "task:123", "special:dormir" */
  key: string
  kind: 'care' | 'task' | 'special'
  refId: string
  title: string
  emoji: string
  /** Por que isso agora — sempre sem culpa. */
  reason: string
  firstStep: string
  /** 0–100 */
  score: number
}
