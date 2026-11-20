import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { mapExam, generateAccessCode, parseExercises, json } from "@/lib/helpers";
import type { ExerciseDef, Level } from "@/lib/types";

export async function GET() {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const exams = await db.exam.findMany({
    orderBy: { createdAt: "desc" },
  });
  const out = await Promise.all(exams.map(mapExam));
  return json({ exams: out });
}

export async function POST(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return json({ error: "Le titre est requis." }, 400);

  const level: Level = body.level === "terminale" ? "terminale" : "premiere";
  const duration = Math.max(5, Number(body.duration) || 60);
  const scale = Math.max(1, Number(body.scale) || 20);
  const instructions = String(body.instructions || "").trim() || null;
  const competences = body.competences
    ? JSON.stringify(body.competences)
    : null;

  let exercises: ExerciseDef[] = [];
  if (Array.isArray(body.exercises)) {
    exercises = body.exercises.map((e: ExerciseDef, i: number) => ({
      id: e.id || `exo-${Date.now()}-${i}`,
      title: String(e.title || `Exercice ${i + 1}`).trim(),
      allowedTypes: Array.isArray(e.allowedTypes) ? e.allowedTypes : ["text"],
      points: Math.max(0, Number(e.points) || 0),
      prompt: String(e.prompt || "").trim(),
      qcmOptions: e.qcmOptions,
      tableColumns: e.tableColumns,
      tableRows: e.tableRows,
    }));
  }
  // si aucun exercice fourni, on en crée un par défaut
  if (exercises.length === 0) {
    exercises = [
      {
        id: `exo-${Date.now()}`,
        title: "Exercice 1",
        allowedTypes: ["python", "text", "image"],
        points: scale,
        prompt: "",
      },
    ];
  }

  const accessCode = await ensureUniqueCode();
  const created = await db.exam.create({
    data: {
      title,
      level,
      duration,
      scale,
      instructions,
      competences,
      exercises: JSON.stringify(exercises),
      accessCode,
      status: "draft",
    },
  });
  return json({ exam: await mapExam(created) });
}

async function ensureUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateAccessCode();
    const exists = await db.exam.findUnique({ where: { accessCode: code } });
    if (!exists) return code;
  }
  return generateAccessCode() + Math.floor(Math.random() * 90 + 10);
}
