import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import type {
  Activity,
  ActivityDocument,
  DocumentPreset,
  EditorTool,
} from "../types/activity";
import type { ActivityAttempt, Student } from "../types/platform";
import { ActivityPanel } from "./ActivityPanel";
import { DocumentTabs } from "../documents/DocumentTabs";
import { DocumentEditor } from "../editor/DocumentEditor";
import { exportDocument, type ExportFormat } from "../export/documentExport";
import {
  createPedagogicalEvent,
  logPedagogicalEvent,
  type PedagogicalEventType,
} from "../events/pedagogicalEvents";
import { verifyActivity, type CheckResult } from "../verification/verifyActivity";
import type {
  RemoteSaveState,
  SavedAttempt,
} from "../services/platformRepository";
import { canEditAttempt, isDocumentDirty } from "./attemptState";
import { completionScore } from "./attemptScoring";

interface ActivityWorkspaceProps {
  activity: Activity;
  student: Student;
  initialAttempt: ActivityAttempt;
  onSaveAttempt: (attempt: ActivityAttempt) => Promise<SavedAttempt>;
  onVerifyDocument: (attempt: ActivityAttempt, activity: Activity, documentId: string) => Promise<SavedAttempt>;
  onDeleteDocument: (attempt: ActivityAttempt, documentId: string) => Promise<SavedAttempt>;
  onCompleteAttempt: (attempt: ActivityAttempt) => Promise<SavedAttempt>;
  onBack: () => void;
}

const hasContent = (document: ActivityDocument) =>
  JSON.stringify(document.content).includes('"text"');

