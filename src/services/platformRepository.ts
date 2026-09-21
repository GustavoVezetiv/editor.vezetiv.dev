import type { Activity } from "../types/activity";
import type {
  ActivityAttempt,
  AssignedActivity,
  ClassActivity,
  Classroom,
  RankedStudent,
  Student,
  StudentAccessProvision,
  TeacherDashboard,
} from "../types/platform";
import { LocalPlatformRepository } from "./localPlatformRepository";
import { appMode, requireSupabase } from "./supabase";
import { SupabasePlatformRepository } from "./supabasePlatformRepository";

export type RemoteSaveState = "local" | "synced" | "retrying" | "blocked";
export interface SavedAttempt {
  attempt: ActivityAttempt;
  remoteState: RemoteSaveState;
}

export interface PlatformRepository {
  readonly mode: "demo" | "supabase";
  listAssignedActivities(student: Student): Promise<AssignedActivity[]>;
  getActivity(activityId: string): Promise<Activity | undefined>;
  join(
    classCode: string,
    accessCode: string,
    displayName?: string,
  ): Promise<Student>;
  getStudent(studentId: string): Promise<Student | undefined>;
  listStudentAttempts(studentId: string): Promise<ActivityAttempt[]>;
  openAttempt(studentId: string, activity: Activity): Promise<ActivityAttempt>;
  saveAttempt(attempt: ActivityAttempt): Promise<SavedAttempt>;
  verifyDocument(
    attempt: ActivityAttempt,
    activity: Activity,
    documentId: string,
  ): Promise<SavedAttempt>;
  completeAttempt(attempt: ActivityAttempt): Promise<SavedAttempt>;
  createClass(name: string, code: string): Promise<Classroom>;
  addStudent(
    classId: string,
    displayName: string,
    code?: string,
  ): Promise<StudentAccessProvision>;
  resetStudentAccess(studentId: string): Promise<string>;
  createActivity(activity: Activity, classId: string): Promise<Activity>;
  updateActivity(activity: Activity): Promise<Activity>;
  archiveActivity(activityId: string): Promise<void>;
  setClassActivity(
    classId: string,
    activityId: string,
    patch: Pick<
      ClassActivity,
      "isFeatured" | "availableFrom" | "availableUntil"
    >,
  ): Promise<ClassActivity>;
  dashboard(classId?: string): Promise<TeacherDashboard>;
  ranking(
    classId: string,
    activityId: string,
    currentStudentId?: string,
  ): Promise<RankedStudent[]>;
  retryPending(): Promise<number>;
}

class LocalRepositoryAdapter implements PlatformRepository {
  readonly mode = "demo" as const;
  constructor(private readonly repository: LocalPlatformRepository) {}
  async listAssignedActivities(student: Student) {
    return this.repository.listAssignedActivities(student);
  }
  async getActivity(activityId: string) {
    return this.repository.getActivity(activityId);
  }
  async join(classCode: string, accessCode: string, displayName?: string) {
    return this.repository.join(classCode, accessCode, displayName);
  }
  async getStudent(studentId: string) {
    return this.repository.getStudent(studentId);
  }
  async listStudentAttempts(studentId: string) {
    return this.repository.listStudentAttempts(studentId);
  }
  async openAttempt(studentId: string, activity: Activity) {
    return this.repository.openAttempt(studentId, activity);
  }
  async saveAttempt(attempt: ActivityAttempt): Promise<SavedAttempt> {
    return {
      attempt: this.repository.saveAttempt(attempt),
      remoteState: "local",
    };
  }
  async verifyDocument(
    attempt: ActivityAttempt,
    activity: Activity,
    documentId: string,
  ): Promise<SavedAttempt> {
    return {
      attempt: this.repository.verifyDocument(attempt, activity, documentId),
      remoteState: "local",
    };
  }
  async completeAttempt(attempt: ActivityAttempt): Promise<SavedAttempt> {
    return {
      attempt: this.repository.completeAttempt(attempt),
      remoteState: "local",
    };
  }
  async createClass(name: string, code: string) {
    return this.repository.createClass(name, code);
  }
  async addStudent(classId: string, displayName: string, code?: string) {
    return this.repository.addStudent(classId, displayName, code);
  }
  async resetStudentAccess(studentId: string) {
    return this.repository.resetStudentAccess(studentId);
  }
  async createActivity(activity: Activity, classId: string) {
    return this.repository.createActivity(activity, classId);
  }
  async updateActivity(activity: Activity) {
    return this.repository.updateActivity(activity);
  }
  async archiveActivity(activityId: string) {
    this.repository.archiveActivity(activityId);
  }
  async setClassActivity(
    classId: string,
    activityId: string,
    patch: Pick<
      ClassActivity,
      "isFeatured" | "availableFrom" | "availableUntil"
    >,
  ) {
    return this.repository.setClassActivity(classId, activityId, patch);
  }
  async dashboard(classId?: string) {
    return this.repository.dashboard(classId);
  }
  async ranking(
    classId: string,
    activityId: string,
    currentStudentId?: string,
  ) {
    return this.repository.ranking(classId, activityId, currentStudentId);
  }
  async retryPending() {
    return 0;
  }
}

export async function createPlatformRepository(): Promise<PlatformRepository> {
  if (appMode === "supabase") {
    const repository = new SupabasePlatformRepository(requireSupabase());
    await repository.retryPending();
    return repository;
  }
  return new LocalRepositoryAdapter(
    new LocalPlatformRepository({ demoMode: true }),
  );
}
