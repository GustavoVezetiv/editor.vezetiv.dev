import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAppMode } from './supabase'

test('não faz fallback silencioso quando Supabase está configurado', () => {
  assert.throws(() => resolveAppMode({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public' }), /VITE_APP_MODE/)
  assert.equal(resolveAppMode({ VITE_APP_MODE: 'demo' }), 'demo')
  assert.equal(resolveAppMode({ VITE_APP_MODE: 'supabase', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public' }), 'supabase')
})
