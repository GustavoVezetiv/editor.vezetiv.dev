import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../../supabase/migrations/20260920202904_secure_auth_and_class_management.sql', import.meta.url), 'utf8')

test('migração restringe códigos, ranking e RPCs administrativas', () => {
  assert.match(sql, /create table private\.student_access_codes/i)
  assert.match(sql, /revoke all on private\.student_access_codes from public, anon, authenticated/i)
  assert.match(sql, /create or replace function public\.get_activity_ranking/i)
  assert.match(sql, /where r\.position <= 5 or r\.student_id = me\.student_id/i)
  assert.match(sql, /revoke all on function public\.get_current_actor\(\).*from public, anon/i)
})

test('migração separa leitura por ator e deixa eventos append-only', () => {
  assert.match(sql, /actor reads allowed attempts/i)
  assert.match(sql, /student_id = private\.current_student_id\(\)/i)
  assert.match(sql, /private\.teacher_owns_class\(s\.class_id\)/i)
  assert.match(sql, /grant select, insert on public\.verification_runs, public\.activity_events/i)
  assert.doesNotMatch(sql, /grant select, insert, update on public\.verification_runs/i)
})
