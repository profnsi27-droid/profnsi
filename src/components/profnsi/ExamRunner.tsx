"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRoute } from "@/lib/nav";
import { api } from "@/lib/api";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Clock, Send, CheckCircle2, AlertCircle, LogOut, ShieldAlert,
} from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { PythonCell } from "./cells/PythonCell";
import { TextCell, ImageCell, QcmCell, TableCell } from "./cells/WorkCells";
import type { ExerciseDef, AnswerCell, CellType, AntiCheatEvent } from "@/lib/types";
import { fileUrl } from "@/lib/file-url";
import { toast } from "sonner";

interface StudentExamData {
  session: string;
  copyId: string;
  status: string;
  student: { name: string; firstname: string; className: string };
  exam: {
    id: string;
    title: string;
    level: string;
    duration: number;
    scale: number;
    instructions: string | null;
    exercises: ExerciseDef[];
    subjectPdf: string | null;
    competences: string | null;
  };
  startTime: string;
  answers: Record<string, AnswerCell>;
}

const CELL_LABEL: Record<CellType, string> = {
  python: "Code Python",
  text: "Réponse rédigée",
  image: "Image(s)",
  qcm: "QCM",
  table: "Tableau",
};

function fmtTime(ms: number) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ExamRunner() {
  const { session, go } = useRoute();
  const [data, setData] = useState<StudentExamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerCell>>({});
  const [now, setNow] = useState(Date.now());
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [eventsCount, setEventsCount] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef<Record<string, AnswerCell>>({});
  const sessionRef = useRef<string>(session);
  answersRef.current = answers;

  // chargement initial
  useEffect(() => {
    if (!session) {
      setError("Session manquante");
      return;
    }
    sessionRef.current = session;
    api.getStudentExam(session)
      .then((d) => {
        setData(d);
        setAnswers(d.answers || {});
        if (d.status !== "in_progress") setSubmitted(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Session invalide"));
  }, [session]);

  // horloge
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const endTime = useMemo(() => {
    if (!data) return 0;
    return new Date(data.startTime).getTime() + data.exam.duration * 60000;
  }, [data]);

  const remaining = endTime - now;
  const totalMs = data ? data.exam.duration * 60000 : 1;
  const progressPct = data ? Math.min(100, Math.max(0, ((totalMs - remaining) / totalMs) * 100)) : 0;

  // auto-soumission à la fin du temps
  useEffect(() => {
    if (data && remaining <= 0 && !submitted && !submitting) {
      doSubmit(true);
    }
  }, [remaining, data, submitted, submitting]);

  // anti-triche : changements d'onglet / focus / plein écran
  const logEvent = useCallback((type: AntiCheatEvent["type"], detail?: string) => {
    if (!sessionRef.current) return;
    api.studentEvent(sessionRef.current, { type, ts: new Date().toISOString(), detail }).catch(() => {});
    setEventsCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!data || submitted) return;
    const onVis = () => { if (document.hidden) logEvent("tab_change", "Changement d'onglet / fenêtre"); };
    const onBlur = () => logEvent("focus_loss", "Perte de focus de la fenêtre");
    const onFs = () => { if (!document.fullscreenElement) logEvent("fullscreen_exit", "Sortie du mode plein écran"); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [data, submitted, logEvent]);

  // autosave
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!sessionRef.current) return;
      try {
        const r = await api.studentSave(sessionRef.current, answersRef.current);
        setLastSaved(r.savedAt);
      } catch {
        // silencieux
      }
    }, 1200);
  }, []);

  function updateCell(key: string, exerciseId: string, type: CellType, patch: Partial<AnswerCell>) {
    setAnswers((prev) => {
      const existing = prev[key] || { id: key, exerciseId, type };
      const next = { ...existing, ...patch, exerciseId, type, id: key };
      return { ...prev, [key]: next };
    });
    scheduleSave();
  }

  async function doSubmit(auto = false) {
    if (!sessionRef.current || submitting || submitted) return;
    setSubmitting(true);
    // sauvegarde finale
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await api.studentSave(sessionRef.current, answersRef.current);
    } catch {
      // continue
    }
    try {
      await api.studentSubmit(sessionRef.current);
      setSubmitted(true);
      if (auto) toast.info("Temps écoulé : votre copie a été soumise automatiquement.");
      else toast.success("Copie soumise avec succès");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la soumission");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
          <div className="font-semibold">{error}</div>
          <Button className="mt-4" variant="outline" onClick={() => go("student")}>Retour à l'accès élève</Button>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center p-4 bg-muted/30">
        <Card className="p-8 max-w-md text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600 mb-4" />
          <h1 className="text-xl font-bold">Copie soumise</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Votre copie a été verrouillée et transmise à votre professeur. Elle sera
            corrigée par l'agent IA puis validée. Vous pouvez fermer cette page.
          </p>
          <div className="mt-4 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
            Session : <span className="font-mono">{session}</span>
          </div>
          <Button className="mt-5" variant="outline" onClick={() => go("landing")}>
            <LogOut className="w-4 h-4 mr-2" /> Quitter
          </Button>
        </Card>
      </div>
    );
  }

  const overTime = remaining <= 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-muted/30">
      <header className="border-b bg-background shrink-0">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white grid place-items-center font-bold text-sm shrink-0">P</div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{data.exam.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {data.student.firstname} {data.student.name} · {data.student.className}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-sm font-mono font-semibold ${overTime ? "text-destructive" : remaining < 5 * 60000 ? "text-orange-600" : "text-muted-foreground"}`}>
              <Clock className="w-4 h-4" />
              {overTime ? "Temps écoulé" : fmtTime(remaining)}
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> {eventsCount}
            </Badge>
            <Button onClick={() => setShowConfirm(true)} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Soumettre
            </Button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <Progress value={progressPct} className="h-1" />
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={45} minSize={25}>
          {data.exam.subjectPdf ? (
            <PdfViewer url={fileUrl(data.exam.subjectPdf)} title={data.exam.title} />
          ) : (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">Aucun sujet PDF.</div>
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="h-full overflow-y-auto bg-background">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
              {data.exam.instructions && (
                <Card className="p-3 bg-teal-50 border-teal-200">
                  <div className="text-xs font-semibold text-teal-800 mb-1">Consignes</div>
                  <div className="text-sm whitespace-pre-wrap text-teal-900">{data.exam.instructions}</div>
                </Card>
              )}

              {lastSaved && (
                <div className="text-xs text-muted-foreground text-right">
                  Dernière sauvegarde : {new Date(lastSaved).toLocaleTimeString("fr-FR")}
                </div>
              )}

              {data.exam.exercises.map((exo, i) => (
                <Card key={exo.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold">Exercice {i + 1} — {exo.title}</div>
                    <Badge variant="outline">{exo.points} pts</Badge>
                  </div>
                  {exo.prompt && <div className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{exo.prompt}</div>}
                  <div className="space-y-3">
                    {exo.allowedTypes.map((type) => {
                      const key = `${exo.id}:${type}`;
                      const cell = answers[key];
                      return (
                        <div key={type}>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">{CELL_LABEL[type]}</div>
                          {type === "python" && (
                            <PythonCell
                              code={cell?.code || ""}
                              output={cell?.output}
                              onChange={(code, output) => updateCell(key, exo.id, "python", { code, ...(output !== undefined ? { output } : {}) })}
                              onRun={() => logEvent("code_run", `Exécution Python — ${exo.title}`)}
                            />
                          )}
                          {type === "text" && (
                            <TextCell value={cell?.text || ""} onChange={(text) => updateCell(key, exo.id, "text", { text })} />
                          )}
                          {type === "image" && (
                            <ImageCell
                              session={session}
                              images={cell?.images || []}
                              onChange={(images) => updateCell(key, exo.id, "image", { images })}
                            />
                          )}
                          {type === "qcm" && (
                            <QcmCell
                              options={exo.qcmOptions || []}
                              selected={cell?.selectedOptions || []}
                              onChange={(selectedOptions) => updateCell(key, exo.id, "qcm", { selectedOptions })}
                            />
                          )}
                          {type === "table" && (
                            <TableCell
                              columns={exo.tableColumns || []}
                              rows={exo.tableRows || 3}
                              data={cell?.table || []}
                              onChange={(table) => updateCell(key, exo.id, "table", { table })}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}

              <div className="pt-2 pb-6 flex justify-center">
                <Button size="lg" onClick={() => setShowConfirm(true)} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Soumettre ma copie
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soumettre définitivement votre copie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Après soumission, votre copie sera verrouillée et vous ne pourrez plus modifier vos réponses.
              Vos dernières saisies sont enregistrées automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuer à composer</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSubmit(false)} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Confirmer et soumettre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
