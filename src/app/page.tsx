"use client";

import { Suspense } from "react";
import { useRoute } from "@/lib/nav";
import { Landing } from "@/components/profnsi/Landing";
import { TeacherLogin } from "@/components/profnsi/TeacherLogin";
import { TeacherApp } from "@/components/profnsi/TeacherApp";
import { StudentAccess } from "@/components/profnsi/StudentAccess";
import { ExamRunner } from "@/components/profnsi/ExamRunner";

function Router() {
  const r = useRoute();
  if (r.view === "login") return <TeacherLogin />;
  if (r.view === "dashboard") return <TeacherApp />;
  if (r.view === "student") return <StudentAccess />;
  if (r.view === "exam") return <ExamRunner />;
  return <Landing />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>}>
      <Router />
    </Suspense>
  );
}
