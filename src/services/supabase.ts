import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AppMode = 'demo' | 'supabase'

export function resolveAppMode(environment: Record<string, string | undefined>): AppMode {
  const configured = Boolean(environment.VITE_SUPABASE_URL || environment.VITE_SUPABASE_ANON_KEY)
  const requested = environment.VITE_APP_MODE
  if (!requested && configured) throw new Error('Defina VITE_APP_MODE=supabase ou remova as variáveis Supabase. Não existe fallback silencioso para demo.')
  if (!requested || requested === 'demo') return 'demo'
  if (requested === 'supabase') {
    if (!environment.VITE_SUPABASE_URL || !environment.VITE_SUPABASE_ANON_KEY) throw new Error('O modo Supabase exige VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
    return 'supabase'
  }
  throw new Error(`VITE_APP_MODE inválido: ${requested}`)
}

const viteEnvironment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}
const environment = { VITE_APP_MODE: viteEnvironment.VITE_APP_MODE, VITE_SUPABASE_URL: viteEnvironment.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: viteEnvironment.VITE_SUPABASE_ANON_KEY }
export const appMode = resolveAppMode(environment)
export const supabase = appMode === 'supabase' ? createClient(environment.VITE_SUPABASE_URL!, environment.VITE_SUPABASE_ANON_KEY!) : null
export const requireSupabase = (): SupabaseClient => { if (!supabase) throw new Error('Supabase não está configurado.'); return supabase }
