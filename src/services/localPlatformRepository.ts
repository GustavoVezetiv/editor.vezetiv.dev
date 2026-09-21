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
import {
  activity01,
  activity02,
  activity03,
  builtInActivities,
} from "../config/activity01";
import { createPedagogicalEvent } from "../events/pedagogicalEvents";
import { verifyActivity } from "../verification/verifyActivity";
import { calculateScore } from "../verification/scoring";
import { bestAttemptScore, bestVerificationRun, newlyPassedRequirementIds, scoreStateFromRuns } from "../activity/attemptScoring";

interface LocalPlatformState {
  seedVersion: number;
  classes: Classroom[];
  students: Student[];
  studentAccessCodes: Record<string, string>;
  attempts: ActivityAttempt[];
  activities: Activity[];
  classActivities: ClassActivity[];
}
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface LocalRepositoryOptions {
  demoMode?: boolean;
  storage?: StorageLike;
}

const KEY = "editor-vezetiv:platform:v3";
const now = () => new Date().toISOString();
const clone = <T>(value: T): T =>
  value === undefined || value === null
    ? value
    : (JSON.parse(JSON.stringify(value)) as T);
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const generateAccessCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = Array.from(bytes, (value) => alphabet[value & 31]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
};

function attemptBest(attempt: ActivityAttempt): {
  score: number;
  reachedAt: string;
} {
  const score = bestAttemptScore(attempt);
  const reachedAt =
    bestVerificationRun(attempt)?.createdAt ??
    attempt.scoreReachedAt ??
    attempt.completedAt ??
    attempt.updatedAt ??
    attempt.startedAt;
  return { score, reachedAt };
}

export function rankAttempts(
  attempts: ActivityAttempt[],
  students: Student[],
  classId: string,
  activityId: string,
  currentStudentId?: string,
): RankedStudent[] {
  const studentsById = new Map(
    students
      .filter((student) => student.classId === classId)
      .map((student) => [student.id, student]),
  );
  const bestByStudent = new Map<string, ActivityAttempt>();
  for (const attempt of attempts) {
    if (
      attempt.activityId !== activityId ||
      !studentsById.has(attempt.studentId)
    )
      continue;
    const current = bestByStudent.get(attempt.studentId);
    const nextBest = attemptBest(attempt);
    const currentBest = current ? attemptBest(current) : undefined;
    if (
      !current ||
      !currentBest ||
      nextBest.score > currentBest.score ||
      (nextBest.score === currentBest.score &&
        nextBest.reachedAt < currentBest.reachedAt)
    )
      bestByStudent.set(attempt.studentId, attempt);
  }
  return [...bestByStudent.values()]
    .map((attempt) => {
      const best = attemptBest(attempt);
      return {
        displayName: studentsById.get(attempt.studentId)!.displayName,
        score: best.score,
        reachedScoreAt: best.reachedAt,
        position: 0,
        isCurrentStudent: attempt.studentId === currentStudentId,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.reachedScoreAt.localeCompare(b.reachedScoreAt) ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

function createSeedState(): LocalPlatformState {
  const createdAt = now();
  const classroom: Classroom = {
    id: "class-demo",
    name: "Turma demonstração",
    code: "DEMO",
    createdAt,
  };
  const students: Student[] = [
    ["student-demo-ana", "ANA01", "Ana Souza"],
    ["student-demo-bruno", "BRU02", "Bruno Lima"],
    ["student-demo-clara", "CLA03", "Clara Martins"],
    ["student-demo-davi", "DAV04", "Davi Rocha"],
    ["student-demo-elisa", "ELI05", "Elisa Nunes"],
  ].map(([studentId, code, displayName], index) => ({
    id: studentId,
    classId: classroom.id,
    code,
    displayName,
    createdAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
  }));
  const classActivities: ClassActivity[] = builtInActivities.map(
    (activity, index) => ({
      id: `class-activity-demo-${index + 1}`,
      classId: classroom.id,
      activityId: activity.id,
      isFeatured: index === 0,
      createdAt,
    }),
  );
  const sampleAttempt = (
    student: Student,
    activity: Activity,
    score: number,
    status: ActivityAttempt["status"],
    hoursAgo: number,
  ): ActivityAttempt => {
    const timestamp = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
    const document: ActivityDocument = {
      id: `document-${student.id}-${activity.id}`,
      name: "Documento 1",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `Registro de ${student.displayName} para ${activity.title}.`,
              },
            ],
          },
        ],
      },
      preset: activity.defaultDocumentPreset,
      updatedAt: timestamp,
    };
    const attemptId = `attempt-${student.id}-${activity.id}`;
    const verificationRuns: VerificationRun[] = score
      ? [
          {
            id: `verification-${attemptId}`,
            attemptId,
            documentId: document.id,
            score,
            results: [],
            createdAt: timestamp,
          },
        ]
      : [];
    const events = [
      createPedagogicalEvent({
        activityId: activity.id,
        attemptId,
        documentId: document.id,
        type: "activity_started",
        metadata: {},
      }),
      createPedagogicalEvent({
        activityId: activity.id,
        attemptId,
        documentId: document.id,
        type: "verification_completed",
        metadata: { score },
      }),
    ].map((event) => ({ ...event, timestamp }));
    return {
      id: attemptId,
      studentId: student.id,
      activityId: activity.id,
      startedAt: timestamp,
      completedAt: status === "completed" ? timestamp : undefined,
      currentScore: score,
      scoreReachedAt: timestamp,
      status,
      documents: [document],
      activeDocumentId: document.id,
      verificationRuns,
      events,
      updatedAt: timestamp,
    };
  };
  return {
    seedVersion: 3,
    classes: [classroom],
    students,
    studentAccessCodes: Object.fromEntries(
      students.map((student) => [student.id, student.code!]),
    ),
    activities: [],
    classActivities,
    attempts: [
      sampleAttempt(students[0], activity01, 100, "completed", 30),
      sampleAttempt(students[1], activity01, 85, "completed", 25),
      sampleAttempt(students[2], activity01, 85, "in-progress", 20),
      sampleAttempt(students[3], activity02, 60, "in-progress", 18),
      sampleAttempt(students[4], activity03, 40, "in-progress", 12),
    ],
  };
}

