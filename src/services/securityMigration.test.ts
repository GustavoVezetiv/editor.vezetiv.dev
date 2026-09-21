import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../../supabase/migrations/20260920202904_secure_auth_and_class_management.sql', import.meta.url), 'utf8')
const integritySql = readFileSync(new URL('../../supabase/migrations/20260921035336_authoritative_verification_and_teacher_profiles.sql', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../../supabase/functions/verify-document/index.ts', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../activity/ActivityWorkspace.tsx', import.meta.url), 'utf8')
const repository = readFileSync(new URL('./supabasePlatformRepository.ts', import.meta.url), 'utf8')

test('migração restringe códigos, ranking e RPCs administrativas', () => {
  assert.match(sql, /create table private\.student_access_codes/i)
  assert.match(sql, /revoke all on private\.student_access_codes from public, anon, authenticated/i)
  assert.match(sql, /create or replace function public\.get_activity_ranking/i)
  assert.match(sql, /where r\.position <= 5 or r\.student_id = me\.student_id/i)
  assert.match(sql, /revoke all on function public\.get_current_actor\(\).*from public, anon/i)
})

test('score e conclusão oficiais não aceitam escrita direta do aluno', () => {
  assert.match(integritySql, /revoke insert, update on public\.attempts from authenticated/i)
  assert.match(integritySql, /revoke insert, update, delete on public\.verification_runs from authenticated/i)
  assert.match(integritySql, /grant execute on function public\.record_official_verification\([^)]+\) to service_role/i)
  assert.match(integritySql, /create or replace function public\.complete_attempt/i)
  assert.match(integritySql, /create or replace function public\.start_attempt/i)
})

test('Edge Function deriva score do documento oficial e ignora payload de score', () => {
  assert.match(edge, /import \{ verifyActivity \} from ["']\.\.\/\.\.\/\.\.\/src\/verification\/verifyActivity\.ts["']/)
  assert.match(edge, /select\(\s*"id,attempt_id,content_json,preset",?\s*\)/)
  assert.match(edge, /verifyActivity\(\s*document\.content_json,\s*officialActivity,\s*document\.preset,?\s*\)/)
  assert.match(edge, /const score = results\.reduce/)
  assert.doesNotMatch(edge, /payload\.(score|results|content|activity)/)
})

test('preview local e verificação oficial permanecem fluxos separados', () => {
  assert.match(workspace, /setPreviewResults\(verifyActivity\(/)
  assert.match(repository, /functions\.invoke\(["']verify-document["']/)
  assert.match(repository, /body:\s*\{\s*attemptId:\s*attempt\.id,\s*documentId\s*\}/)
  assert.doesNotMatch(repository, /body:\s*\{[^}]*\b(score|results)\b/)
})

test('rebind e bootstrap docente são decisões explícitas da migration', () => {
  assert.match(sql, /update public\.students s set auth_user_id = v_uid where s\.id = v_student_id/i)
  assert.match(integritySql, /create table public\.teacher_profiles/i)
  assert.match(integritySql, /private\.is_provisioned_teacher/i)
})

test('migração separa leitura por ator e deixa eventos append-only', () => {
  assert.match(sql, /actor reads allowed attempts/i)
  assert.match(sql, /student_id = private\.current_student_id\(\)/i)
  assert.match(sql, /private\.teacher_owns_class\(s\.class_id\)/i)
  assert.match(sql, /grant select, insert on public\.verification_runs, public\.activity_events/i)
  assert.doesNotMatch(sql, /grant select, insert, update on public\.verification_runs/i)
})
