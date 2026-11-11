package br.com.kairos.app.notifier

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * Agenda alarmes no AlarmManager. Usamos alarmes "inexatos que funcionam em idle"
 * (setAndAllowWhileIdle): podem atrasar alguns minutos para poupar bateria, o que é ok
 * para lembretes de autocuidado, e não exigem a permissão especial de alarme exato.
 */
object ReminderScheduler {
    const val EXTRA_KEY = "br.com.kairos.app.REMINDER_KEY"

    private fun alarmManager(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun pendingIntent(ctx: Context, key: String, flags: Int): PendingIntent? {
        val intent = Intent(ctx, ReminderReceiver::class.java).putExtra(EXTRA_KEY, key)
        return PendingIntent.getBroadcast(ctx, key.hashCode(), intent, flags or PendingIntent.FLAG_IMMUTABLE)
    }

    /** Substitui toda a agenda pela lista vinda do JS. */
    fun replaceAll(ctx: Context, reminders: List<Reminder>) {
        ReminderStore.loadAll(ctx).forEach { cancel(ctx, it.key) }
        ReminderStore.saveAll(ctx, reminders)
        reminders.forEach { schedule(ctx, it) }
    }

    fun schedule(ctx: Context, reminder: Reminder) {
        val pi = pendingIntent(ctx, reminder.key, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
        val at = maxOf(reminder.at, System.currentTimeMillis() + 5_000)
        alarmManager(ctx).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }

    fun cancel(ctx: Context, key: String) {
        pendingIntent(ctx, key, PendingIntent.FLAG_NO_CREATE)?.let {
            alarmManager(ctx).cancel(it)
            it.cancel()
        }
    }

    fun cancelAll(ctx: Context) {
        ReminderStore.loadAll(ctx).forEach { cancel(ctx, it.key) }
        ReminderStore.saveAll(ctx, emptyList())
    }

    /** Reagenda o mesmo lembrete para daqui a [minutes], pulando o período de sono. */
    fun rescheduleIn(ctx: Context, reminder: Reminder, minutes: Int) {
        val next = reminder.copy(at = skipSleep(ctx, System.currentTimeMillis() + minutes * 60_000L))
        ReminderStore.upsert(ctx, next)
        schedule(ctx, next)
    }

    /** Se [ts] cai no período de sono, empurra para o próximo horário de acordar. */
    fun skipSleep(ctx: Context, ts: Long): Long {
        val q = ReminderStore.quiet(ctx)
        val cal = Calendar.getInstance().apply { timeInMillis = ts }
        val now = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        val asleep = when {
            q.wakeMin == q.sleepMin -> false
            q.sleepMin > q.wakeMin -> now >= q.sleepMin || now < q.wakeMin
            else -> now >= q.sleepMin && now < q.wakeMin
        }
        if (!asleep) return ts
        cal.set(Calendar.HOUR_OF_DAY, q.wakeMin / 60)
        cal.set(Calendar.MINUTE, q.wakeMin % 60)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= ts) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
    }
}
