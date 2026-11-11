package br.com.kairos.app.notifier

import android.Manifest
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Ponte entre o React e o Android. Contrato em src/lib/notifier.ts.
 *
 * O JS calcula *quando* lembrar (motor de prioridade); o Kotlin garante que o lembrete
 * dispare mesmo com o app fechado e que "Feito"/"Mais tarde" funcionem direto na notificação.
 */
@CapacitorPlugin(
    name = "KairosNotifier",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class KairosNotifierPlugin : Plugin() {

    override fun load() {
        Notifications.ensureChannel(context)
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(JSObject().put("granted", true))
        } else {
            requestPermissionForAlias("notifications", call, "onPermissionResult")
        }
    }

    @PermissionCallback
    private fun onPermissionResult(call: PluginCall) {
        call.resolve(JSObject().put("granted", getPermissionState("notifications") == PermissionState.GRANTED))
    }

    @PluginMethod
    fun schedule(call: PluginCall) {
        val arr = call.getArray("reminders") ?: JSArray()
        call.getObject("quiet")?.let { q ->
            ReminderStore.saveQuiet(context, Quiet(toMinutes(q.getString("wake")), toMinutes(q.getString("sleep"))))
        }
        val reminders = (0 until arr.length()).map { Reminder.fromJson(arr.getJSONObject(it)) }
        ReminderScheduler.replaceAll(context, reminders)
        call.resolve()
    }

    @PluginMethod
    fun cancelAll(call: PluginCall) {
        ReminderScheduler.cancelAll(context)
        call.resolve()
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        context.startActivity(Notifications.settingsIntent(context))
        call.resolve()
    }

    @PluginMethod
    fun consumeActions(call: PluginCall) {
        val actions = ReminderStore.drainActions(context)
        call.resolve(JSObject().put("actions", JSArray(actions.toString())))
    }

    private fun toMinutes(hhmm: String?): Int {
        val parts = (hhmm ?: "00:00").split(":")
        return (parts.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (parts.getOrNull(1)?.toIntOrNull() ?: 0)
    }
}
