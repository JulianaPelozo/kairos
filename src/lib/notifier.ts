import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Reminder } from '../engine/priority'

export interface NotificationAction {
  key: string
  action: 'done' | 'snooze'
  at: number
}

/** Contrato com o plugin Kotlin em android/app/src/main/java/br/com/kairos/app/notifier/. */
interface KairosNotifierPlugin {
  requestPermission(): Promise<{ granted: boolean }>
  schedule(opts: { reminders: Reminder[]; quiet: Quiet }): Promise<void>
  cancelAll(): Promise<void>
  /** Ações tocadas na notificação enquanto o app estava fechado. */
  consumeActions(): Promise<{ actions: NotificationAction[] }>
}

/** Período de sono, para o nativo não reagendar lembretes de madrugada. */
export interface Quiet { wake: string; sleep: string }

const Native = registerPlugin<KairosNotifierPlugin>('KairosNotifier')
export const isNative = Capacitor.isNativePlatform()

// ---- Fallback para navegador (desenvolvimento): só funciona com a aba aberta ----
let webTimers: number[] = []

async function showWeb(title: string, body: string, tag: string) {
  const opts = { body, tag, icon: './icons/icon-192.png', badge: './icons/favicon.png' }
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  if (reg) return reg.showNotification(title, opts)
  new Notification(title, opts)
}

export const notifier = {
  async requestPermission(): Promise<boolean> {
    if (isNative) return (await Native.requestPermission()).granted
    if (!('Notification' in window)) return false
    return (await Notification.requestPermission()) === 'granted'
  },

  async schedule(reminders: Reminder[], quiet: Quiet) {
    if (isNative) return Native.schedule({ reminders, quiet })
    webTimers.forEach(clearTimeout)
    webTimers = []
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const now = Date.now()
    for (const r of reminders) {
      const delay = r.at - now
      if (delay > 0 && delay < 2 ** 31 - 1) {
        webTimers.push(window.setTimeout(() => showWeb(r.title, r.body, r.key), delay))
      }
    }
  },

  async cancelAll() {
    if (isNative) return Native.cancelAll()
    webTimers.forEach(clearTimeout)
    webTimers = []
  },

  async consumeActions(): Promise<NotificationAction[]> {
    if (!isNative) return []
    return (await Native.consumeActions()).actions
  },
}
