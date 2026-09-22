import { useCallback, useEffect, useState } from "react";
import { ActivityWorkspace } from "./activity/ActivityWorkspace";
import { AuthService } from "./services/authService";
import {
  createPlatformRepository,
  type PlatformRepository,
} from "./services/platformRepository";
import { JoinPage } from "./student/JoinPage";
import { StudentHome } from "./student/StudentHome";
import { TeacherLoginPage } from "./teacher/TeacherLoginPage";
import { TeacherPage } from "./teacher/TeacherPage";
import type { Activity } from "./types/activity";
import type {
  ActivityAttempt,
  Actor,
  AssignedActivity,
  ClassActivity,
  RankedStudent,
  StudentAccessProvision,
  TeacherDashboard,
} from "./types/platform";

type Route = "join" | "home" | "activity" | "teacher" | "teacher-login";
const routeForPath = (): Route =>
  location.pathname === "/join"
    ? "join"
    : location.pathname === "/teacher/login"
      ? "teacher-login"
      : location.pathname.startsWith("/teacher")
        ? "teacher"
        : location.pathname.startsWith("/activity/")
          ? "activity"
          : "home";
const activitySlugFromPath = () => location.pathname.split("/")[2];
const emptyDashboard = (): TeacherDashboard => ({
  classes: [],
  students: [],
  activities: [],
  classActivities: [],
  attempts: [],
  averageScore: 0,
  completedAttempts: 0,
});

function RouteRedirect({ onRedirect }: { onRedirect: () => void }) {
  useEffect(onRedirect, [onRedirect]);
  return (
    <main className="entry-page">
      <section className="entry-card">
        <h1>Redirecionando…</h1>
      </section>
    </main>
  );
}

