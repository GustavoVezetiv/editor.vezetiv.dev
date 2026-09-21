import { useState } from "react";
import { activity01 } from "../config/activity01";
import type {
  Activity,
  ActivityHint,
  ActivityRequirement,
  EditorTool,
} from "../types/activity";
import { ActivityPreview } from "./ActivityPreview";
import {
  changeRequirementType,
  createRequirement,
  duplicateActivity,
  prepareActivityForSave,
} from "./activityBuilderModel";

const allTools: Array<{ id: EditorTool; label: string }> = [
  { id: "undo", label: "Desfazer" },
  { id: "redo", label: "Refazer" },
  { id: "bold", label: "Negrito" },
  { id: "italic", label: "Itálico" },
  { id: "underline", label: "Sublinhado" },
  { id: "heading", label: "Títulos" },
  { id: "fontSize", label: "Tamanho" },
  { id: "alignment", label: "Alinhamento" },
  { id: "bulletList", label: "Marcadores" },
  { id: "orderedList", label: "Lista numerada" },
];
type CreatableRequirement = Exclude<ActivityRequirement["type"], "spelling">;

interface Props {
  activities: Activity[];
  classId: string;
  onCreate: (activity: Activity, classId: string) => Promise<void>;
  onUpdate: (activity: Activity) => Promise<void>;
  onArchive: (activityId: string) => Promise<void>;
}

