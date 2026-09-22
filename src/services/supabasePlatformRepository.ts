import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, ActivityDocument } from "../types/activity";
import type {
  ActivityAttempt,
  AssignedActivity,
  ClassActivity,
  Classroom,
  RankedStudent,
  Student,
  StudentAccessProvision,
  TeacherDashboard,
  VerificationRun,
} from "../types/platform";
import type { PedagogicalEvent } from "../events/pedagogicalEvents";
import type { PlatformRepository, SavedAttempt } from "./platformRepository";
import { AttemptOperationQueue } from "./attemptOperationQueue";

const OUTBOX_KEY = "editor-vezetiv:supabase-outbox:v2";
const clone = <T>(value: T): T =>
  value === undefined || value === null
    ? value
    : (JSON.parse(JSON.stringify(value)) as T);
type Row = Record<string, unknown>;
type QueryLike = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

function activityFromRow(row: Row): Activity {
  const config = row.config as Activity & {
    isFeatured?: boolean;
    availableFrom?: string;
    availableUntil?: string;
  };
  const content = { ...config };
  delete content.isFeatured;
  delete content.availableFrom;
  delete content.availableUntil;
  return {
    ...content,
    verificationMode: "manual",
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    status: row.status as Activity["status"],
  };
}
const classroomFromRow = (row: Row): Classroom => ({
  id: String(row.id),
  name: String(row.name),
  code: String(row.code),
  createdAt: String(row.created_at),
});
const studentFromRow = (row: Row): Student => ({
  id: String(row.id),
  classId: String(row.class_id),
  code: row.code ? String(row.code) : undefined,
  displayName: String(row.display_name),
  createdAt: String(row.created_at),
});
const assignmentFromRow = (row: Row): ClassActivity => ({
  id: String(row.id),
  classId: String(row.class_id),
  activityId: String(row.activity_id),
  isFeatured: Boolean(row.is_featured),
  availableFrom: row.available_from ? String(row.available_from) : undefined,
  availableUntil: row.available_until ? String(row.available_until) : undefined,
  createdAt: String(row.created_at),
});
const documentFromRow = (row: Row): ActivityDocument => ({
  id: String(row.id),
  name: String(row.name),
  content: row.content_json as ActivityDocument["content"],
  preset: row.preset as ActivityDocument["preset"],
  revision: Number(row.revision ?? 0),
  deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
  updatedAt: String(row.updated_at),
});
const runFromRow = (row: Row): VerificationRun => ({
  id: String(row.id),
  attemptId: String(row.attempt_id),
  documentId: String(row.document_id),
  score: Number(row.score),
  results: row.results_json as VerificationRun["results"],
  documentRevision: Number(row.document_revision ?? 0),
  createdAt: String(row.created_at),
});
const eventFromRow = (
  row: Row,
  fallbackDocumentId: string,
  activityId: string,
): PedagogicalEvent => ({
  id: String(row.id),
  activityId,
  attemptId: String(row.attempt_id),
  documentId: String(row.document_id ?? fallbackDocumentId),
  type: row.type as PedagogicalEvent["type"],
  metadata: row.metadata as Record<string, unknown>,
  timestamp: String(row.created_at),
});
export function attemptFromRows(
  row: Row,
  documentRows: Row[],
  runRows: Row[],
  eventRows: Row[],
  includeDeletedDocuments = false,
): ActivityAttempt {
  const documents = documentRows
    .filter(
      (document) =>
        document.attempt_id === row.id &&
        (includeDeletedDocuments || !document.deleted_at),
    )
    .map(documentFromRow);
  const requestedActiveDocumentId = String(row.active_document_id ?? "");
  const activeDocumentId = documents.some(
    (document) =>
      document.id === requestedActiveDocumentId && !document.deletedAt,
  )
    ? requestedActiveDocumentId
    : (documents.find((document) => !document.deletedAt)?.id ??
      documents[0]?.id ??
      "");
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    activityId: String(row.activity_id),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    currentScore: Number(row.current_score),
    scoreReachedAt: row.score_reached_at
      ? String(row.score_reached_at)
      : undefined,
    status: row.status as ActivityAttempt["status"],
    documents,
    activeDocumentId,
    verificationRuns: runRows
      .filter((run) => run.attempt_id === row.id)
      .map(runFromRow)
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    events: eventRows
      .filter((event) => event.attempt_id === row.id)
      .map((event) =>
        eventFromRow(event, activeDocumentId, String(row.activity_id)),
      )
      .sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
      ),
    updatedAt: String(row.updated_at ?? row.completed_at ?? row.started_at),
  };
}

