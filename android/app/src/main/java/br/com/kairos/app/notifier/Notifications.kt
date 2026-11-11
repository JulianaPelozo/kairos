package br.com.kairos.app.notifier

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.kairos.app.MainActivity
import br.com.kairos.app.R

object Notifications {
    /**
     * A importância de um canal não pode mudar depois de criado; por isso um id novo
     * quando o comportamento muda. "v2": pop-up (heads-up), som, vibração e tela de bloqueio.
     */
    const val CHANNEL_ID = "lembretes_v2"
    private val OLD_CHANNELS = listOf("lembretes")
    const val ACTION_DONE = "br.com.kairos.app.ACTION_DONE"
    const val ACTION_SNOOZE = "br.com.kairos.app.ACTION_SNOOZE"
    const val SNOOZE_MIN = 30
    private val VIBRATION = longArrayOf(0, 250, 150, 250)

    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        OLD_CHANNELS.forEach { nm.deleteNotificationChannel(it) }
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Lembretes", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Lembretes gentis de autocuidado e tarefas (aparecem em pop-up)"
                enableVibration(true)
                vibrationPattern = VIBRATION
                enableLights(true)
                lightColor = 0xFF9B84EC.toInt()
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
    }

    /** Tela do sistema onde a pessoa liga "Pop-up" / "Notificações flutuantes", se o fabricante desligou. */
    fun settingsIntent(ctx: Context): Intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
                .putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL_ID)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

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
            .setPriority(NotificationCompat.PRIORITY_HIGH) // pop-up no Android < 8
            .setDefaults(NotificationCompat.DEFAULT_SOUND)
            .setVibrate(VIBRATION)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
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
