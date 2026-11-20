import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { mapCopy, json } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id requis" }, 400);
  const copy = await db.copy.findUnique({ where: { id }, include: { exam: true } });
  if (!copy) return json({ error: "Copie introuvable" }, 404);
  return json({ copy: await mapCopy(copy) });
}

// PATCH : validation / modification manuelle de la note par le professeur
export async function PATCH(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id requis" }, 400);
  const body = await req.json().catch(() => ({}));

  const copy = await db.copy.findUnique({ where: { id }, include: { exam: true } });
  if (!copy) return json({ error: "Copie introuvable" }, 404);

  const updates: Record<string, unknown> = {};
  if (body.grade != null) {
    const g = Math.min(copy.exam.scale, Math.max(0, Number(body.grade)));
    updates.grade = g;
  }
  if (body.gradeBreakdown != null) {
    updates.gradeBreakdown = JSON.stringify(body.gradeBreakdown);
  }
  if (body.correction != null) {
    updates.correction = JSON.stringify(body.correction);
    // recalculer la note finale à partir du breakdown si fourni
    if (body.correction.totalGrade != null) {
      updates.grade = Math.min(
        copy.exam.scale,
        Math.max(0, Number(body.correction.totalGrade))
      );
    }
  }
  if (body.validate === true) {
    updates.status = "validated";
  }

  const updated = await db.copy.update({ where: { id }, data: updates, include: { exam: true } });
  return json({ copy: await mapCopy(updated) });
}