export class SupabasePlatformRepository implements PlatformRepository {
  readonly mode = "supabase" as const;
  private readonly mutations = new AttemptOperationQueue();
  constructor(
    private readonly client: SupabaseClient,
    private readonly storage: Storage = localStorage,
  ) {}
  private async rows(
    table: string,
    query: QueryLike = this.client.from(table).select("*"),
  ): Promise<Row[]> {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  }
  private readOutbox(): ActivityAttempt[] {
    try {
      return JSON.parse(
        this.storage.getItem(OUTBOX_KEY) ?? "[]",
      ) as ActivityAttempt[];
    } catch {
      return [];
    }
  }
  private writeOutbox(attempts: ActivityAttempt[]): void {
    this.storage.setItem(OUTBOX_KEY, JSON.stringify(attempts));
  }
  private enqueue(attempt: ActivityAttempt): void {
    this.writeOutbox([
      ...this.readOutbox().filter((item) => item.id !== attempt.id),
      clone(attempt),
    ]);
  }
  private clearOutbox(attemptId: string): void {
    this.writeOutbox(
      this.readOutbox().filter((attempt) => attempt.id !== attemptId),
    );
  }

  async listAssignedActivities(student: Student): Promise<AssignedActivity[]> {
    const current = new Date().toISOString();
    const assignments = (
      await this.rows(
        "class_activities",
        this.client
          .from("class_activities")
          .select("*")
          .eq("class_id", student.classId),
      )
    ).filter(
      (row) =>
        (!row.available_from || String(row.available_from) <= current) &&
        (!row.available_until || String(row.available_until) >= current),
    );
    if (!assignments.length) return [];
    const activities = await this.rows(
      "activities",
      this.client
        .from("activities")
        .select("*")
        .in(
          "id",
          assignments.map((row) => row.activity_id),
        )
        .eq("status", "published"),
    );
    const byId = new Map(
      activities.map((row) => [String(row.id), activityFromRow(row)]),
    );
    return assignments.flatMap((row) => {
      const activity = byId.get(String(row.activity_id));
      return activity ? [{ activity, assignment: assignmentFromRow(row) }] : [];
    });
  }
  async getActivity(activityId: string): Promise<Activity | undefined> {
    const { data, error } = await this.client
      .from("activities")
      .select("*")
      .eq("id", activityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? activityFromRow(data as Row) : undefined;
  }
  async join(classCode: string, accessCode: string): Promise<Student> {
    const { data, error } = await this.client.rpc("join_student", {
      p_class_code: classCode.trim().toUpperCase(),
      p_access_code: accessCode.trim().toUpperCase(),
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Código de turma ou acesso inválido.");
    return studentFromRow(row as Row);
  }
  async getStudent(studentId: string): Promise<Student | undefined> {
    const { data, error } = await this.client
      .from("students")
      .select("id,class_id,code,display_name,created_at")
      .eq("id", studentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? studentFromRow(data as Row) : undefined;
  }
  private async loadAttempts(
    query: QueryLike,
    includeDeletedDocuments = false,
  ): Promise<ActivityAttempt[]> {
    const attempts = await this.rows("attempts", query);
    if (!attempts.length) return [];
    const ids = attempts.map((row) => row.id);
    const [documents, runs, events] = await Promise.all([
      this.rows(
        "documents",
        this.client
          .from("documents")
          .select("*")
          .in("attempt_id", ids)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
      this.rows(
        "verification_runs",
        this.client
          .from("verification_runs")
          .select("*")
          .in("attempt_id", ids)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
      this.rows(
        "activity_events",
        this.client
          .from("activity_events")
          .select("*")
          .in("attempt_id", ids)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
    ]);
    return attempts.map((attempt) =>
      attemptFromRows(
        attempt,
        documents,
        runs,
        events,
        includeDeletedDocuments,
      ),
    );
  }
  async listStudentAttempts(studentId: string): Promise<ActivityAttempt[]> {
    return this.loadAttempts(
      this.client.from("attempts").select("*").eq("student_id", studentId),
    );
  }
  private async loadAttempt(row: Row): Promise<ActivityAttempt> {
    return (
      await this.loadAttempts(
        this.client.from("attempts").select("*").eq("id", row.id),
      )
    )[0];
  }
  async openAttempt(
    studentId: string,
    activity: Activity,
  ): Promise<ActivityAttempt> {
    void studentId;
    const { data, error } = await this.client.rpc("start_attempt", {
      p_activity_id: activity.id,
    });
    if (error) throw new Error(error.message);
    return this.loadAttempt({ id: String(data) });
  }
  private async dependenciesExist(attempt: ActivityAttempt): Promise<boolean> {
    const { data: student } = await this.client
      .from("students")
      .select("id,class_id")
      .eq("id", attempt.studentId)
      .maybeSingle();
    if (!student) return false;
    const [activity, assignment] = await Promise.all([
      this.client
        .from("activities")
        .select("id")
        .eq("id", attempt.activityId)
        .maybeSingle(),
      this.client
        .from("class_activities")
        .select("id")
        .eq("class_id", student.class_id)
        .eq("activity_id", attempt.activityId)
        .maybeSingle(),
    ]);
    return Boolean(activity.data && assignment.data);
  }
  private async persistAttempt(attempt: ActivityAttempt): Promise<void> {
    if (!(await this.dependenciesExist(attempt)))
      throw new Error("DEPENDENCY_MISSING");
    const { data: existing } = await this.client
      .from("attempts")
      .select("status")
      .eq("id", attempt.id)
      .maybeSingle();
    if (existing?.status === "completed") return;
    // Revisions and timestamps are assigned by save_document. The browser
    // never writes revision/deleted_at directly.
    for (const document of attempt.documents.filter(
      (item) => !item.deletedAt,
    )) {
      const savedDocument = await this.client.rpc("save_document", {
        p_attempt_id: attempt.id,
        p_document_id: document.id,
        p_name: document.name,
        p_content_json: document.content,
        p_preset: document.preset,
      });
      if (savedDocument.error) throw new Error(savedDocument.error.message);
    }
    const clientEvents = attempt.events.filter(
      (event) =>
        ![
          "activity_started",
          "verification_requested",
          "verification_completed",
          "requirement_passed",
          "activity_completed",
          "document_deleted",
        ].includes(event.type),
    );
    if (clientEvents.length) {
      const events = await this.client.from("activity_events").upsert(
        clientEvents.map((event) => ({
          id: event.id,
          attempt_id: event.attemptId,
          document_id: event.documentId,
          type: event.type,
          metadata: event.metadata,
          created_at: event.timestamp,
        })),
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (events.error) throw new Error(events.error.message);
    }
    const savedAttempt = await this.client.rpc("save_attempt_state", {
      p_attempt_id: attempt.id,
      p_active_document_id: attempt.activeDocumentId,
    });
    if (savedAttempt.error) throw new Error(savedAttempt.error.message);
  }
  async saveAttempt(attempt: ActivityAttempt): Promise<SavedAttempt> {
    return this.mutations.run(attempt.id, async () => {
      try {
        await this.persistAttempt(attempt);
        this.clearOutbox(attempt.id);
        return {
          attempt: await this.loadAttempt({ id: attempt.id }),
          remoteState: "synced",
        };
      } catch (error) {
        if (error instanceof Error && error.message === "DEPENDENCY_MISSING")
          return { attempt, remoteState: "blocked" };
        this.enqueue(attempt);
        return { attempt, remoteState: "retrying" };
      }
    });
  }
  async verifyDocument(
    attempt: ActivityAttempt,
    _activity: Activity,
    documentId: string,
  ): Promise<SavedAttempt> {
    return this.mutations.run(attempt.id, async () => {
      await this.persistAttempt(attempt);
      this.clearOutbox(attempt.id);
      const { error } = await this.client.functions.invoke("verify-document", {
        body: { attemptId: attempt.id, documentId },
      });
      if (error) throw new Error(error.message);
      return {
        attempt: await this.loadAttempt({ id: attempt.id }),
        remoteState: "synced",
      };
    });
  }
  async deleteDocument(
    attempt: ActivityAttempt,
    documentId: string,
  ): Promise<SavedAttempt> {
    return this.mutations.run(attempt.id, async () => {
      await this.persistAttempt(attempt);
      this.clearOutbox(attempt.id);
      const { error } = await this.client.rpc("delete_document", {
        p_document_id: documentId,
      });
      if (error) throw new Error(error.message);
      return {
        attempt: await this.loadAttempt({ id: attempt.id }),
        remoteState: "synced",
      };
    });
  }
  async completeAttempt(attempt: ActivityAttempt): Promise<SavedAttempt> {
    return this.mutations.run(attempt.id, async () => {
      await this.persistAttempt(attempt);
      this.clearOutbox(attempt.id);
      const { error } = await this.client.rpc("complete_attempt", {
        p_attempt_id: attempt.id,
        p_document_id: attempt.activeDocumentId,
      });
      if (error) throw new Error(error.message);
      return {
        attempt: await this.loadAttempt({ id: attempt.id }),
        remoteState: "synced",
      };
    });
  }
  async retryPending(): Promise<number> {
    const pending = this.readOutbox();
    let synced = 0;
    for (const attempt of pending.slice(0, 10)) {
      try {
        await this.mutations.run(attempt.id, () =>
          this.persistAttempt(attempt),
        );
        this.clearOutbox(attempt.id);
        synced += 1;
      } catch {
        break;
      }
    }
    return synced;
  }
  async createClass(name: string, code: string): Promise<Classroom> {
    const { data, error } = await this.client.rpc("create_class_for_teacher", {
      p_name: name,
      p_code: code,
    });
    if (error) throw new Error(error.message);
    return classroomFromRow((Array.isArray(data) ? data[0] : data) as Row);
  }
  async addStudent(
    classId: string,
    displayName: string,
    code?: string,
  ): Promise<StudentAccessProvision> {
    const { data, error } = await this.client.rpc("add_student_to_class", {
      p_class_id: classId,
      p_display_name: displayName,
      p_code: code || null,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as Row;
    return {
      student: studentFromRow(row),
      accessCode: String(row.access_code),
    };
  }
  async resetStudentAccess(studentId: string): Promise<string> {
    const { data, error } = await this.client.rpc("reset_student_access", {
      p_student_id: studentId,
    });
    if (error) throw new Error(error.message);
    return String(data);
  }
  async createActivity(activity: Activity, classId: string): Promise<Activity> {
    const { data, error } = await this.client.rpc("create_activity_for_class", {
      p_class_id: classId,
      p_activity: activity,
    });
    if (error) throw new Error(error.message);
    return activityFromRow(data as Row);
  }
  async updateActivity(activity: Activity): Promise<Activity> {
    const { data, error } = await this.client.rpc(
      "update_activity_for_teacher",
      { p_activity: activity },
    );
    if (error) throw new Error(error.message);
    return activityFromRow(data as Row);
  }
  async archiveActivity(activityId: string): Promise<void> {
    const { error } = await this.client.rpc("archive_activity_for_teacher", {
      p_activity_id: activityId,
    });
    if (error) throw new Error(error.message);
  }
  async setClassActivity(
    classId: string,
    activityId: string,
    patch: Pick<
      ClassActivity,
      "isFeatured" | "availableFrom" | "availableUntil"
    >,
  ): Promise<ClassActivity> {
    const { data, error } = await this.client.rpc("set_class_activity", {
      p_class_id: classId,
      p_activity_id: activityId,
      p_is_featured: patch.isFeatured,
      p_available_from: patch.availableFrom ?? null,
      p_available_until: patch.availableUntil ?? null,
    });
    if (error) throw new Error(error.message);
    return assignmentFromRow(data as Row);
  }
  async dashboard(classId?: string): Promise<TeacherDashboard> {
    const classes = (await this.rows("classes")).map(classroomFromRow);
    const selectedId = classId ?? classes[0]?.id;
    if (!selectedId)
      return {
        classes,
        students: [],
        activities: [],
        classActivities: [],
        attempts: [],
        averageScore: 0,
        completedAttempts: 0,
      };
    const [students, assignments] = await Promise.all([
      this.rows(
        "students",
        this.client
          .from("students")
          .select("id,class_id,code,display_name,created_at")
          .eq("class_id", selectedId),
      ),
      this.rows(
        "class_activities",
        this.client
          .from("class_activities")
          .select("*")
          .eq("class_id", selectedId),
      ),
    ]);
    const studentIds = students.map((row) => row.id);
    const attempts = studentIds.length
      ? await this.loadAttempts(
          this.client.from("attempts").select("*").in("student_id", studentIds),
          true,
        )
      : [];
    const activityIds = assignments.map((row) => row.activity_id);
    const activities = activityIds.length
      ? (
          await this.rows(
            "activities",
            this.client.from("activities").select("*").in("id", activityIds),
          )
        ).map(activityFromRow)
      : [];
    return {
      classes,
      students: students.map(studentFromRow),
      activities,
      classActivities: assignments.map(assignmentFromRow),
      attempts,
      averageScore: attempts.length
        ? Math.round(
            attempts.reduce((sum, attempt) => sum + attempt.currentScore, 0) /
              attempts.length,
          )
        : 0,
      completedAttempts: attempts.filter(
        (attempt) => attempt.status === "completed",
      ).length,
    };
  }
  async ranking(
    _classId: string,
    activityId: string,
  ): Promise<RankedStudent[]> {
    const { data, error } = await this.client.rpc("get_activity_ranking", {
      p_activity_id: activityId,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map((row) => ({
      displayName: String(row.display_name),
      score: Number(row.score),
      reachedScoreAt: String(row.reached_score_at),
      position: Number(row.position),
      isCurrentStudent: Boolean(row.is_current_student),
    }));
  }
}
