"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRoute } from "@/lib/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Eye, ClipboardList, RefreshCw } from "lucide-react";
import type { CopyDetail, ExamWithCounts } from "@/lib/types";
import { toast } from "sonner";

const STATUS: Record<string, string> = {
  in_progress: "En cours",
  submitted: "Soumise",
  grading: "Correction…",
  graded: "Corrigée",
  validated: "Validée",
};
const STATUS_COLOR: Record<string, string> = {
  in_progress: "bg-zinc-100 text-zinc-700",
  submitted: "bg-amber-100 text-amber-800",
  grading: "bg-sky-100 text-sky-800",
  graded: "bg-teal-100 text-teal-800",
  validated: "bg-emerald-100 text-emerald-800",
};

export function CopiesPanel() {
  const { go, examId } = useRoute();
  const [copies, setCopies] = useState<CopyDetail[] | null>(null);
  const [exams, setExams] = useState<ExamWithCounts[]>([]);
  const [filter, setFilter] = useState<string>(examId || "all");

  async function reload() {
    setCopies(null);
    try {
      const r = await api.listCopies(filter !== "all" ? filter : undefined);
      setCopies(r.copies);
    } catch {
      setCopies([]);
    }
  }

  useEffect(() => {
    api.listExams().then((r) => setExams(r.exams)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.listCopies(filter !== "all" ? filter : undefined)
      .then((r) => { if (!cancelled) setCopies(r.copies); })
      .catch(() => { if (!cancelled) setCopies([]); });
    return () => { cancelled = true; };
  }, [filter]);

  async function exportCsv() {
    if (filter === "all") {
      toast.error("Sélectionnez une évaluation pour exporter.");
      return;
    }
    try {
      const token = localStorage.getItem("profnsi_token");
      const res = await fetch("/api/copy-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-profnsi-token": token } : {}),
        },
        body: JSON.stringify({ id: filter, action: "export_csv", examId: filter }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resultats.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export échoué");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Copies</h1>
          <p className="text-sm text-muted-foreground">Toutes les copies reçues, filtrables par évaluation.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Toutes les évaluations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les évaluations</SelectItem>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={reload}><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={exportCsv} disabled={filter === "all"}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {copies === null ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : copies.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Aucune copie.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Élève</th>
                  <th className="text-left font-medium px-4 py-2.5">Classe</th>
                  <th className="text-left font-medium px-4 py-2.5">Évaluation</th>
                  <th className="text-left font-medium px-4 py-2.5">Note</th>
                  <th className="text-left font-medium px-4 py-2.5">Statut</th>
                  <th className="text-right font-medium px-4 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {copies.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.studentFirstname} {c.studentName}</div>
                    </td>
                    <td className="px-4 py-2.5">{c.className}</td>
                    <td className="px-4 py-2.5">{c.examTitle}</td>
                    <td className="px-4 py-2.5">
                      {c.grade != null ? (
                        <span className={`font-bold ${c.grade >= 10 ? "text-emerald-700" : "text-orange-700"}`}>{c.grade.toFixed(2)}/{c.scale}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5"><Badge className={STATUS_COLOR[c.status]}>{STATUS[c.status]}</Badge></td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => go("dashboard", { tab: "copies", copyId: c.id })}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Consulter
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
