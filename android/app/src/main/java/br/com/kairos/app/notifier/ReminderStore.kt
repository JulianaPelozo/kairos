package br.com.kairos.app.notifier

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Um lembrete agendado pelo JS (ver `upcomingReminders` em src/engine/priority.ts). */
data class Reminder(
    val key: String,
    val at: Long,
    val title: String,
    val body: String,
    /** Se definido, o lembrete se repete sozinho depois de "Feito". */
    val repeatMin: Int?,
    /** Horário fixo diário (ex.: medicação): depois de disparar, volta amanhã no mesmo horário. */
    val daily: Boolean = false,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("key", key).put("at", at).put("title", title).put("body", body)
        .put("daily", daily)
        .apply { if (repeatMin != null) put("repeatMin", repeatMin) }

    companion object {
        fun fromJson(o: JSONObject) = Reminder(
            key = o.getString("key"),
            at = o.getLong("at"),
            title = o.getString("title"),
            body = o.optString("body", ""),
            repeatMin = if (o.has("repeatMin") && !o.isNull("repeatMin")) o.getInt("repeatMin") else null,
            daily = o.optBoolean("daily", false),
        )
    }
}

/** Período de sono, em minutos desde 00:00. */
data class Quiet(val wakeMin: Int, val sleepMin: Int)

/**
 * Persistência nativa (SharedPreferences): o que está agendado, o horário de sono
 * e as ações tocadas na notificação que o JS ainda não leu.
 */
object ReminderStore {
    private const val PREFS = "kairos_notifier"
    private const val K_REMINDERS = "reminders"
    private const val K_ACTIONS = "pending_actions"
    private const val K_WAKE = "wake_min"
    private const val K_SLEEP = "sleep_min"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun saveAll(ctx: Context, reminders: List<Reminder>) {
        val arr = JSONArray().apply { reminders.forEach { put(it.toJson()) } }
        prefs(ctx).edit().putString(K_REMINDERS, arr.toString()).apply()
    }

    fun loadAll(ctx: Context): List<Reminder> {
        val raw = prefs(ctx).getString(K_REMINDERS, null) ?: return emptyList()
        val arr = JSONArray(raw)
        return (0 until arr.length()).map { Reminder.fromJson(arr.getJSONObject(it)) }
    }

    fun get(ctx: Context, key: String): Reminder? = loadAll(ctx).firstOrNull { it.key == key }

    fun upsert(ctx: Context, reminder: Reminder) {
        saveAll(ctx, loadAll(ctx).filterNot { it.key == reminder.key } + reminder)
    }

    fun remove(ctx: Context, key: String) {
        saveAll(ctx, loadAll(ctx).filterNot { it.key == key })
    }

    fun saveQuiet(ctx: Context, quiet: Quiet) {
        prefs(ctx).edit().putInt(K_WAKE, quiet.wakeMin).putInt(K_SLEEP, quiet.sleepMin).apply()
    }

    fun quiet(ctx: Context) = Quiet(
        prefs(ctx).getInt(K_WAKE, 7 * 60),
        prefs(ctx).getInt(K_SLEEP, 23 * 60),
    )

    @Synchronized
    fun pushAction(ctx: Context, key: String, action: String, at: Long) {
        val arr = JSONArray(prefs(ctx).getString(K_ACTIONS, "[]"))
        arr.put(JSONObject().put("key", key).put("action", action).put("at", at))
        prefs(ctx).edit().putString(K_ACTIONS, arr.toString()).apply()
    }

    @Synchronized
    fun drainActions(ctx: Context): JSONArray {
        val arr = JSONArray(prefs(ctx).getString(K_ACTIONS, "[]"))
        prefs(ctx).edit().putString(K_ACTIONS, "[]").apply()
        return arr
    }
}
