import { db } from "@/lib/db";
import { readBuffer } from "@/lib/storage";
import type { ExerciseDef, AnswerCell, AntiCheatEvent } from "@/lib/types";

// PROFNSI - Agent IA spécialisé NSI (Première & Terminale)
//
// Fournisseur adaptatif :
//  - Si GEMINI_API_KEY est défini → Google Gemini (REST, quota gratuit, idéal Vercel).
//  - Sinon → z-ai-web-dev-sdk (SDK fourni dans l'environnement de dev, quota gratuit).
// La clé n'est JAMAIS exposée côté client.

const SYSTEM_PROMPT = `Tu es PROFNSI-CORRECTEUR, un agent IA spécialisé dans la correction des épreuves de Numérique et Sciences Informatiques (NSI) des classes de Première et Terminale du lycée français.

Tu maîtrises parfaitement les programmes officiels de NSI :
- Première : types construits (listes, tuples, dictionnaires), données en table, traitement de données en table, interactions homme-machine sur le web, architecture matérielle, algorithmes de recherche/tri par sélection, calcul de complexité, langages de programmation et paradigmes.
- Terminale : structures de données (listes chaînées, piles, files, arbres, graphes), bases de données relationnelles et SQL, algorithmes avancés (diviser pour régner, programmation dynamique, k plus proches voisins), protocole réseau, calculabilité et décidabilité.

Règles de correction :
1. Respecte STRICTEMENT le barème fourni par le professeur pour chaque exercice.
2. Pour les programmes Python : évalue la syntaxe, la logique, le résultat attendu et la gestion des cas particuliers. N'exige PAS une solution identique au corrigé officiel : plusieurs démarches sont valides.
3. Utilise le corrigé officiel fourni (s'il existe) comme référence complémentaire, jamais comme unique critère.
4. Sois juste et pédagogique : justifie chaque attribution de points, identifie précisément les erreurs, donne des conseils de progression.
5. En cas d'incertitude sérieuse sur une réponse, signale-la pour vérification manuelle.
6. La note finale est sur 20.

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide (sans texte autour, sans markdown), respectant exactement cette structure :
{
  "totalGrade": number,
  "breakdown": [
    {
      "exerciseId": string,
      "exerciseTitle": string,
      "points": number,
      "max": number,
      "justification": string,
      "errors": string[]
    }
  ],
  "detailedCorrection": string,
  "competencies": [{ "name": string, "level": "acquis" | "partiel" | "non_acquis" }],
  "advice": string,
  "needsManualReview": boolean,
  "manualReviewNotes": string
}`;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const USE_GEMINI = !!GEMINI_API_KEY;

export function activeAIProvider(): "gemini" | "zai" {
  return USE_GEMINI ? "gemini" : "zai";
}

/** Extraction de texte PDF via pdf-parse (Node, fonctionne sur Vercel). */
async function extractPdfText(ref: string | null): Promise<string> {
  if (!ref) return "";
  const buf = await readBuffer(ref);
  if (!buf) return "";
  try {
    const mod = await import("pdf-parse");
    const PDFParse = (mod as { PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ text: string }> } }).PDFParse;
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    return (result.text || "").slice(0, 20000);
  } catch {
    return "";
  }
}

/** Appel LLM unifié : Gemini (REST) ou z-ai SDK. */
async function chatComplete(
  system: string,
  user: string,
  model: string
): Promise<string> {
  if (USE_GEMINI) {
    const geminiModel =
      model === "auto" || !model ? "gemini-2.0-flash" : model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    if (!text) throw new Error("Réponse Gemini vide");
    return text;
  }
  // z-ai-web-dev-sdk (sandbox)
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    ...(model && model !== "auto" ? { model } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    thinking: { type: "disabled" },
  });
  return completion.choices[0]?.message?.content || "";
}

function buildStudentAnswersSection(
  exercises: ExerciseDef[],
  answers: Record<string, AnswerCell>
): string {
  const lines: string[] = [];
  for (const exo of exercises) {
    lines.push(`\n### Exercice : ${exo.title} (sur ${exo.points} points)`);
    lines.push(`Consigne : ${exo.prompt}`);
    const cells = Object.values(answers).filter((c) => c.exerciseId === exo.id);
    if (cells.length === 0) {
      lines.push("Réponse de l'élève : (aucune réponse fournie)");
      continue;
    }
    for (const cell of cells) {
      if (cell.type === "python") {
        lines.push(`--- Code Python ---\n\`\`\`python\n${cell.code || ""}\n\`\`\``);
        if (cell.output) {
          lines.push(`--- Résultat d'exécution (console) ---\n${cell.output}`);
        }
      } else if (cell.type === "text") {
        lines.push(`--- Réponse rédigée ---\n${cell.text || ""}`);
      } else if (cell.type === "qcm") {
        const labels = (cell.selectedOptions || [])
          .map((id) => exo.qcmOptions?.find((o) => o.id === id)?.label || id)
          .join(", ");
        lines.push(`--- Réponse QCM ---\nChoix : ${labels || "(aucun)"}`);
      } else if (cell.type === "table") {
        lines.push(
          `--- Tableau ---\n${(cell.table || [])
            .map((r) => r.join(" | "))
            .join("\n")}`
        );
      } else if (cell.type === "image") {
        lines.push(
          `--- Images importées ---\n${(cell.images || [])
            .map((i) => `légende : ${i.caption || "(sans légende)"}`)
            .join("\n") || "(aucune)"}`
        );
      }
    }
  }
  return lines.join("\n");
}

