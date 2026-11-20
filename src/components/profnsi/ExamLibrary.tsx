"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRoute } from "@/lib/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Users, FileText, Clock, Copy, Trash2, Lock, LockOpen,
  Archive, RefreshCw, Pencil, EyeOff, Eye,
} from "lucide-react";
import type { ExamWithCounts } from "@/lib/types";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  open: "Ouvert",
  closed: "Fermé",
  archived: "Archivé",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-orange-100 text-orange-800",
  archived: "bg-zinc-200 text-zinc-700",
};

export function ExamLibrary() {
  const { go } = useRoute();
  const [exams, setExams] = useState<ExamWithCounts[] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function reload() {
    setExams(null);
    try {
      const res = await api.listExams();
      setExams(res.exams);
    } catch (e) {
      toast.error("Impossible de charger les évaluations");
      setExams([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    api.listExams()
      .then((res) => { if (!cancelled) setExams(res.exams); })
      .catch(() => { if (!cancelled) setExams([]); });
    return () => { cancelled = true; };
  }, []);

  async function action(id: string, action: string, label: string) {
    try {
      await api.examAction(id, action);
      toast.success(label);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.deleteExam(deleteId);
      toast.success("Évaluation supprimée");
      setDeleteId(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Évaluations</h1>
          <p className="text-sm text-muted-foreground">Bibliothèque permanente de vos évaluations NSI.</p>
        </div>
        <Button onClick={() => go("dashboard", { tab: "exams", examId: "new" })}>
          <Plus className="w-4 h-4 mr-2" /> Nouvelle évaluation
        </Button>
      </div>

      {exams === null ? (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <div className="font-medium">Aucune évaluation pour le moment</div>
          <p className="text-sm text-muted-foreground mt-1">
            Créez votre première évaluation pour les classes de Première ou Terminale NSI.
          </p>
          <Button className="mt-4" onClick={() => go("dashboard", { tab: "exams", examId: "new" })}>
            <Plus className="w-4 h-4 mr-2" /> Créer une évaluation
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {exams.map((ex) => (
            <Card key={ex.id} className="p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{ex.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ex.level === "premiere" ? "Première NSI" : "Terminale NSI"} · {ex.duration} min · /{ex.scale}
                  </div>
                </div>
                <Badge className={`${STATUS_COLOR[ex.status]} shrink-0`}>{STATUS_LABEL[ex.status]}</Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {ex.copiesCount} élève(s)</span>
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {ex.submittedCount} reçu(s)</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {ex.gradedCount} corrigé(s)</span>
              </div>

              <div className="mt-3 rounded-md bg-muted/60 px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Code d'accès</div>
                  <div className="font-mono font-bold tracking-widest text-teal-800">{ex.accessCode}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(ex.accessCode);
                    toast.success("Code copié");
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => go("dashboard", { tab: "exams", examId: ex.id })}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Modifier
                </Button>
                {ex.status === "open" ? (
                  <Button size="sm" variant="outline" onClick={() => action(ex.id, "close", "Examen fermé")}>
                    <Lock className="w-3.5 h-3.5 mr-1" /> Fermer
                  </Button>
                ) : ex.status !== "archived" ? (
                  <Button size="sm" variant="outline" onClick={() => action(ex.id, "open", "Examen ouvert")}>
                    <LockOpen className="w-3.5 h-3.5 mr-1" /> Ouvrir
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => action(ex.id, "duplicate", "Évaluation dupliquée")}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Dupliquer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => action(ex.id, "regenerate_code", "Code régénéré")}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Code
                </Button>
                {ex.status === "archived" ? (
                  <Button size="sm" variant="ghost" onClick={() => action(ex.id, "open", "Examen restauré")}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Restaurer
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => action(ex.id, "archive", "Examen archivé")}>
                    <Archive className="w-3.5 h-3.5 mr-1" /> Archiver
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(ex.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                </Button>
              </div>

              <Button size="sm" variant="secondary" className="mt-2" onClick={() => go("dashboard", { tab: "copies", examId: ex.id })}>
                <EyeOff className="w-3.5 h-3.5 mr-1" /> Voir les copies
              </Button>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette évaluation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera l'évaluation et toutes les copies associées. Cette opération est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
