import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { mapExam, generateAccessCode, json } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = String(body.action || "");
  if (!id || !action) return json({ error: "id et action requis" }, 400);

  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) return json({ error: "Examen introuvable" }, 404);

  if (action === "open") {
    const updated = await db.exam.update({ where: { id }, data: { status: "open" } });
    return json({ exam: await mapExam(updated) });
  }
  if (action === "close") {
    const updated = await db.exam.update({ where: { id }, data: { status: "closed" } });
    return json({ exam: await mapExam(updated) });
  }
  if (action === "archive") {
    const updated = await db.exam.update({ where: { id }, data: { status: "archived" } });
    return json({ exam: await mapExam(updated) });
  }
  if (action === "regenerate_code") {
    const code = await ensureUniqueCode();
    const updated = await db.exam.update({ where: { id }, data: { accessCode: code } });
    return json({ exam: await mapExam(updated) });
  }
  if (action === "duplicate") {
    const newCode = await ensureUniqueCode();
    const created = await db.exam.create({
      data: {
        title: `${exam.title} (copie)`,
        level: exam.level,
        duration: exam.duration,
        scale: exam.scale,
        instructions: exam.instructions,
        competences: exam.competences,
        exercises: exam.exercises,
        accessCode: newCode,
        status: "draft",
        subjectPdf: exam.subjectPdf,
        correctionPdf: exam.correctionPdf,
      },
    });
    return json({ exam: await mapExam(created) });
  }
  return json({ error: "action inconnue" }, 400);
}

async function ensureUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateAccessCode();
    const exists = await db.exam.findUnique({ where: { accessCode: code } });
    if (!exists) return code;
  }
  return generateAccessCode() + Math.floor(Math.random() * 90 + 10);
}
