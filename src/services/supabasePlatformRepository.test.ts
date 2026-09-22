import assert from "node:assert/strict";
import test from "node:test";
import { attemptFromRows } from "./supabasePlatformRepository";

const attemptRow = {
  id: "attempt-1",
  student_id: "student-1",
  activity_id: "activity-1",
  started_at: "2026-01-01T08:00:00.000Z",
  current_score: 10,
  status: "in-progress",
  active_document_id: "document-active",
  updated_at: "2026-01-01T12:00:00.000Z",
};
const documents = [
  {
    id: "document-deleted",
    attempt_id: "attempt-1",
    name: "Antigo",
    content_json: { type: "doc" },
    preset: "normal",
    revision: 4,
    deleted_at: "2026-01-01T11:00:00.000Z",
    updated_at: "2026-01-01T11:00:00.000Z",
  },
  {
    id: "document-active",
    attempt_id: "attempt-1",
    name: "Atual",
    content_json: { type: "doc" },
    preset: "normal",
    revision: 2,
    deleted_at: null,
    updated_at: "2026-01-01T10:00:00.000Z",
  },
];

test("normaliza runs e events recebidos fora de ordem", () => {
  const attempt = attemptFromRows(
    attemptRow,
    documents,
    [
      { id: "run-2", attempt_id: "attempt-1", document_id: "document-active", score: 10, results_json: [], document_revision: 2, created_at: "2026-01-01T10:00:00.000Z" },
      { id: "run-1", attempt_id: "attempt-1", document_id: "document-active", score: 5, results_json: [], document_revision: 1, created_at: "2026-01-01T10:00:00.000Z" },
    ],
    [
      { id: "event-2", attempt_id: "attempt-1", document_id: "document-active", type: "verification_completed", metadata: {}, created_at: "2026-01-01T10:00:00.000Z" },
      { id: "event-1", attempt_id: "attempt-1", document_id: "document-active", type: "activity_started", metadata: {}, created_at: "2026-01-01T10:00:00.000Z" },
    ],
  );

  assert.deepEqual(attempt.verificationRuns.map((run) => run.id), ["run-1", "run-2"]);
  assert.deepEqual(attempt.events.map((event) => event.id), ["event-1", "event-2"]);
  assert.equal(attempt.verificationRuns[1].documentRevision, 2);
});

test("oculta soft deleted do aluno e o mantém no histórico docente", () => {
  const student = attemptFromRows(attemptRow, documents, [], []);
  const teacher = attemptFromRows(attemptRow, documents, [], [], true);
  assert.deepEqual(student.documents.map((document) => document.id), ["document-active"]);
  assert.equal(teacher.documents.length, 2);
  assert.ok(teacher.documents.find((document) => document.id === "document-deleted")?.deletedAt);

  const repaired = attemptFromRows(
    { ...attemptRow, active_document_id: "document-deleted" },
    documents,
    [],
    [],
    true,
  );
  assert.equal(repaired.activeDocumentId, "document-active");
});
