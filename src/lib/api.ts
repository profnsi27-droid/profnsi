// Client-side API helpers for PROFNSI
import type {
  ExamWithCounts,
  CopyDetail,
  DashboardStats,
  ExerciseDef,
  Level,
  AICorrection,
  AnswerCell,
  AntiCheatEvent,
} from "@/lib/types";

const TOKEN_KEY = "profnsi_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(t: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}
function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function req<T>(
  url: string,
  opts?: RequestInit
): Promise<T> {
  const token = getToken();
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-profnsi-token": token } : {}),
      ...(opts?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  }
  return data as T;
}

export const api = {
  // auth
  getSession: () => req<{ authenticated: boolean }>("/api/auth"),
  login: (username: string, password: string) =>
    req<{ ok: boolean; token?: string }>("/api/auth", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }).then((r) => {
      if (r.ok && r.token) setToken(r.token);
      return r;
    }),
  logout: () =>
    req<{ ok: boolean }>("/api/auth", { method: "DELETE" }).then((r) => {
      clearToken();
      return r;
    }),

  // settings
  getSettings: () =>
    req<{
      aiModel: string;
      teacherEmail: string;
      emailConfigured: boolean;
      provider: string;
      providerLabel: string;
      models: { value: string; label: string }[];
    }>("/api/settings"),
  saveSettings: (aiModel: string, teacherEmail: string) =>
    req<{ ok: boolean }>("/api/settings", {
      method: "POST",
      body: JSON.stringify({ aiModel, teacherEmail }),
    }),

  // exams
  listExams: () => req<{ exams: ExamWithCounts[] }>("/api/exams"),
  createExam: (data: {
    title: string;
    level: Level;
    duration: number;
    scale: number;
    instructions: string;
    competences: string[] | null;
    exercises: ExerciseDef[];
  }) => req<{ exam: ExamWithCounts }>("/api/exams", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  getExam: (id: string) => req<{ exam: ExamWithCounts }>(`/api/exam?id=${id}`),
  updateExam: (id: string, data: Record<string, unknown>) =>
    req<{ exam: ExamWithCounts }>(`/api/exam?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteExam: (id: string) =>
    req<{ ok: boolean }>(`/api/exam?id=${id}`, { method: "DELETE" }),
  examAction: (id: string, action: string) =>
    req<{ exam: ExamWithCounts }>("/api/exam-action", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    }),
  uploadFile: (file: File, kind: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const token = getToken();
    return fetch("/api/upload", {
      method: "POST",
      body: form,
      headers: token ? { "x-profnsi-token": token } : {},
    }).then((r) => r.json());
  },

  // stats
  getStats: () => req<DashboardStats>("/api/stats"),

  // copies
  listCopies: (examId?: string) =>
    req<{ copies: CopyDetail[] }>(
      examId ? `/api/copies?examId=${examId}` : "/api/copies"
    ),
  getCopy: (id: string) => req<{ copy: CopyDetail }>(`/api/copy?id=${id}`),
  updateCopy: (id: string, data: Record<string, unknown>) =>
    req<{ copy: CopyDetail }>(`/api/copy?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  copyAction: (id: string, action: string, extra?: Record<string, unknown>) =>
    req<Record<string, unknown>>("/api/copy-action", {
      method: "POST",
      body: JSON.stringify({ id, action, ...extra }),
    }),

  // student
  studentAccess: (data: {
    name: string;
    firstname: string;
    className: string;
    code: string;
  }) =>
    req<{ session: string; resumed: boolean }>("/api/student?action=access", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getStudentExam: (session: string) =>
    req<{
      session: string;
      copyId: string;
      status: string;
      student: { name: string; firstname: string; className: string };
      exam: {
        id: string;
        title: string;
        level: string;
        duration: number;
        scale: number;
        instructions: string | null;
        exercises: ExerciseDef[];
        subjectPdf: string | null;
        competences: string | null;
      };
      startTime: string;
      answers: Record<string, AnswerCell>;
    }>(`/api/student?session=${session}`),
  studentSave: (session: string, answers: Record<string, AnswerCell>) =>
    req<{ ok: boolean; savedAt: string }>(
      `/api/student?action=save&session=${session}`,
      { method: "POST", headers: { "x-session": session }, body: JSON.stringify({ answers }) }
    ),
  studentEvent: (session: string, event: AntiCheatEvent) =>
    req<{ ok: boolean }>(`/api/student?action=event&session=${session}`, {
      method: "POST",
      headers: { "x-session": session },
      body: JSON.stringify({ event }),
    }),
  studentSubmit: (session: string) =>
    req<{ ok: boolean }>(`/api/student?action=submit&session=${session}`, {
      method: "POST",
      headers: { "x-session": session },
      body: JSON.stringify({ confirm: true }),
    }),
  studentUploadImage: (session: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`/api/student?action=upload_image&session=${session}`, {
      method: "POST",
      body: form,
    }).then((r) => r.json());
  },
};
