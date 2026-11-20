import { db } from "@/lib/db";
import { isTeacher } from "@/lib/auth";
import { json } from "@/lib/helpers";
import type { DashboardStats } from "@/lib/types";

export async function GET() {
  if (!(await isTeacher())) {
    return json({ error: "Non autorisé" }, 403);
  }

  const [exams, copies] = await Promise.all([
    db.exam.findMany(),
    db.copy.findMany(),
  ]);

  const graded = copies.filter(
    (c) => (c.status === "graded" || c.status === "validated") && c.grade != null
  );
  const grades = graded.map((c) => c.grade as number);
  const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
  const max = grades.length ? Math.max(...grades) : null;
  const min = grades.length ? Math.min(...grades) : null;

  const buckets = [
    { range: "0-5", count: 0 },
    { range: "5-8", count: 0 },
    { range: "8-10", count: 0 },
    { range: "10-12", count: 0 },
    { range: "12-14", count: 0 },
    { range: "14-16", count: 0 },
    { range: "16-20", count: 0 },
  ];
  for (const g of grades) {
    if (g < 5) buckets[0].count++;
    else if (g < 8) buckets[1].count++;
    else if (g < 10) buckets[2].count++;
    else if (g < 12) buckets[3].count++;
    else if (g < 14) buckets[4].count++;
    else if (g < 16) buckets[5].count++;
    else buckets[6].count++;
  }

  const stats: DashboardStats = {
    examsCount: exams.length,
    studentsStarted: copies.length,
    copiesReceived: copies.filter((c) => c.status !== "in_progress").length,
    correctionsPending: copies.filter(
      (c) => c.status === "submitted" || c.status === "grading"
    ).length,
    copiesGraded: graded.length,
    classAverage: avg,
    maxGrade: max,
    minGrade: min,
    gradeDistribution: buckets,
  };
  return json(stats);
}