function App() {
  const [route, setRoute] = useState<Route>(routeForPath);
  const [repository, setRepository] = useState<PlatformRepository | null>(null);
  const [auth, setAuth] = useState<AuthService | null>(null);
  const [actor, setActor] = useState<Actor>({ role: "anonymous" });
  const [activities, setActivities] = useState<AssignedActivity[]>([]);
  const [attempts, setAttempts] = useState<ActivityAttempt[]>([]);
  const [ranking, setRanking] = useState<RankedStudent[]>([]);
  const [dashboard, setDashboard] = useState<TeacherDashboard>(emptyDashboard);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ActivityAttempt | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useCallback((next: Route, path: string) => {
    history.pushState({}, "", path);
    setRoute(next);
  }, []);
  const redirectStudent = useCallback(
    () => navigate("home", "/student"),
    [navigate],
  );
  const redirectTeacher = useCallback(
    () => navigate("teacher", "/teacher"),
    [navigate],
  );

  const loadStudent = useCallback(
    async (
      nextRepository: PlatformRepository,
      nextActor: Extract<Actor, { role: "student" }>,
    ) => {
      const [assigned, ownAttempts] = await Promise.all([
        nextRepository.listAssignedActivities(nextActor.student),
        nextRepository.listStudentAttempts(nextActor.student.id),
      ]);
      const featured = assigned.find((item) => item.assignment.isFeatured);
      setActivities(assigned);
      setAttempts(ownAttempts);
      setRanking(
        featured
          ? await nextRepository.ranking(
              nextActor.student.classId,
              featured.activity.id,
              nextActor.student.id,
            )
          : [],
      );
    },
    [],
  );

  const loadTeacher = useCallback(
    async (nextRepository: PlatformRepository, classId?: string) => {
      const overview = await nextRepository.dashboard();
      const selected =
        classId && overview.classes.some((item) => item.id === classId)
          ? classId
          : (overview.classes[0]?.id ?? "");
      setSelectedClassId(selected);
      setDashboard(
        selected ? await nextRepository.dashboard(selected) : overview,
      );
    },
    [],
  );

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const nextRepository = await createPlatformRepository();
        const nextAuth = new AuthService(nextRepository);
        const nextActor = await nextAuth.getActor();
        if (!current) return;
        setRepository(nextRepository);
        setAuth(nextAuth);
        setActor(nextActor);
        if (nextActor.role === "student")
          await loadStudent(nextRepository, nextActor);
        if (nextActor.role === "teacher") await loadTeacher(nextRepository);
      } catch (cause) {
        if (current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar a plataforma.",
          );
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => {
      current = false;
    };
  }, [loadStudent, loadTeacher]);

  useEffect(() => {
    const updateRoute = () => setRoute(routeForPath());
    addEventListener("popstate", updateRoute);
    return () => removeEventListener("popstate", updateRoute);
  }, []);
  useEffect(() => {
    if (!repository || actor.role !== "student" || route !== "activity") return;
    let current = true;
    void (async () => {
      const assigned = activities.find(
        (item) => item.activity.slug === activitySlugFromPath(),
      );
      if (!assigned) {
        navigate("home", "/student");
        return;
      }
      try {
        const attempt = await repository.openAttempt(
          actor.student.id,
          assigned.activity,
        );
        if (!current) return;
        setActiveActivity(assigned.activity);
        setActiveAttempt(attempt);
        setAttempts((items) => [
          ...items.filter((item) => item.id !== attempt.id),
          attempt,
        ]);
      } catch (cause) {
        if (current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível abrir a atividade.",
          );
      }
    })();
    return () => {
      current = false;
    };
  }, [activities, actor, navigate, repository, route]);

  const join = async (
    classCode: string,
    accessCode: string,
    displayName: string,
  ) => {
    if (!auth || !repository) return;
    setError("");
    try {
      const student = await auth.joinStudent(
        classCode,
        accessCode,
        displayName,
      );
      const nextActor: Actor = { role: "student", student };
      setActor(nextActor);
      await loadStudent(repository, nextActor);
      navigate("home", "/student");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível entrar na turma.",
      );
    }
  };
  const enterDemoTeacher = async () => {
    if (!auth || !repository) return;
    auth.enterDemoTeacher();
    const nextActor: Actor = { role: "teacher", userId: "teacher-demo" };
    setActor(nextActor);
    await loadTeacher(repository);
    navigate("teacher", "/teacher");
  };
  const openActivity = async (activity: Activity) => {
    if (!repository || actor.role !== "student") return;
    const attempt = await repository.openAttempt(actor.student.id, activity);
    setActiveActivity(activity);
    setActiveAttempt(attempt);
    setAttempts((items) => [
      ...items.filter((item) => item.id !== attempt.id),
      attempt,
    ]);
    navigate("activity", `/activity/${activity.slug}`);
  };
  const saveAttempt = useCallback(
    async (attempt: ActivityAttempt) => {
      if (!repository) return { attempt, remoteState: "blocked" as const };
      const saved = await repository.saveAttempt(attempt);
      setActiveAttempt(saved.attempt);
      setAttempts((items) => [
        ...items.filter((item) => item.id !== saved.attempt.id),
        saved.attempt,
      ]);
      const featured = activities.find((item) => item.assignment.isFeatured);
      if (actor.role === "student" && featured)
        setRanking(
          await repository.ranking(
            actor.student.classId,
            featured.activity.id,
            actor.student.id,
          ),
        );
      return saved;
    },
    [activities, actor, repository],
  );
  const verifyDocument = useCallback(
    async (attempt: ActivityAttempt, activity: Activity, documentId: string) => {
      if (!repository) return { attempt, remoteState: "blocked" as const };
      const saved = await repository.verifyDocument(attempt, activity, documentId);
      setActiveAttempt(saved.attempt);
      setAttempts((items) => [...items.filter((item) => item.id !== saved.attempt.id), saved.attempt]);
      const featured = activities.find((item) => item.assignment.isFeatured);
      if (actor.role === "student" && featured) setRanking(await repository.ranking(actor.student.classId, featured.activity.id, actor.student.id));
      return saved;
    },
    [activities, actor, repository],
  );
  const completeAttempt = useCallback(
    async (attempt: ActivityAttempt) => {
      if (!repository) return { attempt, remoteState: "blocked" as const };
      const saved = await repository.completeAttempt(attempt);
      setActiveAttempt(saved.attempt);
      setAttempts((items) => [...items.filter((item) => item.id !== saved.attempt.id), saved.attempt]);
      return saved;
    },
    [repository],
  );
  const deleteDocument = useCallback(
    async (attempt: ActivityAttempt, documentId: string) => {
      if (!repository) return { attempt, remoteState: "blocked" as const };
      const saved = await repository.deleteDocument(attempt, documentId);
      setActiveAttempt(saved.attempt);
      setAttempts((items) => [
        ...items.filter((item) => item.id !== saved.attempt.id),
        saved.attempt,
      ]);
      return saved;
    },
    [repository],
  );
  const refreshTeacher = async (classId = selectedClassId) => {
    if (repository) await loadTeacher(repository, classId);
  };
  const createClass = async (name: string, code: string) => {
    if (!repository) return;
    const classroom = await repository.createClass(name, code);
    await refreshTeacher(classroom.id);
  };
  const addStudent = async (
    classId: string,
    name: string,
    code?: string,
  ): Promise<StudentAccessProvision> => {
    if (!repository) throw new Error("Repositório indisponível.");
    const result = await repository.addStudent(classId, name, code);
    await refreshTeacher(classId);
    return result;
  };
  const resetStudent = async (studentId: string) => {
    if (!repository) throw new Error("Repositório indisponível.");
    return repository.resetStudentAccess(studentId);
  };
  const createActivity = async (activity: Activity, classId: string) => {
    if (!repository) return;
    await repository.createActivity(activity, classId);
    await refreshTeacher(classId);
  };
  const updateActivity = async (activity: Activity) => {
    if (!repository) return;
    await repository.updateActivity(activity);
    await refreshTeacher();
  };
  const archiveActivity = async (activityId: string) => {
    if (!repository) return;
    await repository.archiveActivity(activityId);
    await refreshTeacher();
  };
  const setClassActivity = async (
    classId: string,
    activityId: string,
    patch: Pick<
      ClassActivity,
      "isFeatured" | "availableFrom" | "availableUntil"
    >,
  ) => {
    if (!repository) return;
    await repository.setClassActivity(classId, activityId, patch);
    await refreshTeacher(classId);
  };
  const signOut = async () => {
    await auth?.signOut();
    setActor({ role: "anonymous" });
    setActivities([]);
    setAttempts([]);
    setRanking([]);
    setDashboard(emptyDashboard());
    navigate("join", "/join");
  };

  if (loading)
    return (
      <main className="entry-page">
        <section className="entry-card">
          <h1>Carregando Editor Vezetiv…</h1>
        </section>
      </main>
    );
  if (
    actor.role === "student" &&
    (route === "teacher" || route === "teacher-login")
  )
    return <RouteRedirect onRedirect={redirectStudent} />;
  if (
    actor.role === "teacher" &&
    route !== "teacher" &&
    route !== "teacher-login"
  )
    return <RouteRedirect onRedirect={redirectTeacher} />;
  if (route === "teacher-login")
    return actor.role === "teacher" ? (
      <TeacherPage
        dashboard={dashboard}
        selectedClassId={selectedClassId}
        onSelectClass={(id) => void refreshTeacher(id)}
        onCreateClass={createClass}
        onAddStudent={addStudent}
        onResetStudent={resetStudent}
        onCreateActivity={createActivity}
        onUpdateActivity={updateActivity}
        onArchiveActivity={archiveActivity}
        onSetClassActivity={setClassActivity}
        onSignOut={() => void signOut()}
      />
    ) : (
      <TeacherLoginPage
        error={error}
        onRequestLink={async (email) => {
          setError("");
          try {
            await auth?.requestTeacherLink(email);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível enviar o link.",
            );
            throw cause;
          }
        }}
        onBack={() => navigate("join", "/join")}
      />
    );
  if (route === "teacher")
    return actor.role === "teacher" ? (
      <TeacherPage
        dashboard={dashboard}
        selectedClassId={selectedClassId}
        onSelectClass={(id) => void refreshTeacher(id)}
        onCreateClass={createClass}
        onAddStudent={addStudent}
        onResetStudent={resetStudent}
        onCreateActivity={createActivity}
        onUpdateActivity={updateActivity}
        onArchiveActivity={archiveActivity}
        onSetClassActivity={setClassActivity}
        onSignOut={() => void signOut()}
      />
    ) : (
      <TeacherLoginPage
        error={error}
        onRequestLink={(email) =>
          auth?.requestTeacherLink(email) ??
          Promise.reject(new Error("Autenticação indisponível."))
        }
        onBack={() => navigate("join", "/join")}
      />
    );
  if (actor.role !== "student" || route === "join")
    return (
      <JoinPage
        onJoin={join}
        error={error}
        mode={repository?.mode ?? "demo"}
        onDemoTeacher={() => void enterDemoTeacher()}
        onTeacherLogin={() => navigate("teacher-login", "/teacher/login")}
      />
    );
  if (route === "activity" && activeActivity && activeAttempt)
    return (
      <ActivityWorkspace
        key={activeAttempt.id}
        activity={activeActivity}
        student={actor.student}
        initialAttempt={activeAttempt}
        onSaveAttempt={saveAttempt}
        onVerifyDocument={verifyDocument}
        onDeleteDocument={deleteDocument}
        onCompleteAttempt={completeAttempt}
        onBack={() => navigate("home", "/student")}
      />
    );
  if (route === "activity")
    return (
      <main className="entry-page">
        <section className="entry-card">
          <h1>Abrindo atividade…</h1>
          <p>{error || "Recuperando seu documento salvo."}</p>
        </section>
      </main>
    );
  return (
    <StudentHome
      student={actor.student}
      activities={activities}
      attempts={attempts}
      ranking={ranking}
      onOpen={(activity) => void openActivity(activity)}
      onLeave={() => void signOut()}
    />
  );
}

export default App;
