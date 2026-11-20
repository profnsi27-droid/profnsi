import { db } from "@/lib/db";
import crypto from "crypto";
import type {
  ExamWithCounts,
  CopyDetail,
  ExerciseDef,
  AnswerCell,
  AntiCheatEvent,
  GradeBreakdownItem,
  AICorrection,
} from "@/lib/types";
import type { Exam, Copy } from "@prisma/client";

export function generateAccessCode(): string {
  // code lisible : 6 caractères alphanumériques majuscules (sans ambigus)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function ensureSettings() {
  const existing = await db.settings.findUnique({ where: { id: "default" } });
  if (!existing) {
    return db.settings.create({
      data: {
        id: "default",
        aiModel: "auto",
        teacherEmail: "profnsi27@gmail.com",
        emailConfigured: false,
      },
    });
  }
  return existing;
}

export function parseExercises(raw: string): ExerciseDef[] {
  try {
    return JSON.parse(raw) as ExerciseDef[];
  } catch {
    return [];
  }
}

export async function mapExam(exam: Exam): Promise<ExamWithCounts> {
  const copies = await db.copy.findMany({
    where: { examId: exam.id },
    select: { status: true },
  });
  return {
    id: exam.id,
    title: exam.title,
    level: exam.level as "premiere" | "terminale",
    duration: exam.duration,
    scale: exam.scale,
    instructions: exam.instructions,
    competences: exam.competences,
    exercises: parseExercises(exam.exercises),
    accessCode: exam.accessCode,
    status: exam.status as ExamWithCounts["status"],
    subjectPdf: exam.subjectPdf,
    correctionPdf: exam.correctionPdf,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
    copiesCount: copies.length,
    submittedCount: copies.filter(
      (c) => c.status !== "in_progress"
    ).length,
    gradedCount: copies.filter(
      (c) => c.status === "graded" || c.status === "validated"
    ).length,
  };
}

export async function mapCopy(copy: Copy & { exam: Exam }): Promise<CopyDetail> {
  let correction: AICorrection | null = null;
  if (copy.correction) {
    try {
      correction = JSON.parse(copy.correction) as AICorrection;
    } catch {
      correction = null;
    }
  }
  let breakdown: GradeBreakdownItem[] | null = null;
  if (copy.gradeBreakdown) {
    try {
      breakdown = JSON.parse(copy.gradeBreakdown) as GradeBreakdownItem[];
    } catch {
      breakdown = null;
    }
  }
  return {
    id: copy.id,
    examId: copy.examId,
    examTitle: copy.exam.title,
    level: copy.exam.level as "premiere" | "terminale",
    scale: copy.exam.scale,
    exercises: parseExercises(copy.exam.exercises),
    studentName: copy.studentName,
    studentFirstname: copy.studentFirstname,
    className: copy.className,
    sessionId: copy.sessionId,
    startTime: copy.startTime.toISOString(),
    endTime: copy.endTime?.toISOString() ?? null,
    status: copy.status as CopyDetail["status"],
    answers: JSON.parse(copy.answers) as Record<string, AnswerCell>,
    events: JSON.parse(copy.events) as AntiCheatEvent[],
    grade: copy.grade,
    gradeBreakdown: breakdown,
    correction,
    correctionPdf: copy.correctionPdf,
    emailSent: copy.emailSent,
    emailError: copy.emailError,
    createdAt: copy.createdAt.toISOString(),
    updatedAt: copy.updatedAt.toISOString(),
  };
}

/** JSON helper robuste pour les routes API. */
export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
