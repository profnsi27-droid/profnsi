import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { readBuffer, saveFile } from "@/lib/storage";
import PDFDocument from "pdfkit";

const SMTP_HOST = process.env.EMAIL_HOST || "";
const SMTP_PORT = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587;
const SMTP_USER = process.env.EMAIL_USER || "";
const SMTP_PASS = process.env.EMAIL_PASS || "";
const SMTP_FROM = process.env.EMAIL_FROM || SMTP_USER || "profnsi@local";

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

const TEAL = "#0f766e";
const DARK = "#1f2937";
const MUTED = "#6b7280";
const LIGHT = "#f3f4f6";
const BORDER = "#d1d5db";
const AMBER_BG = "#fff7ed";
const AMBER_BORDER = "#fdba74";

/** Génère le PDF de correction avec pdfkit (Node pur, fonctionne sur Vercel). */
export async function generateCorrectionPdf(
  copyId: string
): Promise<{ ok: boolean; pdfPath?: string; error?: string }> {
  const copy = await db.copy.findUnique({
    where: { id: copyId },
    include: { exam: true },
  });
  if (!copy) return { ok: false, error: "Copie introuvable" };

  const correction = copy.correction ? JSON.parse(copy.correction) : null;
  const breakdown = copy.gradeBreakdown ? JSON.parse(copy.gradeBreakdown) : [];
  if (!correction && copy.grade == null) {
    return { ok: false, error: "La copie n'est pas encore corrigée." };
  }

  const spec = {
    studentName: copy.studentName,
    studentFirstname: copy.studentFirstname,
    className: copy.className,
    examTitle: copy.exam.title,
    level: copy.exam.level,
    scale: copy.exam.scale,
    duration: copy.exam.duration,
    submittedAt: copy.endTime?.toISOString() || copy.updatedAt.toISOString(),
    grade: copy.grade,
    breakdown,
    correction,
    answers: JSON.parse(copy.answers),
  };

  try {
    const buf = await buildCorrectionPdf(spec);
    const relPath = await saveFile(`copies`, `pdf`, buf);
    // correctionPdf stored as the storage ref (Blob URL or local path)
    await db.copy.update({ where: { id: copyId }, data: { correctionPdf: relPath } });
    return { ok: true, pdfPath: relPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

interface PdfSpec {
  studentName: string;
  studentFirstname: string;
  className: string;
  examTitle: string;
  level: string;
  scale: number;
  duration: number;
  submittedAt: string;
  grade: number | null;
  breakdown: { exerciseId: string; exerciseTitle: string; points: number; max: number; justification: string; errors: string[] }[];
  correction: { totalGrade?: number; breakdown?: unknown[]; detailedCorrection?: string; competencies?: { name: string; level: string }[]; advice?: string; needsManualReview?: boolean; manualReviewNotes?: string } | null;
  answers: Record<string, unknown>;
}

function buildCorrectionPdf(spec: PdfSpec): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "PROFNSI - Copie corrigee", Author: "PROFNSI", Subject: "Evaluation NSI" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 50;
    const contentW = pageW - margin * 2;
    let y = margin;

    const ensure = (h: number) => {
      if (y + h > pageH - margin) { doc.addPage(); y = margin; }
    };
    const text = (str: string, opts?: { size?: number; color?: string; bold?: boolean; x?: number; w?: number; align?: "left" | "center" | "right"; gap?: number }) => {
      const size = opts?.size ?? 10;
      const lh = size * 1.3;
      doc.fontSize(size);
      doc.fillColor(opts?.color ?? DARK);
      if (opts?.bold) doc.font("Helvetica-Bold"); else doc.font("Helvetica");
      const w = opts?.w ?? contentW;
      const x = opts?.x ?? margin;
      const heightOf = doc.heightOfString(str, { width: w });
      ensure(heightOf);
      doc.text(str, x, y, { width: w, align: opts?.align ?? "left" });
      y += heightOf + (opts?.gap ?? 4);
    };
    const hr = (color = BORDER, w = 1) => {
      ensure(8);
      doc.moveTo(margin, y).lineTo(pageW - margin, y).strokeColor(color).lineWidth(w).stroke();
      y += 8;
    };
    const box = (x: number, yy: number, w: number, h: number, fill: string, stroke?: string) => {
      doc.rect(x, yy, w, h).fill(fill);
      if (stroke) { doc.rect(x, yy, w, h).strokeColor(stroke).lineWidth(0.5).stroke(); }
    };

    // En-tête
    doc.font("Helvetica-Bold").fontSize(22).fillColor(TEAL).text("PROFNSI", margin, y, { width: contentW });
    y += 26;
    text("Plateforme d'évaluation NSI — Copie corrigée", { size: 10, color: MUTED });
    hr(TEAL, 1.2);

    // Bloc identité
    const idRows: [string, string][] = [
      ["Élève", `${spec.studentFirstname} ${spec.studentName}`],
      ["Classe", spec.className],
      ["Évaluation", spec.examTitle],
      ["Niveau", spec.level === "premiere" ? "Première NSI" : "Terminale NSI"],
      ["Date de soumission", spec.submittedAt.slice(0, 16).replace("T", " ")],
    ];
    const labelW = 130;
    const rowH = 18;
    for (const [label, val] of idRows) {
      ensure(rowH);
      box(margin, y, labelW, rowH, LIGHT);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text(label, margin + 6, y + 5, { width: labelW - 12 });
      doc.font("Helvetica").fontSize(10).fillColor(DARK).text(val, margin + labelW + 6, y + 4, { width: contentW - labelW - 6 });
      doc.rect(margin, y, contentW, rowH).strokeColor(BORDER).lineWidth(0.5).stroke();
      y += rowH;
    }
    y += 10;

    // Note finale
    const noteVal = spec.grade != null ? `${spec.grade.toFixed(2)} / ${spec.scale}` : "Non noté";
    ensure(50);
    box(margin, y, 110, 46, TEAL);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff").text("NOTE FINALE", margin + 6, y + 8, { width: 98, align: "center" });
    box(margin + 110, y, contentW - 110, 46, "#ecfdf5");
    doc.font("Helvetica-Bold").fontSize(20).fillColor(TEAL).text(noteVal, margin + 110, y + 12, { width: contentW - 110, align: "center" });
    y += 56;

    // Barème par exercice
    if (spec.breakdown.length) {
      text("Barème par exercice", { size: 13, color: DARK, bold: true, gap: 6 });
      // table header
      const cols = [0.34, 0.12, 0.12, 0.42]; // proportions
      const cw = cols.map((c) => c * contentW);
      const drawRow = (cells: string[], fill?: string, bold?: boolean, color?: string) => {
        ensure(22);
        let x = margin;
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(color ?? DARK);
        if (fill) box(margin, y, contentW, 20, fill);
        cells.forEach((c, i) => {
          doc.text(c, x + 4, y + 6, { width: cw[i] - 8 });
          x += cw[i];
        });
        doc.rect(margin, y, contentW, 20).strokeColor(BORDER).lineWidth(0.4).stroke();
        y += 20;
      };
      drawRow(["Exercice", "Note", "Max", "Justification"], DARK, true, "#ffffff");
      spec.breakdown.forEach((b, i) => {
        const just = (b.justification || "").slice(0, 400);
        drawRow([b.exerciseTitle || "Exercice", b.points.toFixed(2), b.max.toFixed(2), just], i % 2 ? LIGHT : "#ffffff");
      });
      y += 8;
    }

    // Correction détaillée
    const detailed = spec.correction?.detailedCorrection;
    if (detailed) {
      text("Correction détaillée", { size: 13, color: DARK, bold: true, gap: 4 });
      text(detailed, { size: 10, gap: 6 });
    }

    // Erreurs identifiées
    const withErrors = spec.breakdown.filter((b) => b.errors && b.errors.length);
    if (withErrors.length) {
      text("Erreurs identifiées", { size: 13, color: TEAL, bold: true, gap: 4 });
      for (const b of withErrors) {
        text(b.exerciseTitle || "Exercice", { size: 11, color: DARK, bold: true, gap: 2 });
        for (const e of b.errors) {
          text("• " + e, { size: 9, color: "#9a3412", x: margin + 10, w: contentW - 10, gap: 1 });
        }
        y += 2;
      }
    }

    // Bilan des compétences
    const comps = spec.correction?.competencies || [];
    if (comps.length) {
      text("Bilan des compétences", { size: 13, color: DARK, bold: true, gap: 4 });
      const levelLabel: Record<string, string> = { acquis: "Acquis", partiel: "Partiellement acquis", non_acquis: "Non acquis" };
      const levelColor: Record<string, string> = { acquis: "#16a34a", partiel: "#d97706", non_acquis: "#dc2626" };
      for (const c of comps) {
        ensure(18);
        doc.rect(margin, y, contentW, 16).strokeColor(BORDER).lineWidth(0.4).stroke();
        doc.font("Helvetica").fontSize(10).fillColor(DARK).text(c.name, margin + 6, y + 4, { width: contentW * 0.7 });
        doc.font("Helvetica-Bold").fontSize(10).fillColor(levelColor[c.level] || MUTED).text(levelLabel[c.level] || c.level, margin + contentW * 0.7, y + 4, { width: contentW * 0.3 - 6, align: "right" });
        y += 16;
      }
      y += 6;
    }

    // Conseils
    const advice = spec.correction?.advice;
    if (advice) {
      text("Conseils de progression", { size: 13, color: DARK, bold: true, gap: 4 });
      doc.font("Helvetica").fontSize(10).fillColor("#0f766e");
      const h = doc.heightOfString(advice, { width: contentW });
      ensure(h + 12);
      box(margin, y, contentW, h + 12, "#ecfdf5");
      doc.text(advice, margin + 6, y + 6, { width: contentW - 12 });
      y += h + 16;
    }

    // Vérification manuelle
    if (spec.correction?.needsManualReview) {
      const note = spec.correction?.manualReviewNotes || "";
      const msg = "⚠ Réponses à vérifier manuellement : " + note;
      doc.font("Helvetica").fontSize(10).fillColor("#92400e");
      const h = doc.heightOfString(msg, { width: contentW - 12 });
      ensure(h + 12);
      box(margin, y, contentW, h + 12, AMBER_BG, AMBER_BORDER);
      doc.text(msg, margin + 6, y + 6, { width: contentW - 12 });
      y += h + 16;
    }

    // Footer
    hr(BORDER, 0.5);
    text("PROFNSI — Évaluation NSI. Document généré automatiquement.", { size: 8.5, color: MUTED, align: "center" });

    doc.end();
  });
}

