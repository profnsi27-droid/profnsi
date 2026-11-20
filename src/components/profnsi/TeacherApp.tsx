"use client";
import { useEffect, useState } from "react";
import { useRoute } from "@/lib/nav";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, ClipboardList, Settings, LogOut, Plus } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { ExamLibrary } from "./ExamLibrary";
import { ExamEditor } from "./ExamEditor";
import { CopiesPanel } from "./CopiesPanel";
import { CopyReview } from "./CopyReview";
import { SettingsPanel } from "./SettingsPanel";

type Tab = "dashboard" | "exams" | "copies" | "settings";

export function TeacherApp() {
  const { go, tab, examId, copyId } = useRoute();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api.getSession().then((r) => {
      if (!r.authenticated) {
        go("login");
      } else {
        setAuthed(true);
      }
    });
  }, [go]);

  async function logout() {
    await api.logout();
    go("landing");
  }

  if (authed === null) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Vérification de la session…
      </div>
    );
  }
  if (!authed) return null;

  const currentTab = (tab as Tab) || "dashboard";

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "exams", label: "Évaluations", icon: FileText },
    { id: "copies", label: "Copies", icon: ClipboardList },
    { id: "settings", label: "Réglages", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-700 text-white grid place-items-center font-bold">P</div>
            <div>
              <div className="font-bold leading-none">PROFNSI</div>
              <div className="text-xs text-muted-foreground mt-0.5">Espace professeur</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => go("landing")}>
              Vue publique
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Déconnexion
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => go("dashboard", { tab: t.id })}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                currentTab === t.id
                  ? "border-teal-700 text-teal-800"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        {currentTab === "dashboard" && <Dashboard />}
        {currentTab === "exams" &&
          (examId ? <ExamEditor examId={examId} /> : <ExamLibrary />)}
        {currentTab === "copies" &&
          (copyId ? <CopyReview copyId={copyId} /> : <CopiesPanel />)}
        {currentTab === "settings" && <SettingsPanel />}
      </main>

      <footer className="border-t bg-background mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>PROFNSI — Plateforme personnelle d'évaluation NSI</span>
          <span>profnsi27@gmail.com</span>
        </div>
      </footer>

      {currentTab === "exams" && !examId && (
        <button
          onClick={() => go("dashboard", { tab: "exams", examId: "new" })}
          className="fixed bottom-6 right-6 rounded-full bg-teal-700 hover:bg-teal-800 text-white shadow-lg h-14 px-5 font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" /> Nouvelle évaluation
        </button>
      )}
    </div>
  );
}
