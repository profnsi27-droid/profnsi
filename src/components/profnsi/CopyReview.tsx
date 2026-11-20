"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRoute } from "@/lib/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Loader2, Sparkles, FileCheck2, Mail, Download, ShieldAlert,
  ClipboardCheck, Clock, AlertTriangle,
} from "lucide-react";
import type { CopyDetail } from "@/lib/types";
import { fileUrl } from "@/lib/file-url";
import { toast } from "sonner";

const STATUS: Record<string, string> = {
  in_progress: "En cours",
  submitted: "Soumise",
  grading: "Correction en cours…",
  graded: "Corrigée par l'IA",
  validated: "Validée",
};

export function CopyReview({ copyId }: { copyId: string }) {
  const { go } = useRoute();
  const [copy, setCopy] = useState<CopyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const r = await api.getCopy(copyId);
      setCopy(r.copy);
      setGradeInput(r.copy.grade != null ? r.copy.grade.toFixed(2) : "");
    } catch {
      toast.error("Copie introuvable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [copyId]);

  async function runGrade() {
    setBusy("grade");
    try {
      const res = await api.copyAction(copyId, "grade");
      if (res.ok) {
        toast.success("Correction IA terminée");
      } else {
        toast.error((res as { error?: string }).error || "Échec de la correction");
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(null);
    }
  }

  async function generatePdf() {
    setBusy("pdf");
    try {
      const res = await api.copyAction(copyId, "pdf");
      if (!res.ok) throw new Error((res as { error?: string }).error);
      toast.success("PDF de correction généré");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(null);
    }
  }

  async function sendEmail() {
    setBusy("email");
    try {
      const res = await api.copyAction(copyId, "email");
      if (res.ok) {
        if (res.simulated) {
          toast.info("Envoi simulé : SMTP non configuré — le PDF reste téléchargeable ici.");
        } else {
          toast.success("E-mail envoyé à profnsi27@gmail.com");
        }
      } else {
        toast.error((res as { error?: string }).error || "Échec de l'envoi");
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(null);
    }
  }

  async function saveGrade() {
    const g = Number(gradeInput);
    if (Number.isNaN(g)) {
      toast.error("Note invalide");
      return;
    }
    try {
      await api.updateCopy(copyId, { grade: g });
      toast.success("Note enregistrée");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  }

  async function validate() {
    try {
      await api.updateCopy(copyId, { validate: true });
      toast.success("Note validée");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  }

  if (loading) {
    return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }
  if (!copy) {
    return <div className="py-20 text-center text-muted-foreground">Copie introuvable.</div>;
  }

  const canGrade = copy.status === "submitted" || copy.status === "graded";
  const submitted = copy.status !== "in_progress";

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => go("dashboard", { tab: "copies" })}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <h1 className="text-2xl font-bold">{copy.studentFirstname} {copy.studentName}</h1>
        </div>
        <Badge>{STATUS[copy.status]}</Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-5">
          <div>
            <div className="text-sm text-muted-foreground">{copy.examTitle}</div>
            <div className="text-xs text-muted-foreground">
              {copy.level === "premiere" ? "Première NSI" : "Terminale NSI"} · {copy.className} · barème /{copy.scale}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Début : {new Date(copy.startTime).toLocaleString("fr-FR")}</span>
              {copy.endTime && <span className="flex items-center gap-1"><FileCheck2 className="w-3.5 h-3.5" /> Soumis : {new Date(copy.endTime).toLocaleString("fr-FR")}</span>}
            </div>
          </div>

          <Separator />

          {/* Réponses de l'élève */}
          <div>
            <div className="font-medium mb-2">Réponses de l'élève</div>
            {copy.exercises.map((exo) => {
              const cells = Object.values(copy.answers).filter((c) => c.exerciseId === exo.id);
              return (
                <div key={exo.id} className="mb-4 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{exo.title}</div>
                    <Badge variant="outline">{exo.points} pts</Badge>
                  </div>
                  {exo.prompt && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{exo.prompt}</div>}
                  {cells.length === 0 ? (
                    <div className="text-xs text-muted-foreground mt-2 italic">Aucune réponse.</div>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {cells.map((c) => (
                        <div key={c.id}>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">{c.type}</div>
                          {c.type === "python" && (
                            <>
                              <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-md p-3 overflow-x-auto whitespace-pre-wrap font-mono">{c.code || "(vide)"}</pre>
                              {c.output && (
                                <div className="mt-1">
                                  <div className="text-[10px] text-muted-foreground">Sortie console</div>
                                  <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono">{c.output}</pre>
                                </div>
                              )}
                            </>
                          )}
                          {c.type === "text" && (
                            <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-2">{c.text || "(vide)"}</div>
                          )}
                          {c.type === "qcm" && (
                            <div className="text-sm">Choix : {(c.selectedOptions || []).map((id) => exo.qcmOptions?.find((o) => o.id === id)?.label || id).join(", ") || "(aucun)"}</div>
                          )}
                          {c.type === "table" && (
                            <div className="overflow-x-auto">
                              <table className="text-xs border-collapse">
                                <tbody>
                                  {(c.table || []).map((row, i) => (
                                    <tr key={i}>
                                      {row.map((cell, j) => (
                                        <td key={j} className="border px-2 py-1">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {c.type === "image" && (
                            <div className="flex flex-wrap gap-2">
                              {(c.images || []).map((img, i) => (
                                <div key={i} className="border rounded p-1">
                                  <img src={fileUrl(img.path)} alt={img.caption || ""} className="max-h-40 rounded" />
                                  {img.caption && <div className="text-[10px] text-muted-foreground mt-1">{img.caption}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Note + actions */}
          <Card className="p-5 space-y-3">
            <div className="font-medium flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-teal-700" /> Note & validation</div>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.25" min={0} max={copy.scale} value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} className="w-28" />
              <span className="text-sm text-muted-foreground">/ {copy.scale}</span>
              <Button size="sm" variant="outline" onClick={saveGrade}>Enregistrer</Button>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={runGrade} disabled={!canGrade || busy === "grade"}>
                {busy === "grade" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {copy.correction ? "Relancer la correction IA" : "Lancer la correction IA"}
              </Button>
              {!submitted && <div className="text-xs text-muted-foreground">La copie doit être soumise avant correction.</div>}
              {copy.status === "graded" && (
                <Button variant="outline" onClick={validate}><FileCheck2 className="w-4 h-4 mr-2" /> Valider la note</Button>
              )}
            </div>
          </Card>

          {/* PDF & email */}
          <Card className="p-5 space-y-2">
            <div className="font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-teal-700" /> PDF & envoi</div>
            <Button variant="outline" className="w-full justify-start" onClick={generatePdf} disabled={busy === "pdf" || !copy.correction}>
              {busy === "pdf" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck2 className="w-4 h-4 mr-2" />}
              Générer le PDF corrigé
            </Button>
            {copy.correctionPdf && (
              <Button variant="outline" className="w-full justify-start" onClick={() => window.open(fileUrl(copy.correctionPdf!), "_blank")}>
                <Download className="w-4 h-4 mr-2" /> Télécharger le PDF
              </Button>
            )}
            <Button variant="outline" className="w-full justify-start" onClick={sendEmail} disabled={busy === "email" || !copy.correction}>
              {busy === "email" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Envoyer par e-mail
            </Button>
            {copy.emailSent && (
              <div className="text-xs text-muted-foreground">
                {copy.emailError ? `Envoi : ${copy.emailError}` : "E-mail envoyé à profnsi27@gmail.com"}
              </div>
            )}
          </Card>

          {/* Journal anti-triche */}
          <Card className="p-5">
            <div className="font-medium flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4 text-amber-600" /> Journal de surveillance</div>
            {copy.events.length === 0 ? (
              <div className="text-xs text-muted-foreground">Aucun événement enregistré.</div>
            ) : (
              <div className="max-h-48 overflow-y-auto text-xs space-y-1">
                {copy.events.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground whitespace-nowrap">{new Date(ev.ts).toLocaleTimeString("fr-FR")}</span>
                    <span className="font-medium">{ev.type}</span>
                    {ev.detail && <span className="text-muted-foreground">— {ev.detail}</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground mt-2">À titre indicatif — ne préjuge pas d'une fraude.</div>
          </Card>
        </div>
      </div>

      {/* Correction IA détaillée */}
      {copy.correction && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-teal-700" /> Correction de l'agent IA</div>
            <div className="text-2xl font-bold text-teal-700">{copy.grade?.toFixed(2)}/{copy.scale}</div>
          </div>

          {copy.correction.needsManualReview && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Réponses à vérifier manuellement</div>
                {copy.correction.manualReviewNotes && <div className="mt-0.5">{copy.correction.manualReviewNotes}</div>}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {copy.correction.breakdown.map((b) => (
              <div key={b.exerciseId} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{b.exerciseTitle}</div>
                  <div className="text-sm font-bold">{b.points.toFixed(2)} / {b.max.toFixed(2)}</div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{b.justification}</div>
                {b.errors.length > 0 && (
                  <ul className="mt-2 text-xs list-disc pl-5 space-y-0.5 text-orange-800">
                    {b.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {copy.correction.detailedCorrection && (
            <div>
              <div className="font-medium mb-1">Correction détaillée</div>
              <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-3">{copy.correction.detailedCorrection}</div>
            </div>
          )}

          {copy.correction.competencies.length > 0 && (
            <div>
              <div className="font-medium mb-2">Bilan des compétences</div>
              <div className="flex flex-wrap gap-2">
                {copy.correction.competencies.map((c, i) => (
                  <Badge key={i} variant="outline" className={c.level === "acquis" ? "text-emerald-700 border-emerald-300" : c.level === "partiel" ? "text-amber-700 border-amber-300" : "text-red-700 border-red-300"}>
                    {c.name} · {c.level === "acquis" ? "acquis" : c.level === "partiel" ? "partiel" : "non acquis"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {copy.correction.advice && (
            <div>
              <div className="font-medium mb-1">Conseils de progression</div>
              <div className="text-sm whitespace-pre-wrap bg-teal-50 rounded-md p-3 text-teal-900">{copy.correction.advice}</div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