export function ActivityBuilder({
  activities,
  classId,
  onCreate,
  onUpdate,
  onArchive,
}: Props) {
  const [draft, setDraft] = useState<Activity>(() =>
    duplicateActivity(activity01),
  );
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof Activity>(key: K, value: Activity[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const replaceRequirement = (
    index: number,
    requirement: ActivityRequirement,
  ) =>
    setDraft((current) => ({
      ...current,
      requirements: current.requirements.map((item, itemIndex) =>
        itemIndex === index ? requirement : item,
      ),
    }));
  const updateRequirement = (
    index: number,
    patch: Partial<ActivityRequirement>,
  ) =>
    setDraft((current) => ({
      ...current,
      requirements: current.requirements.map((requirement, itemIndex) =>
        itemIndex === index
          ? ({ ...requirement, ...patch } as ActivityRequirement)
          : requirement,
      ),
    }));
  const updateHint = (requirementId: string, patch: Partial<ActivityHint>) =>
    setDraft((current) => {
      const existing = current.hints.find(
        (hint) => hint.requirementId === requirementId,
      );
      return {
        ...current,
        hints: existing
          ? current.hints.map((hint) =>
              hint.requirementId === requirementId
                ? { ...hint, ...patch }
                : hint,
            )
          : [
              ...current.hints,
              {
                requirementId,
                title: "Como fazer?",
                steps: ["Descreva o primeiro passo."],
                ...patch,
              },
            ],
      };
    });
  const save = async () => {
    if (!draft.title.trim() || !classId || !draft.requirements.length) return;
    setSaving(true);
    setMessage("");
    try {
      if (editing) {
        await onUpdate({
          ...draft,
          scoring: {
            totalPoints: draft.requirements.reduce(
              (sum, requirement) => sum + requirement.points,
              0,
            ),
          },
        });
        setMessage("Atividade atualizada.");
      } else {
        await onCreate(prepareActivityForSave(draft), classId);
        setMessage("Atividade criada e atribuída à turma.");
      }
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  };
  const beginEdit = (activity: Activity) => {
    setDraft(structuredClone(activity));
    setEditing(true);
    setMessage(
      activity.status === "published"
        ? "Atenção: esta atividade já foi publicada. Requisitos ficam bloqueados após existirem tentativas."
        : "",
    );
  };
  return (
    <section className="creator-card">
      <h2>{editing ? "Editar atividade" : "Criador de atividades"}</h2>
      <p>
        Configure sem editar JSON. A prévia é isolada e não cria tentativa,
        ranking ou evento.
      </p>
      {message ? (
        <p className="builder-message" role="status">
          {message}
        </p>
      ) : null}
      <div className="builder-grid">
        <label>
          Status
          <select
            value={draft.status}
            onChange={(event) =>
              set("status", event.target.value as Activity["status"])
            }
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicada</option>
          </select>
        </label>
        <label className="builder-wide">
          Título
          <input
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
          />
        </label>
        <label className="builder-wide">
          Descrição
          <textarea
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </label>
        <label className="builder-wide">
          Instruções — uma por linha
          <textarea
            value={draft.instructions.join("\n")}
            onChange={(event) =>
              set(
                "instructions",
                event.target.value.split("\n").filter(Boolean),
              )
            }
          />
        </label>
        <label className="builder-wide">
          Texto fonte opcional
          <textarea
            value={draft.sourceText ?? ""}
            onChange={(event) =>
              set("sourceText", event.target.value || undefined)
            }
          />
        </label>
        <label>
          Colagem
          <select
            value={draft.pastePolicy}
            onChange={(event) =>
              set("pastePolicy", event.target.value as Activity["pastePolicy"])
            }
          >
            <option value="blocked">Bloqueada</option>
            <option value="allowed">Permitida</option>
          </select>
        </label>
        <label>
          Preset inicial
          <select
            value={draft.defaultDocumentPreset}
            onChange={(event) =>
              set(
                "defaultDocumentPreset",
                event.target.value as Activity["defaultDocumentPreset"],
              )
            }
          >
            <option value="academic-abnt">Acadêmico (ABNT)</option>
            <option value="normal">Normal</option>
          </select>
        </label>
        <label>
          Verificação
          <input value="Manual" readOnly />
        </label>
      </div>
      <fieldset className="tool-picker">
        <legend>Ferramentas disponíveis</legend>
        {allTools.map((tool) => (
          <label key={tool.id}>
            <input
              type="checkbox"
              checked={draft.enabledTools.includes(tool.id)}
              onChange={(event) =>
                set(
                  "enabledTools",
                  event.target.checked
                    ? [...draft.enabledTools, tool.id]
                    : draft.enabledTools.filter((item) => item !== tool.id),
                )
              }
            />
            {tool.label}
          </label>
        ))}
      </fieldset>
      <div className="requirement-builder">
        <div className="section-heading">
          <h3>Requisitos</h3>
          <button
            className="link-button"
            onClick={() =>
              set("requirements", [
                ...draft.requirements,
                createRequirement("text-content"),
              ])
            }
          >
            + Adicionar
          </button>
        </div>
        {draft.requirements.map((requirement, index) => {
          const hint = draft.hints.find(
            (item) => item.requirementId === requirement.id,
          );
          return (
            <article className="requirement-card" key={requirement.id}>
              <div className="builder-grid">
                <label>
                  Tipo
                  <select
                    value={requirement.type}
                    onChange={(event) =>
                      replaceRequirement(
                        index,
                        changeRequirementType(
                          requirement,
                          event.target.value as CreatableRequirement,
                        ),
                      )
                    }
                  >
                    <option value="text-content">Texto</option>
                    <option value="heading">Título</option>
                    <option value="alignment">Alinhamento</option>
                    <option value="text-mark">Formatação</option>
                    <option value="ordered-list">Lista numerada</option>
                    <option value="bullet-list">Marcadores</option>
                    <option value="document-preset">Preset</option>
                  </select>
                </label>
                <label>
                  Pontos
                  <input
                    type="number"
                    min="0"
                    value={requirement.points}
                    onChange={(event) =>
                      updateRequirement(index, {
                        points: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="builder-wide">
                  Nome exibido
                  <input
                    value={requirement.label}
                    onChange={(event) =>
                      updateRequirement(index, { label: event.target.value })
                    }
                  />
                </label>
                <label className="builder-wide">
                  Objetivo
                  <input
                    value={requirement.objective}
                    onChange={(event) =>
                      updateRequirement(index, {
                        objective: event.target.value,
                      })
                    }
                  />
                </label>
                {requirement.type === "heading" ||
                requirement.type === "text-content" ||
                requirement.type === "text-mark" ? (
                  <label className="builder-wide">
                    Texto
                    <input
                      value={requirement.text}
                      onChange={(event) =>
                        updateRequirement(index, { text: event.target.value })
                      }
                    />
                  </label>
                ) : null}
                {requirement.type === "heading" ? (
                  <label>
                    Nível
                    <select
                      value={requirement.level}
                      onChange={(event) =>
                        updateRequirement(index, {
                          level: Number(event.target.value) as 1 | 2,
                        })
                      }
                    >
                      <option value="1">Título 1</option>
                      <option value="2">Título 2</option>
                    </select>
                  </label>
                ) : null}
                {requirement.type === "alignment" ? (
                  <>
                    <label>
                      Texto alvo
                      <input
                        value={requirement.target}
                        onChange={(event) =>
                          updateRequirement(index, {
                            target: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Alinhamento
                      <select
                        value={requirement.value}
                        onChange={(event) =>
                          updateRequirement(index, {
                            value: event.target
                              .value as typeof requirement.value,
                          })
                        }
                      >
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                        <option value="justify">Justificado</option>
                      </select>
                    </label>
                  </>
                ) : null}
                {requirement.type === "text-mark" ? (
                  <label>
                    Marca
                    <select
                      value={requirement.mark}
                      onChange={(event) =>
                        updateRequirement(index, {
                          mark: event.target.value as typeof requirement.mark,
                        })
                      }
                    >
                      <option value="bold">Negrito</option>
                      <option value="italic">Itálico</option>
                      <option value="underline">Sublinhado</option>
                    </select>
                  </label>
                ) : null}
                {requirement.type === "text-content" ? (
                  <>
                    <label>
                      Comparação
                      <select
                        value={requirement.matchMode}
                        onChange={(event) =>
                          updateRequirement(index, {
                            matchMode: event.target
                              .value as typeof requirement.matchMode,
                          })
                        }
                      >
                        <option value="exact">Exata</option>
                        <option value="normalized">Normalizada</option>
                        <option value="similarity">Similaridade</option>
                      </select>
                    </label>
                    {requirement.matchMode === "similarity" ? (
                      <label>
                        Limite
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={requirement.similarityThreshold ?? 0.95}
                          onChange={(event) =>
                            updateRequirement(index, {
                              similarityThreshold: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
                {requirement.type === "ordered-list" ||
                requirement.type === "bullet-list" ? (
                  <label>
                    Itens mínimos
                    <input
                      type="number"
                      min="1"
                      value={requirement.minItems}
                      onChange={(event) =>
                        updateRequirement(index, {
                          minItems: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                ) : null}
                {requirement.type === "document-preset" ? (
                  <label>
                    Preset
                    <select
                      value={requirement.preset}
                      onChange={(event) =>
                        updateRequirement(index, {
                          preset: event.target
                            .value as typeof requirement.preset,
                        })
                      }
                    >
                      <option value="normal">Normal</option>
                      <option value="academic-abnt">Acadêmico</option>
                    </select>
                  </label>
                ) : null}
                <label className="builder-wide">
                  Título da dica
                  <input
                    value={hint?.title ?? ""}
                    onChange={(event) =>
                      updateHint(requirement.id, { title: event.target.value })
                    }
                  />
                </label>
                <label className="builder-wide">
                  Passos da dica — um por linha
                  <textarea
                    value={hint?.steps.join("\n") ?? ""}
                    onChange={(event) =>
                      updateHint(requirement.id, {
                        steps: event.target.value.split("\n").filter(Boolean),
                      })
                    }
                  />
                </label>
              </div>
              <button
                className="danger-link"
                onClick={() => {
                  set(
                    "requirements",
                    draft.requirements.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  );
                  set(
                    "hints",
                    draft.hints.filter(
                      (item) => item.requirementId !== requirement.id,
                    ),
                  );
                }}
              >
                Remover requisito
              </button>
            </article>
          );
        })}
      </div>
      <div className="builder-actions">
        {editing ? (
          <button
            className="link-button"
            onClick={() => {
              setDraft(duplicateActivity(activity01));
              setEditing(false);
              setMessage("");
            }}
          >
            Cancelar edição
          </button>
        ) : null}
        <button className="link-button" onClick={() => setPreview(true)}>
          Visualizar como aluno
        </button>
        <button
          className="primary-button"
          onClick={save}
          disabled={saving || !classId}
        >
          {saving
            ? "Salvando…"
            : editing
              ? "Salvar alterações"
              : "Salvar atividade"}
        </button>
      </div>
      <div className="activity-management">
        <h3>Atividades da turma e histórico</h3>
        {activities.map((activity) => (
          <div key={activity.id}>
            <span>
              {activity.title}{" "}
              <small>
                {activity.status === "published"
                  ? "Publicada"
                  : activity.status === "archived"
                    ? "Arquivada"
                    : "Rascunho"}
              </small>
            </span>
            <span>
              <button
                className="link-button"
                onClick={() => beginEdit(activity)}
              >
                Editar
              </button>
              <button
                className="link-button"
                onClick={() => {
                  setDraft(duplicateActivity(activity));
                  setEditing(false);
                }}
              >
                Duplicar
              </button>
              {activity.status !== "archived" ? (
                <button
                  className="danger-link"
                  onClick={() => void onArchive(activity.id)}
                >
                  Arquivar
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {preview ? (
        <ActivityPreview
          activity={{
            ...draft,
            scoring: {
              totalPoints: draft.requirements.reduce(
                (sum, requirement) => sum + requirement.points,
                0,
              ),
            },
          }}
          onClose={() => setPreview(false)}
        />
      ) : null}
    </section>
  );
}
