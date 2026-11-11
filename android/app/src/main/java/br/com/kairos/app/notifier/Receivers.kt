package br.com.kairos.app.notifier

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Disparado pelo AlarmManager: mostra a notificação. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val key = intent.getStringExtra(ReminderScheduler.EXTRA_KEY) ?: return
        val reminder = ReminderStore.get(ctx, key) ?: return
        Notifications.show(ctx, reminder)

        // Cuidados recorrentes: se a pessoa ignorar, lembra de novo depois de um intervalo.
        // Horário fixo: volta amanhã. Lembretes únicos (início/prazo de tarefa) saem da agenda.
        val repeat = reminder.repeatMin
        when {
            repeat != null -> ReminderScheduler.rescheduleIn(ctx, reminder, repeat)
            reminder.daily -> {
                val tomorrow = reminder.copy(at = reminder.at + 24 * 60 * 60_000L)
                ReminderStore.upsert(ctx, tomorrow)
                ReminderScheduler.schedule(ctx, tomorrow)
            }
            else -> ReminderStore.remove(ctx, key)
        }
    }
}

/** Botões "Feito" e "Mais tarde" da notificação — funcionam sem abrir o app. */
class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val key = intent.getStringExtra(ReminderScheduler.EXTRA_KEY) ?: return
        val now = System.currentTimeMillis()
        Notifications.dismiss(ctx, key)
        val reminder = ReminderStore.get(ctx, key)

        when (intent.action) {
            Notifications.ACTION_DONE -> {
                ReminderStore.pushAction(ctx, key, "done", now)
                // Recorrente: próximo lembrete conta a partir de agora.
                // Horário fixo e lembretes únicos já foram tratados quando a notificação disparou.
                val repeat = reminder?.repeatMin
                if (repeat != null) ReminderScheduler.rescheduleIn(ctx, reminder, repeat)
            }
            Notifications.ACTION_SNOOZE -> {
                ReminderStore.pushAction(ctx, key, "snooze", now)
                val r = reminder ?: return
                ReminderScheduler.rescheduleIn(ctx, r, Notifications.SNOOZE_MIN)
            }
        }
    }
}

/** Alarmes são apagados quando o celular reinicia: reagenda tudo. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val now = System.currentTimeMillis()
        ReminderStore.loadAll(ctx).forEach { r ->
            val fixed = if (r.at < now) r.copy(at = ReminderScheduler.skipSleep(ctx, now + 60_000)) else r
            ReminderStore.upsert(ctx, fixed)
            ReminderScheduler.schedule(ctx, fixed)
        }
    }
}