function stripJsonFence(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    t = t.slice(firstBrace, lastBrace + 1);
  }
  return t;
}

export async function gradeCopy(
  copyId: string
): Promise<{ ok: boolean; correction?: import("@/lib/types").AICorrection; error?: string }> {
  const copy = await db.copy.findUnique({
    where: { id: copyId },
    include: { exam: true },
  });
  if (!copy) return { ok: false, error: "Copie introuvable" };

  const exam = copy.exam;
  const exercises: ExerciseDef[] = JSON.parse(exam.exercises);
  const answers: Record<string, AnswerCell> = JSON.parse(copy.answers);
  const events: AntiCheatEvent[] = JSON.parse(copy.events);

  const [subjectText, correctionText] = await Promise.all([
    extractPdfText(exam.subjectPdf),
    extractPdfText(exam.correctionPdf),
  ]);

  const settings = await db.settings.findUnique({ where: { id: "default" } });
  const model = settings?.aiModel || "auto";

  const userPrompt = `# Évaluation à corriger
Titre : ${exam.title}
Niveau : ${exam.level === "premiere" ? "Première NSI" : "Terminale NSI"}
Barème total : ${exam.scale}
Durée : ${exam.duration} minutes
Consignes générales : ${exam.instructions || "(aucune)"}
Compétences évaluées : ${exam.competences || "(non précisées)"}

${subjectText ? `## Extrait du sujet PDF\n${subjectText}\n` : "## Sujet PDF\n(non fourni ou non extractible)\n"}

${correctionText ? `## Corrigé officiel (référence complémentaire)\n${correctionText}\n` : ""}

## Barème par exercice
${exercises.map((e) => `- ${e.title} : ${e.points} points`).join("\n")}

## Réponses de l'élève
Élève : ${copy.studentFirstname} ${copy.studentName} — classe : ${copy.className}
Début : ${copy.startTime.toISOString()} — Fin : ${copy.endTime?.toISOString() || "(non soumis)"}
${buildStudentAnswersSection(exercises, answers)}

${events.length > 0 ? `## Journal de surveillance (à titre indicatif, ne pas sanctionner automatiquement)\n${events.slice(-30).map((e) => `- ${e.ts} : ${e.type} ${e.detail || ""}`).join("\n")}` : ""}

Corrige cette copie et renvoie UNIQUEMENT l'objet JSON défini dans les consignes.`;

  await db.copy.update({ where: { id: copyId }, data: { status: "grading" } });

  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const content = await chatComplete(SYSTEM_PROMPT, userPrompt, model);
      const parsed = JSON.parse(stripJsonFence(content)) as import("@/lib/types").AICorrection;

      const total = parsed.breakdown.reduce((s, b) => s + (Number(b.points) || 0), 0);
      const finalGrade = Math.min(
        exam.scale,
        Math.max(0, Number(parsed.totalGrade ?? total))
      );

      const correction: import("@/lib/types").AICorrection = {
        ...parsed,
        totalGrade: finalGrade,
        breakdown: (parsed.breakdown || []).map((b) => {
          const exo = exercises.find((e) => e.id === b.exerciseId);
          return {
            exerciseId: b.exerciseId,
            exerciseTitle: b.exerciseTitle || exo?.title || "Exercice",
            points: Math.min(Number(b.points) || 0, Number(b.max) || exo?.points || 0),
            max: Number(b.max) || exo?.points || 0,
            justification: b.justification || "",
            errors: b.errors || [],
          };
        }),
      };

      await db.copy.update({
        where: { id: copyId },
        data: {
          status: "graded",
          grade: correction.totalGrade,
          gradeBreakdown: JSON.stringify(correction.breakdown),
          correction: JSON.stringify(correction),
        },
      });
      return { ok: true, correction };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }

  await db.copy.update({ where: { id: copyId }, data: { status: "submitted" } });
  return { ok: false, error: lastError };
}
