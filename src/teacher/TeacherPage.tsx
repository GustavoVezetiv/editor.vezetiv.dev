import { useMemo, useState } from "react";
import type { Activity } from "../types/activity";
import type {
  ActivityAttempt,
  ClassActivity,
  StudentAccessProvision,
  TeacherDashboard,
} from "../types/platform";
import type { PedagogicalEvent } from "../events/pedagogicalEvents";
import { ActivityBuilder } from "./ActivityBuilder";
import { ReadOnlyDocument } from "./ReadOnlyDocument";
import { bestAttemptScore, bestVerificationRun } from "../activity/attemptScoring";

interface TeacherPageProps {
  dashboard: TeacherDashboard;
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onCreateClass: (name: string, code: string) => Promise<void>;
  onAddStudent: (
    classId: string,
    displayName: string,
    code?: string,
  ) => Promise<StudentAccessProvision>;
  onResetStudent: (studentId: string) => Promise<string>;
  onCreateActivity: (activity: Activity, classId: string) => Promise<void>;
  onUpdateActivity: (activity: Activity) => Promise<void>;
  onArchiveActivity: (activityId: string) => Promise<void>;
  onSetClassActivity: (
    classId: string,
    activityId: string,
    patch: Pick<
      ClassActivity,
      "isFeatured" | "availableFrom" | "availableUntil"
    >,
  ) => Promise<void>;
  onSignOut: () => void;
}

const formatTools: Record<string, string> = {
  bold: "negrito",
  italic: "itálico",
  underline: "sublinhado",
  orderedList: "lista numerada",
  bulletList: "lista com marcadores",
  alignment: "alinhamento",
  heading: "título",
  fontSize: "tamanho da fonte",
};
const eventLabel = (event: PedagogicalEvent) => {
  const labels: Record<PedagogicalEvent["type"], string> = {
    activity_started: "Iniciou a atividade",
    paste_blocked: "Tentou colar conteúdo",
    document_created: "Criou um documento",
    document_renamed: "Renomeou um documento",
    document_deleted: "Excluiu um documento",
    format_applied: `Aplicou ${formatTools[String(event.metadata.tool)] ?? String(event.metadata.tool ?? "formatação")}`,
    hint_opened: `Abriu a dica “${String(event.metadata.title ?? "Como fazer?")}”`,
    verification_requested: "Solicitou verificação",
    verification_completed: `Concluiu verificação (${String(event.metadata.score ?? 0)} pontos)`,
    requirement_passed: `Concluiu “${String(event.metadata.label ?? "requisito")}”`,
    activity_completed: "Concluiu a atividade",
    preset_changed: "Alterou o padrão do documento",
  };
  return labels[event.type];
};
const toLocalInput = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";
const toIso = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

