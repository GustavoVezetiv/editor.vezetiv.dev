import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)
export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null

// The local repository remains the development fallback. Remote synchronization is only enabled
// when both public Supabase variables are supplied; no secret/service-role key is used in the browser.
