import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppState } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null quando o app roda sem Supabase configurado (modo só local). */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null

/** Envia um código de 6 dígitos por e-mail — sem senha e sem link mágico (que exigiria deep link). */
export async function sendCode(email: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw error
}

export async function verifyCode(email: string, token: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function pullState(userId: string): Promise<AppState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_state').select('state').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data?.state as AppState) ?? null
}

export async function pushState(userId: string, state: AppState) {
  if (!supabase) return
  const { error } = await supabase.from('app_state').upsert({
    user_id: userId,
    state,
    updated_at: new Date(state.updatedAt).toISOString(),
  })
  if (error) throw error
}

/** Histórico de cuidados — base para, no futuro, mostrar padrões com gentileza. */
export async function logCare(userId: string, careId: string, at: number, source: 'app' | 'notificacao') {
  if (!supabase) return
  await supabase.from('care_logs').insert({ user_id: userId, care_id: careId, done_at: new Date(at).toISOString(), source })
}
