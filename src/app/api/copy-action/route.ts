import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { gradeCopy } from "@/lib/ai";
import { generateCorrectionPdf, sendCorrectionEmail } from "@/lib/email";
import { json } from "@/lib/helpers";

// POST : grade | pdf | email
export async function POST(req: NextRequest) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = String(body.action || "");
  if (!id || !action) return json({ error: "id et action requis" }, 400);

  if (action === "grade") {
    const result = await gradeCopy(id);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, 500);
    }
    return json({ ok: true, correction: result.correction });
  }

  if (action === "pdf") {
    const result = await generateCorrectionPdf(id);
    if (!result.ok) return json({ ok: false, error: result.error }, 500);
    return json({ ok: true, pdfPath: result.pdfPath });
  }

  if (action === "email") {
    const result = await sendCorrectionEmail(id);
    return json(result, result.ok ? 200 : 500);
  }

  // export des résultats d'un examen en CSV
  if (action === "export_csv") {
    const examId = String(body.examId || "");
    if (!examId) return json({ error: "examId requis" }, 400);
    const copies = await db.copy.findMany({
      where: { examId },
      include: { exam: true },
      orderBy: { studentName: "asc" },
    });
    const rows = [
      ["Nom", "Prénom", "Classe", "Examen", "Note", "Statut", "Soumis le"],
    ];
    for (const c of copies) {
      rows.push([
        c.studentName,
        c.studentFirstname,
        c.className,
        c.exam.title,
        c.grade != null ? String(c.grade) : "",
        c.status,
        c.endTime ? c.endTime.toISOString().slice(0, 16) : "",
      ]);
    }
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="resultats.csv"`,
      },
    });
  }

  return json({ error: "action inconnue" }, 400);
}