export function ActivityWorkspace({
  activity,
  student,
  initialAttempt,
  onSaveAttempt,
  onVerifyDocument,
  onDeleteDocument,
  onCompleteAttempt,
  onBack,
}: ActivityWorkspaceProps) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [pasteNotice, setPasteNotice] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [saveState, setSaveState] = useState<"saving" | RemoteSaveState>(
    "local",
  );
  const [highlightedTool, setHighlightedTool] = useState<EditorTool | null>(
    null,
  );
  const [completionOpen, setCompletionOpen] = useState(false);
  const [previewResults, setPreviewResults] = useState<CheckResult[] | null>(null);
  const [verificationState, setVerificationState] = useState<
    "idle" | "verifying" | "verified" | "verification-error"
  >(
    initialAttempt.verificationRuns.some(
      (run) => run.documentId === initialAttempt.activeDocumentId,
    )
      ? "verified"
      : "idle",
  );
  const [officialOperation, setOfficialOperation] = useState<
    "verifying" | "deleting" | "completing" | null
  >(null);
  const timer = useRef<number | null>(null);
  const attemptRef = useRef(attempt);
  const saveRevision = useRef(0);
  const activeDocuments = attempt.documents.filter(
    (document) => !document.deletedAt,
  );
  const activeDocument =
    activeDocuments.find(
      (document) => document.id === attempt.activeDocumentId,
    ) ?? activeDocuments[0];
  const latestRun = [...attempt.verificationRuns]
    .reverse()
    .find((run) => run.documentId === activeDocument.id);
  const readOnly = !canEditAttempt(attempt);

  const persist = useCallback(
    (next: ActivityAttempt, instant = false) => {
      attemptRef.current = next;
      setAttempt(next);
      if (timer.current) window.clearTimeout(timer.current);
      const revision = ++saveRevision.current;
      const save = async () => {
        setSaveState("saving");
        const saved = await onSaveAttempt(next);
        if (revision !== saveRevision.current) return;
        attemptRef.current = saved.attempt;
        setAttempt(saved.attempt);
        setSaveState(saved.remoteState);
      };
      if (instant) void save();
      else
        timer.current = window.setTimeout(() => {
          void save();
        }, 500);
    },
    [onSaveAttempt],
  );

  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        void onSaveAttempt(attemptRef.current);
      }
    },
    [onSaveAttempt],
  );

  const withEvent = useCallback(
    (
      next: ActivityAttempt,
      type: PedagogicalEventType,
      documentId: string,
      metadata: Record<string, unknown> = {},
    ) => {
      const latest = next.events.at(-1);
      if (
        type === "format_applied" &&
        latest?.type === type &&
        latest.documentId === documentId &&
        latest.metadata.tool === metadata.tool &&
        Date.now() - new Date(latest.timestamp).getTime() < 2_000
      )
        return next;
      const event = createPedagogicalEvent({
        activityId: activity.id,
        attemptId: next.id,
        documentId,
        type,
        metadata,
      });
      logPedagogicalEvent(event);
      return {
        ...next,
        events: [...next.events, event],
        updatedAt: event.timestamp,
      };
    },
    [activity.id],
  );

  const updateDocument = useCallback(
    (content: JSONContent) => {
      if (!canEditAttempt(attemptRef.current)) return;
      setPreviewResults(null);
      const next = {
        ...attemptRef.current,
        documents: attemptRef.current.documents.map((document) =>
          document.id === attemptRef.current.activeDocumentId
            ? {
                ...document,
                content,
                revision: document.revision + 1,
                updatedAt: new Date().toISOString(),
              }
            : document,
        ),
      };
      persist(next);
    },
    [persist],
  );

  const recordFormat = useCallback(
    (tool: EditorTool) => {
      const next = withEvent(
        attemptRef.current,
        "format_applied",
        attemptRef.current.activeDocumentId,
        { tool },
      );
      persist(next);
    },
    [persist, withEvent],
  );

  const verify = useCallback(() => {
    if (officialOperation) return;
    const current = attemptRef.current;
    const document = current.documents.find(
      (item) => item.id === current.activeDocumentId,
    )!;
    setPreviewResults(verifyActivity(document.content, activity, document.preset));
    if (timer.current) window.clearTimeout(timer.current);
    const revision = ++saveRevision.current;
    setVerificationState("verifying");
    setOfficialOperation("verifying");
    void onVerifyDocument(current, activity, document.id)
      .then((saved) => {
        setVerificationState("verified");
        if (revision === saveRevision.current) {
          attemptRef.current = saved.attempt;
          setAttempt(saved.attempt);
          setPreviewResults(null);
          setSaveState(saved.remoteState);
        }
      })
      .catch(() => {
        setVerificationState("verification-error");
      })
      .finally(() => setOfficialOperation(null));
  }, [activity, officialOperation, onVerifyDocument]);

  const selectDocument = (documentId: string) => {
    setPreviewResults(null);
    setVerificationState(
      attemptRef.current.verificationRuns.some(
        (run) => run.documentId === documentId,
      )
        ? "verified"
        : "idle",
    );
    persist({ ...attemptRef.current, activeDocumentId: documentId });
  };
  const createDocument = () => {
    const timestamp = new Date().toISOString();
    const document: ActivityDocument = {
      id: `document-${crypto.randomUUID()}`,
      name: `Documento ${attemptRef.current.documents.length + 1}`,
      content: activity.initialContent,
      preset: activity.defaultDocumentPreset,
      revision: 0,
      updatedAt: timestamp,
    };
    setPreviewResults(null);
    setVerificationState("idle");
    persist(
      withEvent(
        {
          ...attemptRef.current,
          documents: [...attemptRef.current.documents, document],
          activeDocumentId: document.id,
        },
        "document_created",
        document.id,
      ),
      true,
    );
  };
  const renameDocument = (documentId: string) => {
    const old = attemptRef.current.documents.find(
      (document) => document.id === documentId,
    );
    const name = old && window.prompt("Nome do documento:", old.name)?.trim();
    if (!old || !name || name === old.name) return;
    persist(
      withEvent(
        {
          ...attemptRef.current,
          documents: attemptRef.current.documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  name,
                  revision: document.revision + 1,
                  updatedAt: new Date().toISOString(),
                }
              : document,
          ),
        },
        "document_renamed",
        documentId,
        { name },
      ),
      true,
    );
  };
  const closeDocument = (documentId: string) => {
    const current = attemptRef.current;
    const currentDocuments = current.documents.filter(
      (item) => !item.deletedAt,
    );
    if (currentDocuments.length === 1 || officialOperation) return;
    const document = current.documents.find((item) => item.id === documentId);
    if (
      !document ||
      (hasContent(document) &&
        !window.confirm(
          `Excluir “${document.name}”? Esta ação não pode ser desfeita.`,
        ))
    )
      return;
    if (timer.current) window.clearTimeout(timer.current);
    const revision = ++saveRevision.current;
    const fallback = currentDocuments.find((item) => item.id !== documentId)!;
    const requested = withEvent(
      {
        ...current,
        activeDocumentId:
          current.activeDocumentId === documentId
            ? fallback.id
            : current.activeDocumentId,
      },
      "document_deleted",
      documentId,
    );
    setOfficialOperation("deleting");
    void onDeleteDocument(requested, documentId)
      .then((saved) => {
        if (revision !== saveRevision.current) return;
        attemptRef.current = saved.attempt;
        setAttempt(saved.attempt);
        setPreviewResults(null);
        setVerificationState(
          saved.attempt.verificationRuns.some(
            (run) => run.documentId === saved.attempt.activeDocumentId,
          )
            ? "verified"
            : "idle",
        );
        setSaveState(saved.remoteState);
      })
      .catch(() => setSaveState("retrying"))
      .finally(() => setOfficialOperation(null));
  };
  const setPreset = (preset: DocumentPreset) => {
    const next = {
      ...attemptRef.current,
      documents: attemptRef.current.documents.map((document) =>
        document.id === attemptRef.current.activeDocumentId
          ? {
              ...document,
              preset,
              revision: document.revision + 1,
              updatedAt: new Date().toISOString(),
            }
          : document,
      ),
    };
    persist(
      withEvent(next, "preset_changed", next.activeDocumentId, { preset }),
    );
  };
  const blockedPaste = () => {
    persist(
      withEvent(
        attemptRef.current,
        "paste_blocked",
        attemptRef.current.activeDocumentId,
      ),
    );
    setPasteNotice(true);
    window.setTimeout(() => setPasteNotice(false), 4200);
  };
  const openHint = (requirementId: string) => {
    const hint = activity.hints.find(
      (item) => item.requirementId === requirementId,
    );
    persist(
      withEvent(
        attemptRef.current,
        "hint_opened",
        attemptRef.current.activeDocumentId,
        { requirementId, title: hint?.title },
      ),
    );
  };
  const complete = () => {
    if (!officialOperation) setCompletionOpen(true);
  };
  const confirmCompletion = () => {
    if (officialOperation) return;
    setOfficialOperation("completing");
    void onCompleteAttempt(attemptRef.current)
      .then((saved) => {
        attemptRef.current = saved.attempt;
        setAttempt(saved.attempt);
        setSaveState(saved.remoteState);
        setCompletionOpen(false);
      })
      .catch(() => setSaveState("retrying"))
      .finally(() => setOfficialOperation(null));
  };
  const hintTool = (requirementId: string | null): EditorTool | null => {
    const requirement = activity.requirements.find(
      (item) => item.id === requirementId,
    );
    if (!requirement) return null;
    if (requirement.type === "heading") return "heading";
    if (requirement.type === "alignment") return "alignment";
    if (requirement.type === "text-mark") return requirement.mark;
    if (requirement.type === "ordered-list") return "orderedList";
    if (requirement.type === "bullet-list") return "bulletList";
    return null;
  };
  const exportActive = async (format: ExportFormat) => {
    setExporting(format);
    try {
      await exportDocument(
        activeDocument.content,
        format,
        activeDocument.name,
        activeDocument.preset,
      );
    } finally {
      setExporting(null);
    }
  };

  const results = previewResults ?? latestRun?.results ?? null;
  const pending =
    results?.filter((result) => !result.passed) ?? activity.requirements;
  const score = completionScore(attempt);
  const saveLabel =
    saveState === "saving"
      ? "Salvando…"
      : saveState === "synced"
        ? "Sincronizado"
        : saveState === "retrying"
          ? "Salvo localmente · sincronização pendente"
          : saveState === "blocked"
            ? "Dependência remota ausente"
            : "Salvo neste dispositivo";
  return (
    <main className="app-shell">
      <header className="app-header">
        <button className="link-button" onClick={onBack}>
          ← Atividades
        </button>
        <div className="header-activity">{activity.title}</div>
        <div
          className={`save-status ${saveState === "saving" ? "saving" : saveState === "retrying" || saveState === "blocked" ? "failed" : ""}`}
        >
          {student.displayName} · {saveLabel}
        </div>
      </header>
      <div className="workbench">
        <ActivityPanel
          activity={activity}
          results={results}
          resultSource={previewResults ? "preview" : latestRun ? "official" : null}
          verificationState={verificationState}
          hasUnverifiedChanges={isDocumentDirty(activeDocument, latestRun)}
          onVerify={verify}
          onHintOpened={openHint}
          onHintChanged={(id) => setHighlightedTool(hintTool(id))}
          onComplete={complete}
          isCompleted={readOnly}
          officialOperationInProgress={officialOperation !== null}
        />
        <div className="editor-column">
          <DocumentTabs
            documents={activeDocuments}
            activeDocumentId={activeDocument.id}
            onSelect={selectDocument}
            onCreate={createDocument}
            onRename={renameDocument}
            onClose={closeDocument}
            onPresetChange={setPreset}
            onExport={exportActive}
            exportingFormat={exporting}
            readOnly={readOnly}
            operationsDisabled={officialOperation !== null}
          />
          <DocumentEditor
            key={activeDocument.id}
            initialContent={activeDocument.content}
            preset={activeDocument.preset}
            enabledTools={activity.enabledTools}
            pastePolicy={activity.pastePolicy}
            onDocumentChange={updateDocument}
            onBlockedInput={blockedPaste}
            onFormatApplied={recordFormat}
            highlightedTool={highlightedTool}
            readOnly={
              readOnly ||
              officialOperation === "deleting" ||
              officialOperation === "completing"
            }
          />
        </div>
      </div>
      {pasteNotice && (
        <div className="paste-notice" role="status">
          A colagem está desativada nesta atividade. Digite o conteúdo
          utilizando o editor.
        </div>
      )}
      {completionOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="completion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-title"
          >
            <h2 id="completion-title">Concluir atividade?</h2>
            <p>
              Melhor resultado da tentativa:{" "}
              <strong>
                {score} / {activity.scoring.totalPoints} pontos
              </strong>
              .
            </p>
            {!results && (
              <p className="verification-pending">
                Faça uma verificação antes de concluir para receber o
                diagnóstico completo.
              </p>
            )}
            {pending.length > 0 && (
              <>
                <h3>Pendências do documento “{activeDocument.name}”</h3>
                <ul>
                  {pending.map((result) => (
                    <li key={result.id}>{result.label}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="modal-actions">
              <button
                className="link-button"
                onClick={() => setCompletionOpen(false)}
              >
                Continuar editando
              </button>
              <button
                className="complete-button"
                onClick={confirmCompletion}
                disabled={officialOperation !== null}
              >
                Concluir mesmo assim
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
