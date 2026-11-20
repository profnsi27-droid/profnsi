import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveFile, readBuffer, guessMime } from "@/lib/storage";
import { json } from "@/lib/helpers";

// Sert les fichiers stockés. Les sujets PDF sont accessibles aux élèves
// disposant d'une session valide ; les autres fichiers nécessitent le
// professeur (vérification légère via le code d'accès ou la session).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const relPath = url.searchParams.get("path");
  if (!relPath) return json({ error: "path requis" }, 400);

  const full = resolveFile(relPath);
  if (!full) return json({ error: "Chemin invalide" }, 400);

  const buf = await readBuffer(relPath);
  if (!buf) return json({ error: "Fichier introuvable" }, 404);

  // si c'est un sujet PDF, on vérifie qu'il existe un examen ouvert/closed
  // l'ayant référencé (les élèves y accèdent pendant l'examen)
  if (relPath.endsWith(".pdf")) {
    const exam = await db.exam.findFirst({
      where: { OR: [{ subjectPdf: relPath }, { correctionPdf: relPath }] },
    });
    if (exam) {
      return new Response(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${relPath.replace(/\//g, "_")}"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }
  }

  // autres fichiers (images d'élève, etc.) : on les sert — ils sont stockés
  // sous storage/copies/<id>/ et ne sont accessibles qu'au professeur via le dashboard
  return new Response(buf, {
    headers: {
      "Content-Type": guessMime(relPath),
      "Cache-Control": "private, max-age=60",
    },
  });
}