/** Envoie la copie corrigée par e-mail au professeur. */
export async function sendCorrectionEmail(
  copyId: string
): Promise<{ ok: boolean; error?: string; simulated?: boolean }> {
  const copy = await db.copy.findUnique({
    where: { id: copyId },
    include: { exam: true },
  });
  if (!copy) return { ok: false, error: "Copie introuvable" };

  let pdfPath = copy.correctionPdf;
  if (!pdfPath) {
    const gen = await generateCorrectionPdf(copyId);
    if (!gen.ok || !gen.pdfPath) {
      await db.copy.update({
        where: { id: copyId },
        data: { emailError: gen.error || "PDF non généré" },
      });
      return { ok: false, error: gen.error };
    }
    pdfPath = gen.pdfPath;
  }

  const studentLabel = `${copy.studentFirstname} ${copy.studentName}`;
  const subject = `PROFNSI – Copie corrigée – ${copy.studentName} ${copy.studentFirstname} – ${copy.className} – ${copy.exam.title}`;
  const text = `Bonjour,

Veuillez trouver ci-joint la copie corrigée de l'évaluation NSI.

Élève : ${studentLabel}
Classe : ${copy.className}
Évaluation : ${copy.exam.title}
Niveau : ${copy.exam.level === "premiere" ? "Première NSI" : "Terminale NSI"}
Date de soumission : ${copy.endTime?.toLocaleString("fr-FR") || "—"}
Note : ${copy.grade ?? "—"} / ${copy.exam.scale}

Cordialement,
PROFNSI – Plateforme d'évaluation NSI`;

  const settings = await db.settings.findUnique({ where: { id: "default" } });
  const to = settings?.teacherEmail || "profnsi27@gmail.com";

  if (!isEmailConfigured()) {
    await db.copy.update({
      where: { id: copyId },
      data: {
        emailSent: true,
        emailError: "simulé (SMTP non configuré) — PDF disponible au téléchargement",
      },
    });
    return { ok: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const buffer = await readBuffer(pdfPath);
    if (!buffer) return { ok: false, error: "PDF introuvable" };
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      attachments: [
        {
          filename: `PROFNSI_${copy.studentName}_${copy.studentFirstname}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });
    await db.copy.update({
      where: { id: copyId },
      data: { emailSent: true, emailError: null },
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.copy.update({
      where: { id: copyId },
      data: { emailSent: false, emailError: msg },
    });
    return { ok: false, error: msg };
  }
}

