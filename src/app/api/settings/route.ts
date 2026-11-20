import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { ensureSettings, json } from "@/lib/helpers";
import { isEmailConfigured } from "@/lib/email";
import { activeAIProvider } from "@/lib/ai";

const GEMINI_MODELS = [
  { value: "auto", label: "Auto — Gemini 2.0 Flash (rapide, quota gratuit)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (rapide)" },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (économique)" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (raisonnement avancé)" },
];
const GLM_MODELS = [
  { value: "auto", label: "Auto (modèle par défaut, quota gratuit)" },
  { value: "glm-4.5", label: "GLM-4.5 (équilibré)" },
  { value: "glm-4.5-air", label: "GLM-4.5 Air (rapide, économique)" },
  { value: "glm-4.6", label: "GLM-4.6 (raisonnement avancé)" },
];

export async function GET() {
  const settings = await ensureSettings();
  const provider = activeAIProvider();
  return json({
    aiModel: settings.aiModel,
    teacherEmail: settings.teacherEmail,
    emailConfigured: isEmailConfigured(),
    provider,
    providerLabel:
      provider === "gemini" ? "Google Gemini (REST)" : "Z.ai SDK (local)",
    models: provider === "gemini" ? GEMINI_MODELS : GLM_MODELS,
  });
}

export async function POST(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const body = await req.json().catch(() => ({}));
  const aiModel = String(body.aiModel || "auto").trim();
  const teacherEmail = String(body.teacherEmail || "profnsi27@gmail.com").trim();
  const updated = await db.settings.upsert({
    where: { id: "default" },
    update: { aiModel, teacherEmail },
    create: { id: "default", aiModel, teacherEmail },
  });
  return json({ ok: true, aiModel: updated.aiModel, teacherEmail: updated.teacherEmail });
}