export class LocalPlatformRepository {
  readonly mode = "demo" as const;
  readonly demoMode: boolean;
  private readonly storage: StorageLike;
  constructor(options: LocalRepositoryOptions = {}) {
    this.demoMode = options.demoMode ?? true;
    this.storage = options.storage ?? {
      getItem: (key) => globalThis.localStorage?.getItem(key) ?? null,
      setItem: (key, value) => globalThis.localStorage?.setItem(key, value),
    };
  }
  private loadState(): LocalPlatformState {
    try {
      const parsed = JSON.parse(
        this.storage.getItem(KEY) ?? "",
      ) as LocalPlatformState;
      if (
        Array.isArray(parsed.classes) &&
        Array.isArray(parsed.students) &&
        Array.isArray(parsed.attempts) &&
        Array.isArray(parsed.activities) &&
        Array.isArray(parsed.classActivities)
      )
        return parsed;
    } catch {
      /* seed below */
    }
    const state = createSeedState();
    this.saveState(state);
    return state;
  }
  private saveState(state: LocalPlatformState): void {
    this.storage.setItem(KEY, JSON.stringify(state));
  }
  private allActivities(state: LocalPlatformState): Activity[] {
    return [...builtInActivities, ...state.activities];
  }

  listAssignedActivities(student: Student): AssignedActivity[] {
    const state = this.loadState();
    const current = now();
    const activities = new Map(
      this.allActivities(state).map((activity) => [activity.id, activity]),
    );
    return clone(
      state.classActivities
        .filter(
          (assignment) =>
            assignment.classId === student.classId &&
            (!assignment.availableFrom ||
              assignment.availableFrom <= current) &&
            (!assignment.availableUntil ||
              assignment.availableUntil >= current),
        )
        .flatMap((assignment) => {
          const activity = activities.get(assignment.activityId);
          return activity?.status === "published"
            ? [{ activity, assignment }]
            : [];
        }),
    );
  }
  getActivity(activityId: string): Activity | undefined {
    return clone(
      this.allActivities(this.loadState()).find(
        (activity) => activity.id === activityId,
      ),
    );
  }
  join(classCode: string, accessCode: string, displayName = ""): Student {
    const state = this.loadState();
    const classroom = state.classes.find(
      (item) => item.code === classCode.trim().toUpperCase(),
    );
    if (!classroom) throw new Error("Turma não encontrada.");
    let student = state.students.find(
      (item) =>
        item.classId === classroom.id &&
        state.studentAccessCodes[item.id] === accessCode.trim().toUpperCase(),
    );
    if (!student && this.demoMode && displayName.trim()) {
      student = {
        id: id("student"),
        classId: classroom.id,
        code: accessCode.trim().toUpperCase(),
        displayName: displayName.trim(),
        createdAt: now(),
      };
      state.students.push(student);
      state.studentAccessCodes[student.id] = accessCode.trim().toUpperCase();
    }
    if (!student) throw new Error("Código de acesso inválido para esta turma.");
    this.saveState(state);
    return clone(student);
  }
  getStudent(studentId: string): Student | undefined {
    return clone(
      this.loadState().students.find((student) => student.id === studentId),
    );
  }
  listStudentAttempts(studentId: string): ActivityAttempt[] {
    return clone(
      this.loadState().attempts.filter(
        (attempt) => attempt.studentId === studentId,
      ),
    );
  }
  openAttempt(studentId: string, activity: Activity): ActivityAttempt {
    const state = this.loadState();
    const student = state.students.find((item) => item.id === studentId);
    if (
      !student ||
      !state.classActivities.some(
        (assignment) =>
          assignment.classId === student.classId &&
          assignment.activityId === activity.id,
      )
    )
      throw new Error("Atividade não atribuída a esta turma.");
    let attempt =
      state.attempts.find(
        (item) =>
          item.studentId === studentId &&
          item.activityId === activity.id &&
          item.status !== "completed",
      ) ??
      state.attempts
        .filter(
          (item) =>
            item.studentId === studentId && item.activityId === activity.id,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!attempt) {
      const timestamp = now();
      const document: ActivityDocument = {
        id: id("document"),
        name: "Documento 1",
        content: clone(activity.initialContent),
        preset: activity.defaultDocumentPreset,
        updatedAt: timestamp,
      };
      const attemptId = id("attempt");
      const startedEvent = createPedagogicalEvent({
        activityId: activity.id,
        attemptId,
        documentId: document.id,
        type: "activity_started",
        metadata: {},
      });
      attempt = {
        id: attemptId,
        studentId,
        activityId: activity.id,
        startedAt: timestamp,
        currentScore: 0,
        status: "in-progress",
        documents: [document],
        activeDocumentId: document.id,
        verificationRuns: [],
        events: [startedEvent],
        updatedAt: timestamp,
      };
      state.attempts.push(attempt);
      this.saveState(state);
    }
    return clone(attempt);
  }
  saveAttempt(nextAttempt: ActivityAttempt): ActivityAttempt {
    const state = this.loadState();
    const existing = state.attempts.find(
      (attempt) => attempt.id === nextAttempt.id,
    );
    if (
      existing?.status === "completed" &&
      JSON.stringify(existing) !== JSON.stringify(nextAttempt)
    )
      return clone(existing);
    const next = { ...nextAttempt, updatedAt: now() };
    const index = state.attempts.findIndex((attempt) => attempt.id === next.id);
    if (index >= 0) state.attempts[index] = clone(next);
    else state.attempts.push(clone(next));
    this.saveState(state);
    return clone(next);
  }
  verifyDocument(attempt: ActivityAttempt, activity: Activity, documentId: string): ActivityAttempt {
    const document = attempt.documents.find((item) => item.id === documentId)
    if (!document) throw new Error("Documento não encontrado.")
    const results = verifyActivity(document.content, activity, document.preset)
    const score = calculateScore(activity, results).earnedPoints
    const createdAt = now()
    const run: VerificationRun = { id: id("verification"), attemptId: attempt.id, documentId, score, results, createdAt }
    let next: ActivityAttempt = { ...attempt, ...scoreStateFromRuns([...attempt.verificationRuns, run]), verificationRuns: [...attempt.verificationRuns, run] }
    const events = [createPedagogicalEvent({ activityId: activity.id, attemptId: attempt.id, documentId, type: "verification_requested", metadata: {} }), createPedagogicalEvent({ activityId: activity.id, attemptId: attempt.id, documentId, type: "verification_completed", metadata: { score } })]
    for (const requirementId of newlyPassedRequirementIds(attempt, run)) { const requirement = activity.requirements.find((item) => item.id === requirementId); events.push(createPedagogicalEvent({ activityId: activity.id, attemptId: attempt.id, documentId, type: "requirement_passed", metadata: { requirementId, label: requirement?.label } })) }
    next = { ...next, events: [...next.events, ...events], updatedAt: createdAt }
    return this.saveAttempt(next)
  }
  completeAttempt(attempt: ActivityAttempt): ActivityAttempt {
    if (attempt.status === "completed") return attempt
    const completedAt = now()
    const event = createPedagogicalEvent({ activityId: attempt.activityId, attemptId: attempt.id, documentId: attempt.activeDocumentId, type: "activity_completed", metadata: {} })
    return this.saveAttempt({ ...attempt, status: "completed", completedAt, updatedAt: completedAt, events: [...attempt.events, event] })
  }
  createClass(name: string, code: string): Classroom {
    const state = this.loadState();
    const classroom = {
      id: id("class"),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      createdAt: now(),
    };
    state.classes.push(classroom);
    this.saveState(state);
    return clone(classroom);
  }
  addStudent(
    classId: string,
    displayName: string,
    code?: string,
  ): StudentAccessProvision {
    const state = this.loadState();
    const accessCode = generateAccessCode();
    const student: Student = {
      id: id("student"),
      classId,
      displayName: displayName.trim(),
      code: code?.trim() || undefined,
      createdAt: now(),
    };
    state.students.push(student);
    state.studentAccessCodes[student.id] = accessCode;
    this.saveState(state);
    return { student: clone(student), accessCode };
  }
  resetStudentAccess(studentId: string): string {
    const state = this.loadState();
    if (!state.students.some((student) => student.id === studentId))
      throw new Error("Aluno não encontrado.");
    const accessCode = generateAccessCode();
    state.studentAccessCodes[studentId] = accessCode;
    this.saveState(state);
    return accessCode;
  }
  createActivity(activity: Activity, classId: string): Activity {
    const state = this.loadState();
    state.activities.push(clone(activity));
    state.classActivities.push({
      id: id("class-activity"),
      classId,
      activityId: activity.id,
      isFeatured: false,
      createdAt: now(),
    });
    this.saveState(state);
    return clone(activity);
  }
  updateActivity(activity: Activity): Activity {
    const state = this.loadState();
    const hasAttempts = state.attempts.some(
      (attempt) => attempt.activityId === activity.id,
    );
    const original = this.allActivities(state).find(
      (item) => item.id === activity.id,
    );
    if (
      hasAttempts &&
      original &&
      JSON.stringify(original.requirements) !==
        JSON.stringify(activity.requirements)
    )
      throw new Error(
        "Não é possível alterar requisitos após o início de tentativas.",
      );
    const index = state.activities.findIndex((item) => item.id === activity.id);
    if (index >= 0) state.activities[index] = clone(activity);
    else state.activities.push(clone(activity));
    this.saveState(state);
    return clone(activity);
  }
  archiveActivity(activityId: string): void {
    const activity = this.getActivity(activityId);
    if (activity) this.updateActivity({ ...activity, status: "archived" });
  }
  setClassActivity(
    classId: string,
    activityId: string,
    assignmentPatch: Pick<
      ClassActivity,
      "isFeatured" | "availableFrom" | "availableUntil"
    >,
  ): ClassActivity {
    const state = this.loadState();
    const assignment = state.classActivities.find(
      (item) => item.classId === classId && item.activityId === activityId,
    );
    if (!assignment) throw new Error("Atividade não atribuída à turma.");
    if (assignmentPatch.isFeatured)
      state.classActivities.forEach((item) => {
        if (item.classId === classId) item.isFeatured = false;
      });
    Object.assign(assignment, assignmentPatch);
    this.saveState(state);
    return clone(assignment);
  }
  dashboard(classId?: string): TeacherDashboard {
    const state = this.loadState();
    const students = classId
      ? state.students.filter((student) => student.classId === classId)
      : state.students;
    const ids = new Set(students.map((student) => student.id));
    const attempts = state.attempts.filter((attempt) =>
      ids.has(attempt.studentId),
    );
    const assignments = classId
      ? state.classActivities.filter((item) => item.classId === classId)
      : state.classActivities;
    return {
      classes: clone(state.classes),
      students: clone(students),
      activities: clone(this.allActivities(state)),
      classActivities: clone(assignments),
      attempts: clone(attempts),
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
  ranking(
    classId: string,
    activityId: string,
    currentStudentId?: string,
  ): RankedStudent[] {
    const state = this.loadState();
    return clone(
      rankAttempts(
        state.attempts,
        state.students,
        classId,
        activityId,
        currentStudentId,
      ),
    );
  }
}

export const localPlatformRepository = new LocalPlatformRepository({
  demoMode: true,
});
