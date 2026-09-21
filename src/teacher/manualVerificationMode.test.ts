import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('builder não oferece modo live e compatibilidade remota normaliza para manual', () => {
  const builder = readFileSync(new URL('./ActivityBuilder.tsx', import.meta.url), 'utf8')
  const remote = readFileSync(new URL('../services/supabasePlatformRepository.ts', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../verification/VerificationPanel.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(builder, /value=["']live["']/)
  assert.doesNotMatch(builder, /Ao vivo/i)
  assert.doesNotMatch(panel, /Atualizado automaticamente/i)
  assert.match(remote, /verificationMode:\s*["']manual["']/)
})
