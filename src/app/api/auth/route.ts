import { NextRequest } from "next/server";
import { login, logout, isTeacher, ensureTeacher } from "@/lib/auth";
import { json } from "@/lib/helpers";

export async function GET() {
  await ensureTeacher();
  return json({ authenticated: await isTeacher() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) {
    return json({ ok: false, error: "Identifiant et mot de passe requis." }, 400);
  }
  const token = await login(username, password);
  if (!token) {
    return json({ ok: false, error: "Identifiants incorrects." }, 401);
  }
  return json({ ok: true, token });
}

export async function DELETE() {
  await logout();
  return json({ ok: true });
}
