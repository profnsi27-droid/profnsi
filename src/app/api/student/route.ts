import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { mapCopy, generateSessionId, json, parseExercises } from "@/lib/helpers";
import { saveFile } from "@/lib/storage";
import type { AntiCheatEvent, AnswerCell } from "@/lib/types";

// GET : récupère l'examen pour l'élève (à partir de la session)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session");
  if (!sessionId) return json({ error: "session requise" }, 400);
  const copy = await db.copy.findUnique({
    where: { sessionId },
    include: { exam: true },
  });
  if (!copy) return json({ error: "Session invalide" }, 404);

  const exam = copy.exam;
  return json({
    session: copy.sessionId,
    copyId: copy.id,
    status: copy.status,
    student: {
      name: copy.studentName,
      firstname: copy.studentFirstname,
      className: copy.className,
    },
    exam: {
      id: exam.id,
      title: exam.title,
      level: exam.level,
      duration: exam.duration,
      scale: exam.scale,
      instructions: exam.instructions,
      exercises: parseExercises(exam.exercises),
      subjectPdf: exam.subjectPdf,
      competences: exam.competences,
    },
    startTime: copy.startTime.toISOString(),
    answers: JSON.parse(copy.answers),
  });
}

// POST : actions élève (access / save / event / submit / upload_image)
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "access";

  if (action === "access") {
    return handleAccess(req);
  }
  if (action === "upload_image") {
    return handleImageUpload(req);
  }
  // actions suivantes nécessitent une session valide
  const sessionId = String(req.headers.get("x-session") || url.searchParams.get("session") || "");
  const copy = await db.copy.findUnique({
    where: { sessionId },
    include: { exam: true },
  });
  if (!copy) return json({ error: "Session invalide" }, 404);
  if (copy.status !== "in_progress") {
    return json({ error: "Copie verrouillée (déjà soumise)." }, 403);
  }

  if (action === "save") return handleSave(copy.id, req);
  if (action === "event") return handleEvent(copy.id, req);
  if (action === "submit") return handleSubmit(copy.id, req);
  return json({ error: "action inconnue" }, 400);
}

async function handleAccess(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const firstname = String(body.firstname || "").trim();
  const className = String(body.className || "").trim();
  const code = String(body.code || "").trim().toUpperCase();

  if (!name || !firstname || !className || !code) {
    return json({ error: "Tous les champs sont requis." }, 400);
  }
  const exam = await db.exam.findUnique({ where: { accessCode: code } });
  if (!exam) {
    return json({ error: "Code d'accès invalide." }, 404);
  }
  if (exam.status !== "open") {
    return json({
      error:
        exam.status === "draft"
          ? "Cet examen n'est pas encore ouvert."
          : exam.status === "closed"
          ? "Cet examen est fermé."
          : "Cet examen est archivé.",
    }, 403);
  }

  // reprise de session : si l'élève a déjà commencé avec même nom+prénom+classe
  const existing = await db.copy.findFirst({
    where: {
      examId: exam.id,
      studentName: name,
      studentFirstname: firstname,
      className,
      status: "in_progress",
    },
  });
  if (existing) {
    return json({ session: existing.sessionId, resumed: true });
  }

  const sessionId = generateSessionId();
  const copy = await db.copy.create({
    data: {
      examId: exam.id,
      studentName: name,
      studentFirstname: firstname,
      className,
      sessionId,
      status: "in_progress",
      answers: "{}",
      events: JSON.stringify([
        { type: "start", ts: new Date().toISOString(), detail: "Démarrage de l'épreuve" },
      ]),
    },
  });
  return json({ session: copy.sessionId, resumed: false });
}

async function handleSave(copyId: string, req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const answers = body.answers as Record<string, AnswerCell>;
  if (!answers || typeof answers !== "object") {
    return json({ error: "answers requis" }, 400);
  }
  // nettoyer / horodater
  for (const k of Object.keys(answers)) {
    answers[k].updatedAt = new Date().toISOString();
  }
  await db.copy.update({
    where: { id: copyId },
    data: { answers: JSON.stringify(answers) },
  });
  return json({ ok: true, savedAt: new Date().toISOString() });
}

async function handleEvent(copyId: string, req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const event = body.event as AntiCheatEvent;
  if (!event || !event.type) return json({ error: "event.type requis" }, 400);
  const ev: AntiCheatEvent = {
    type: event.type,
    ts: new Date().toISOString(),
    detail: event.detail ? String(event.detail).slice(0, 200) : undefined,
  };
  const copy = await db.copy.findUnique({ where: { id: copyId } });
  if (!copy) return json({ error: "introuvable" }, 404);
  const events = JSON.parse(copy.events) as AntiCheatEvent[];
  events.push(ev);
  // limiter la taille du journal
  const trimmed = events.slice(-500);
  await db.copy.update({
    where: { id: copyId },
    data: { events: JSON.stringify(trimmed) },
  });
  return json({ ok: true });
}

async function handleSubmit(copyId: string, req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.confirm) {
    return json({ error: "Confirmation requise pour la soumission définitive." }, 400);
  }
  const copy = await db.copy.findUnique({ where: { id: copyId } });
  if (!copy) return json({ error: "introuvable" }, 404);
  if (copy.status !== "in_progress") {
    return json({ error: "Copie déjà verrouillée." }, 400);
  }
  // event submit
  const events = JSON.parse(copy.events) as AntiCheatEvent[];
  events.push({ type: "submit", ts: new Date().toISOString(), detail: "Soumission définitive" });
  const updated = await db.copy.update({
    where: { id: copyId },
    data: {
      status: "submitted",
      endTime: new Date(),
      events: JSON.stringify(events),
    },
    include: { exam: true },
  });
  return json({ ok: true, copy: await mapCopy(updated) });
}

async function handleImageUpload(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = String(url.searchParams.get("session") || "");
  const copy = await db.copy.findUnique({ where: { sessionId } });
  if (!copy) return json({ error: "Session invalide" }, 404);
  if (copy.status !== "in_progress")
    return json({ error: "Copie verrouillée" }, 403);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Fichier manquant" }, 400);
  const name = file.name.toLowerCase();
  if (!/\.(png|jpe?g|gif|webp)$/.test(name))
    return json({ error: "Image non supportée" }, 400);
  const ext = name.split(".").pop() || "png";
  const buf = Buffer.from(await file.arrayBuffer());
  const relPath = await saveFile(`copies/${copy.id}`, ext, buf);
  return json({ ok: true, path: relPath });
}