export function TeacherPage(props: TeacherPageProps) {
  const { dashboard, selectedClassId } = props;
  const [selectedId, setSelectedId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ActivityAttempt["status"]>(
    "all",
  );
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [message, setMessage] = useState("");
  const selected =
    dashboard.attempts.find((attempt) => attempt.id === selectedId) ??
    dashboard.attempts[0];
  const student =
    selected &&
    dashboard.students.find((item) => item.id === selected.studentId);
  const activity =
    selected &&
    dashboard.activities.find((item) => item.id === selected.activityId);
  const activeDocument =
    selected?.documents.find((item) => item.id === documentId) ??
    selected?.documents.find((item) => item.id === selected.activeDocumentId) ??
    selected?.documents[0];
  const attempts = useMemo(
    () =>
      dashboard.attempts.filter((attempt) => {
        const name =
          dashboard.students.find((item) => item.id === attempt.studentId)
            ?.displayName ?? "";
        const title =
          dashboard.activities.find((item) => item.id === attempt.activityId)
            ?.title ?? "";
        return (
          (status === "all" || attempt.status === status) &&
          `${name} ${title}`
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR"))
        );
      }),
    [dashboard, query, status],
  );
  const stats = [
    { label: "Alunos da turma", value: dashboard.students.length },
    { label: "Atividades", value: dashboard.activities.length },
    { label: "Média de pontuação", value: dashboard.averageScore },
    { label: "Concluídas", value: dashboard.completedAttempts },
  ];
  const run = async (action: () => Promise<void>, success: string) => {
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir a operação.",
      );
    }
  };
  return (
    <main className="teacher-page">
      <header className="home-header">
        <div className="brand">
          <span className="brand-mark">V</span>Painel docente
        </div>
        <button className="link-button" onClick={props.onSignOut}>
          Sair
        </button>
      </header>
      <section className="teacher-content">
        <div className="teacher-title">
          <div>
            <h1>Acompanhamento de aprendizagem</h1>
            <p className="teacher-intro">
              Acesse somente suas turmas, atribuições e tentativas dos seus
              alunos.
            </p>
          </div>
          <label>
            Turma
            <select
              value={selectedClassId}
              onChange={(event) => props.onSelectClass(event.target.value)}
            >
              {dashboard.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message ? (
          <p className="builder-message" role="status">
            {message}
          </p>
        ) : null}
        <details className="management-panel">
          <summary>Gerenciar turmas e alunos</summary>
          <div className="management-grid">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await props.onCreateClass(className, classCode);
                  setClassName("");
                  setClassCode("");
                }, "Turma criada.");
              }}
            >
              <h3>Nova turma</h3>
              <input
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="Nome da turma"
                required
              />
              <input
                value={classCode}
                onChange={(event) =>
                  setClassCode(event.target.value.toUpperCase())
                }
                placeholder="Código público"
                required
              />
              <button className="primary-button">Criar turma</button>
            </form>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const provision = await props.onAddStudent(
                    selectedClassId,
                    studentName,
                    studentCode || undefined,
                  );
                  setIssuedCode(provision.accessCode);
                  setStudentName("");
                  setStudentCode("");
                }, "Aluno adicionado. Copie o código exibido agora.");
              }}
            >
              <h3>Novo aluno</h3>
              <input
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                placeholder="Nome do aluno"
                required
              />
              <input
                value={studentCode}
                onChange={(event) =>
                  setStudentCode(event.target.value.toUpperCase())
                }
                placeholder="Código opcional"
              />
              <button className="primary-button" disabled={!selectedClassId}>
                Adicionar aluno
              </button>
            </form>
          </div>
          {issuedCode ? (
            <p className="one-time-code">
              Código de acesso (exibido uma vez): <strong>{issuedCode}</strong>
            </p>
          ) : null}
          <div className="student-list">
            {dashboard.students.map((item) => (
              <div key={item.id}>
                <span>{item.displayName}</span>
                <button
                  className="link-button"
                  onClick={() =>
                    void run(async () => {
                      setIssuedCode(await props.onResetStudent(item.id));
                    }, "Novo código gerado. Copie-o agora.")
                  }
                >
                  Redefinir acesso
                </button>
              </div>
            ))}
          </div>
        </details>
        <div className="stats-grid">
          {stats.map((stat) => (
            <article key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </div>
        <section className="assignment-panel">
          <h2>Disponibilidade na turma</h2>
          {dashboard.activities.map((item) => {
            const assignment = dashboard.classActivities.find(
              (entry) =>
                entry.activityId === item.id &&
                entry.classId === selectedClassId,
            );
            if (!assignment) return null;
            return (
              <div className="assignment-row" key={assignment.id}>
                <strong>{item.title}</strong>
                <label>
                  <input
                    type="checkbox"
                    checked={assignment.isFeatured}
                    onChange={(event) =>
                      void props.onSetClassActivity(selectedClassId, item.id, {
                        ...assignment,
                        isFeatured: event.target.checked,
                      })
                    }
                  />{" "}
                  Destaque
                </label>
                <label>
                  De
                  <input
                    type="datetime-local"
                    value={toLocalInput(assignment.availableFrom)}
                    onChange={(event) =>
                      void props.onSetClassActivity(selectedClassId, item.id, {
                        ...assignment,
                        availableFrom: toIso(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Até
                  <input
                    type="datetime-local"
                    value={toLocalInput(assignment.availableUntil)}
                    onChange={(event) =>
                      void props.onSetClassActivity(selectedClassId, item.id, {
                        ...assignment,
                        availableUntil: toIso(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
            );
          })}
        </section>
        <div className="teacher-grid">
          <section>
            <h2>Tentativas</h2>
            <div className="teacher-filters">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar aluno ou atividade"
                aria-label="Buscar tentativas"
              />
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
                aria-label="Filtrar por status"
              >
                <option value="all">Todos os status</option>
                <option value="in-progress">Em andamento</option>
                <option value="completed">Concluídas</option>
              </select>
            </div>
            {attempts.length ? (
              attempts.map((attempt) => (
                <button
                  className={`attempt-row ${selected?.id === attempt.id ? "is-selected" : ""}`}
                  key={attempt.id}
                  onClick={() => { setSelectedId(attempt.id); setDocumentId("") }}
                >
                  <span>
                    {
                      dashboard.students.find(
                        (item) => item.id === attempt.studentId,
                      )?.displayName
                    }
                    <small>
                      {
                        dashboard.activities.find(
                          (item) => item.id === attempt.activityId,
                        )?.title
                      }{" "}
                      ·{" "}
                      {attempt.status === "completed"
                        ? "Concluída"
                        : "Em andamento"}
                    </small>
                  </span>
                  <strong>{bestAttemptScore(attempt)}</strong>
                </button>
              ))
            ) : (
              <p className="empty-state">Nenhuma tentativa encontrada.</p>
            )}
          </section>
          <section className="attempt-detail">
            <h2>Detalhe do aluno</h2>
            {selected && student && activity ? (
              <>
                <p>
                  <strong>{student.displayName}</strong>
                </p>
                <p>
                  {activity.title} ·{" "}
                  {selected.status === "completed"
                    ? "Concluída"
                    : "Em andamento"}{" "}
                  · {bestAttemptScore(selected)} pontos
                  {bestVerificationRun(selected) ? ` · melhor resultado em ${new Date(bestVerificationRun(selected)!.createdAt).toLocaleString("pt-BR")}` : ""}
                </p>
                <h3>Documento</h3>
                {selected.documents.length > 1 ? (
                  <select
                    value={activeDocument?.id ?? ""}
                    onChange={(event) => setDocumentId(event.target.value)}
                  >
                    {selected.documents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}{item.deletedAt ? " (Excluído)" : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
                {activeDocument?.deletedAt ? (
                  <p className="verification-pending">
                    Documento excluído pelo aluno; mantido somente para o histórico pedagógico.
                  </p>
                ) : null}
                <ReadOnlyDocument document={activeDocument} />
                <h3>Verificações</h3>
                {selected.verificationRuns.length ? (
                  selected.verificationRuns.map((run) => (
                    <p key={run.id}>
                      {new Date(run.createdAt).toLocaleString("pt-BR")} —{" "}
                      {run.score} pontos
                    </p>
                  ))
                ) : (
                  <p className="empty-state">Ainda não houve verificação.</p>
                )}
                <h3>Timeline pedagógica</h3>
                <ol className="event-timeline">
                  {selected.events
                    .slice(-12)
                    .reverse()
                    .map((event) => (
                      <li key={event.id}>
                        <strong>{eventLabel(event)}</strong>
                        <small>
                          {new Date(event.timestamp).toLocaleString("pt-BR")}
                        </small>
                      </li>
                    ))}
                </ol>
              </>
            ) : (
              <p className="empty-state">Selecione uma tentativa.</p>
            )}
          </section>
        </div>
        {selectedClassId ? (
          <ActivityBuilder
            key={selectedClassId}
            activities={dashboard.activities}
            classId={selectedClassId}
            onCreate={props.onCreateActivity}
            onUpdate={props.onUpdateActivity}
            onArchive={props.onArchiveActivity}
          />
        ) : null}
      </section>
    </main>
  );
}
