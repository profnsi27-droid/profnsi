import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { mapExam, json } from "@/lib/helpers";
import type { ExerciseDef, Level } from "@/lib/types";

export async function GET(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id requis" }, 400);
  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) return json({ error: "Examen introuvable" }, 404);
  return json({ exam: await mapExam(exam) });
}

export async function PATCH(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id requis" }, 400);
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (body.title != null) data.title = String(body.title).trim();
  if (body.level != null)
    data.level = (body.level === "terminale" ? "terminale" : "premiere") as Level;
  if (body.duration != null) data.duration = Math.max(5, Number(body.duration) || 60);
  if (body.scale != null) data.scale = Math.max(1, Number(body.scale) || 20);
  if (body.instructions != null)
    data.instructions = String(body.instructions).trim() || null;
  if (body.competences != null)
    data.competences = body.competences ? JSON.stringify(body.competences) : null;
  if (body.subjectPdf != null) data.subjectPdf = String(body.subjectPdf) || null;
  if (body.correctionPdf != null)
    data.correctionPdf = String(body.correctionPdf) || null;
  if (Array.isArray(body.exercises)) {
    const exercises: ExerciseDef[] = body.exercises.map((e: ExerciseDef, i: number) => ({
      id: e.id || `exo-${Date.now()}-${i}`,
      title: String(e.title || `Exercice ${i + 1}`).trim(),
      allowedTypes: Array.isArray(e.allowedTypes) ? e.allowedTypes : ["text"],
      points: Math.max(0, Number(e.points) || 0),
      prompt: String(e.prompt || "").trim(),
      qcmOptions: e.qcmOptions,
      tableColumns: e.tableColumns,
      tableRows: e.tableRows,
    }));
    data.exercises = JSON.stringify(exercises);
  }

  const updated = await db.exam.update({ where: { id }, data });
  return json({ exam: await mapExam(updated) });
}

export async function DELETE(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id requis" }, 400);
  await db.exam.delete({ where: { id } });
  return json({ ok: true });
}
