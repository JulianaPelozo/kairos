package br.com.kairos.app.notifier

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.kairos.app.MainActivity
import br.com.kairos.app.R

object Notifications {
    const val CHANNEL_ID = "lembretes"
    const val ACTION_DONE = "br.com.kairos.app.ACTION_DONE"
    const val ACTION_SNOOZE = "br.com.kairos.app.ACTION_SNOOZE"
    const val SNOOZE_MIN = 30

    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Lembretes", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Lembretes gentis de autocuidado e tarefas"
            },
        )
    }

    fun canPost(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun actionIntent(ctx: Context, action: String, key: String): PendingIntent {
        val intent = Intent(ctx, NotificationActionReceiver::class.java)
            .setAction(action)
            .putExtra(ReminderScheduler.EXTRA_KEY, key)
        val code = (action + key).hashCode()
        return PendingIntent.getBroadcast(ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun show(ctx: Context, reminder: Reminder) {
        if (!canPost(ctx)) return
        ensureChannel(ctx)

        val open = PendingIntent.getActivity(
            ctx, 0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_kairos)
            .setColor(0xFF4A6CF7.toInt())
            .setContentTitle(reminder.title)
            .setContentText(reminder.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(open)
            .setAutoCancel(true)
            .addAction(0, "Feito ✓", actionIntent(ctx, ACTION_DONE, reminder.key))
            .addAction(0, "Mais tarde", actionIntent(ctx, ACTION_SNOOZE, reminder.key))
            .build()

        try {
            NotificationManagerCompat.from(ctx).notify(reminder.key.hashCode(), notification)
        } catch (_: SecurityException) {
            // Permissão revogada entre a checagem e o envio.
        }
    }

    fun dismiss(ctx: Context, key: String) {
        NotificationManagerCompat.from(ctx).cancel(key.hashCode())
    }
}
