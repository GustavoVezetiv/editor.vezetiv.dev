import assert from 'node:assert/strict'
import test from 'node:test'
import { activity01 } from '../config/activity01'
import { generateAccessCode, LocalPlatformRepository, localPlatformRepository } from './localPlatformRepository'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } })

test('cria tentativa, mantém identidade do aluno e calcula ranking local', () => {
  values.clear()
  const demo = localPlatformRepository.dashboard()
  assert.equal(demo.classes.length, 1)
  assert.equal(demo.students.length, 5)
  assert.equal(demo.activities.length, 3)
  const first = localPlatformRepository.join('DEMO', 'A01', 'Ana Silva')
  const same = localPlatformRepository.join('demo', 'a01', 'Outro nome')
  assert.equal(first.id, same.id)
  assert.equal(localPlatformRepository.listAssignedActivities(first).length, 3)
  const attempt = localPlatformRepository.openAttempt(first.id, activity01)
  assert.equal(attempt.status, 'in-progress')
  localPlatformRepository.saveAttempt({ ...attempt, currentScore: 80 })
  const ranking = localPlatformRepository.ranking(first.classId, activity01.id, first.id)
  const studentEntry = ranking.find((entry) => entry.isCurrentStudent)
  assert.equal(studentEntry?.score, 80)
  assert.ok(studentEntry?.position)
})

test('ranking usa a melhor tentativa e não duplica o aluno', () => {
  values.clear()
  const student = localPlatformRepository.join('DEMO', 'MULTI1', 'Aluno Múltiplo')
  const first = localPlatformRepository.openAttempt(student.id, activity01)
  localPlatformRepository.saveAttempt({ ...first, currentScore: 60, status: 'completed', completedAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' })
  const second = { ...first, id: 'attempt-second', status: 'in-progress' as const, startedAt: '2026-01-02T09:00:00.000Z', completedAt: undefined, updatedAt: '2026-01-02T09:00:00.000Z', verificationRuns: [], events: [] }
  localPlatformRepository.saveAttempt({ ...second, currentScore: 90, status: 'completed', completedAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-02T10:00:00.000Z' })
  const entries = localPlatformRepository.ranking(student.classId, activity01.id, student.id).filter((entry) => entry.isCurrentStudent)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].score, 90)
})

test('entrada rejeita turma desconhecida', () => {
  values.clear()
  assert.throws(() => localPlatformRepository.join('OUTRA', 'A01', 'Outra Turma'), /Turma não encontrada/)
})

test('desempata pelo momento em que o score foi alcançado', () => {
  values.clear()
  const ranking = localPlatformRepository.ranking('class-demo', activity01.id)
  const bruno = ranking.find((entry) => entry.displayName === 'Bruno Lima')
  const clara = ranking.find((entry) => entry.displayName === 'Clara Martins')
  assert.ok(bruno && clara)
  assert.equal(bruno.score, clara.score)
  assert.ok(bruno.position < clara.position)
})

test('join de produção não cria turma desconhecida', () => {
  const isolated = new Map<string, string>()
  const repository = new LocalPlatformRepository({ demoMode: false, storage: { getItem: (key) => isolated.get(key) ?? null, setItem: (key, value) => isolated.set(key, value) } })
  assert.throws(() => repository.join('INEXISTENTE', 'A01', 'Aluno'), /Turma não encontrada/)
})

test('código de acesso amigável possui aproximadamente 60 bits', () => {
  const codes = new Set(Array.from({ length: 100 }, generateAccessCode))
  assert.equal(codes.size, 100)
  for (const code of codes) assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}(?:-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}){2}$/)
})

test('soft delete oculta documento do aluno e preserva histórico docente', () => {
  const isolated = new Map<string, string>()
  const repository = new LocalPlatformRepository({ storage: { getItem: (key) => isolated.get(key) ?? null, setItem: (key, value) => isolated.set(key, value) } })
  const student = repository.join('DEMO', 'SOFT1', 'Aluno Soft Delete')
  const opened = repository.openAttempt(student.id, activity01)
  const second = {
    id: 'document-second',
    name: 'Documento 2',
    content: activity01.initialContent,
    preset: activity01.defaultDocumentPreset,
    revision: 0,
    updatedAt: opened.updatedAt,
  }
  const saved = repository.saveAttempt({ ...opened, documents: [...opened.documents, second], activeDocumentId: second.id })
  const verified = repository.verifyDocument(saved, activity01, second.id)
  assert.equal(
    verified.verificationRuns.at(-1)?.documentRevision,
    verified.documents.find((document) => document.id === second.id)?.revision,
  )
  const deleted = repository.deleteDocument(verified, second.id)

  assert.equal(deleted.documents.filter((document) => !document.deletedAt).length, 1)
  assert.ok(deleted.documents.find((document) => document.id === second.id)?.deletedAt)
  assert.ok(
    (deleted.documents.find((document) => document.id === second.id)?.revision ?? 0) >
      (verified.documents.find((document) => document.id === second.id)?.revision ?? 0),
  )
  assert.equal(deleted.verificationRuns.length, verified.verificationRuns.length)

  const reloaded = repository.openAttempt(student.id, activity01)
  assert.equal(reloaded.documents.some((document) => document.id === second.id), false)
  const teacherAttempt = repository.dashboard(student.classId).attempts.find((attempt) => attempt.id === opened.id)
  assert.ok(teacherAttempt?.documents.find((document) => document.id === second.id)?.deletedAt)
  assert.equal(teacherAttempt?.verificationRuns.length, verified.verificationRuns.length)
})

test('não permite excluir o único documento ativo', () => {
  const isolated = new Map<string, string>()
  const repository = new LocalPlatformRepository({ storage: { getItem: (key) => isolated.get(key) ?? null, setItem: (key, value) => isolated.set(key, value) } })
  const student = repository.join('DEMO', 'ONLY1', 'Aluno Documento Único')
  const attempt = repository.openAttempt(student.id, activity01)
  assert.throws(
    () => repository.deleteDocument(attempt, attempt.activeDocumentId),
    /pelo menos um documento/,
  )
})

test('dashboard demo isola atividades pela turma selecionada', () => {
  const isolated = new Map<string, string>()
  const repository = new LocalPlatformRepository({ storage: { getItem: (key) => isolated.get(key) ?? null, setItem: (key, value) => isolated.set(key, value) } })
  const classroom = repository.createClass('Turma B', 'TURMAB')
  const activity = { ...structuredClone(activity01), id: 'activity-turma-b', slug: 'atividade-turma-b', title: 'Atividade exclusiva B' }
  repository.createActivity(activity, classroom.id)

  assert.deepEqual(repository.dashboard(classroom.id).activities.map((item) => item.id), [activity.id])
  assert.equal(repository.dashboard('class-demo').activities.some((item) => item.id === activity.id), false)
})
