import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { mapCopy, json } from "@/lib/helpers";

// GET : liste des copies (résumé), filtrable par ?examId=
export async function GET(req: Request) {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }
  const examId = new URL(req.url).searchParams.get("examId");
  const copies = await db.copy.findMany({
    where: examId ? { examId } : undefined,
    include: { exam: true },
    orderBy: { updatedAt: "desc" },
  });
  const out = await Promise.all(copies.map(mapCopy));
  return json({ copies: out });
}
