"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRoute } from "@/lib/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, Copy as CopyIcon, RefreshCw,
  LockOpen, Lock, Upload, FileText, GripVertical,
} from "lucide-react";
import type { ExamWithCounts, ExerciseDef, CellType, Level } from "@/lib/types";
import { toast } from "sonner";

const CELL_TYPES: { value: CellType; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "text", label: "Texte" },
  { value: "image", label: "Image" },
  { value: "qcm", label: "QCM" },
  { value: "table", label: "Tableau" },
];

function newExercise(): ExerciseDef {
  return {
    id: `exo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Nouvel exercice",
    allowedTypes: ["python", "text"],
    points: 4,
    prompt: "",
  };
}

export function ExamEditor({ examId }: { examId: string }) {
  const { go } = useRoute();
  const isNew = examId === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamWithCounts | null>(null);

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<Level>("terminale");
  const [duration, setDuration] = useState(120);
  const [scale, setScale] = useState(20);
  const [instructions, setInstructions] = useState("");
  const [competences, setCompetences] = useState("");
  const [subjectPdf, setSubjectPdf] = useState<string | null>(null);
  const [correctionPdf, setCorrectionPdf] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseDef[]>([newExercise()]);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getExam(examId)
      .then((r) => {
        const e = r.exam;
        setExam(e);
        setTitle(e.title);
        setLevel(e.level);
        setDuration(e.duration);
        setScale(e.scale);
        setInstructions(e.instructions || "");
        setCompetences(e.competences ? JSON.parse(e.competences).join(", ") : "");
        setSubjectPdf(e.subjectPdf);
        setCorrectionPdf(e.correctionPdf);
        setExercises(e.exercises.length ? e.exercises : [newExercise()]);
      })
      .catch(() => toast.error("Évaluation introuvable"))
      .finally(() => setLoading(false));
  }, [examId, isNew]);

  const totalPoints = exercises.reduce((s, e) => s + (Number(e.points) || 0), 0);

  function updateEx(idx: number, patch: Partial<ExerciseDef>) {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function addEx() {
    setExercises((prev) => [...prev, newExercise()]);
  }
  function removeEx(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }
  function dupEx(idx: number) {
    setExercises((prev) => {
      const copy = { ...prev[idx], id: `exo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: `${prev[idx].title} (copie)` };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }
  function toggleType(idx: number, t: CellType) {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== idx) return e;
        const has = e.allowedTypes.includes(t);
        const allowedTypes = has
          ? e.allowedTypes.filter((x) => x !== t)
          : [...e.allowedTypes, t];
        return { ...e, allowedTypes };
      })
    );
  }

  async function uploadPdf(file: File, kind: "exam" | "correction") {
    setUploading(kind);
    try {
      const res = await api.uploadFile(file, kind);
      if (res.error) throw new Error(res.error);
      if (kind === "exam") setSubjectPdf(res.path);
      else setCorrectionPdf(res.path);
      toast.success("Fichier importé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import échoué");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    if (!subjectPdf) {
      toast.error("Importez le sujet PDF");
      return;
    }
    setSaving(true);
    const comps = competences
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      if (isNew) {
        const r = await api.createExam({
          title, level, duration, scale, instructions, competences: comps.length ? comps : null, exercises,
        });
        // uploader les PDF après création
        const id = r.exam.id;
        if (subjectPdf) await api.updateExam(id, { subjectPdf });
        if (correctionPdf) await api.updateExam(id, { correctionPdf });
        toast.success("Évaluation créée");
        go("dashboard", { tab: "exams", examId: id });
      } else if (exam) {
        await api.updateExam(exam.id, {
          title, level, duration, scale, instructions,
          competences: comps.length ? comps : null,
          exercises, subjectPdf, correctionPdf,
        });
        toast.success("Évaluation enregistrée");
        const r = await api.getExam(exam.id);
        setExam(r.exam);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement échoué");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => go("dashboard", { tab: "exams" })}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <h1 className="text-2xl font-bold">{isNew ? "Nouvelle évaluation" : "Modifier l'évaluation"}</h1>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre de l'évaluation</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : DS3 — Listes et dictionnaires" />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Niveau</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="premiere">Première NSI</SelectItem>
                  <SelectItem value="terminale">Terminale NSI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dur">Durée (min)</Label>
              <Input id="dur" type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scale">Barème</Label>
              <Input id="scale" type="number" min={1} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comp">Compétences évaluées (séparées par des virgules)</Label>
            <Input id="comp" value={competences} onChange={(e) => setCompetences(e.target.value)} placeholder="Ex : types construits, dictionnaires, complexité" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instr">Consignes générales</Label>
            <Textarea id="instr" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="Consignes affichées à l'élève au début de l'épreuve…" />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-teal-700" /> Sujet PDF</div>
            <PdfUploadButton
              value={subjectPdf}
              uploading={uploading === "exam"}
              onFile={(f) => uploadPdf(f, "exam")}
              label="Importer le sujet PDF"
            />
            <div className="font-medium flex items-center gap-2 mt-2"><FileText className="w-4 h-4 text-muted-foreground" /> Corrigé officiel (facultatif)</div>
            <PdfUploadButton
              value={correctionPdf}
              uploading={uploading === "correction"}
              onFile={(f) => uploadPdf(f, "correction")}
              label="Importer le corrigé (référence IA)"
            />
          </div>
        </Card>

        <Card className="p-5 space-y-3 h-fit">
          <div className="font-medium">Accès & état</div>
          {!isNew && exam ? (
            <>
              <div className="rounded-md bg-muted/60 p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Code d'accès</div>
                <div className="font-mono font-bold tracking-widest text-lg text-teal-800">{exam.accessCode}</div>
                <div className="flex gap-1.5 mt-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(exam.accessCode); toast.success("Copié"); }}>
                    <CopyIcon className="w-3.5 h-3.5 mr-1" /> Copier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    try { const r = await api.examAction(exam.id, "regenerate_code"); setExam(r.exam); toast.success("Code régénéré"); }
                    catch (e) { toast.error("Échec"); }
                  }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Régénérer
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                {exam.status === "open" ? (
                  <Button variant="outline" size="sm" className="flex-1" onClick={async () => { const r = await api.examAction(exam.id, "close"); setExam(r.exam); toast.success("Examen fermé"); }}>
                    <Lock className="w-4 h-4 mr-1" /> Fermer
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1" onClick={async () => { const r = await api.examAction(exam.id, "open"); setExam(r.exam); toast.success("Examen ouvert"); }}>
                    <LockOpen className="w-4 h-4 mr-1" /> Ouvrir
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Statut actuel : <Badge variant="secondary">{exam.status}</Badge>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              Le code d'accès est généré automatiquement à la création.
            </div>
          )}
          <Separator />
          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total points exercices</span>
              <span className={`font-bold ${totalPoints === scale ? "text-emerald-700" : "text-orange-700"}`}>{totalPoints} / {scale}</span>
            </div>
            {totalPoints !== scale && (
              <div className="text-xs text-orange-700 mt-1">
                La somme des points des exercices ({totalPoints}) diffère du barème ({scale}).
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-medium">Exercices</div>
            <div className="text-xs text-muted-foreground">Définissez les énoncés et les types de réponses autorisés.</div>
          </div>
          <Button size="sm" variant="outline" onClick={addEx}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
        </div>

        <div className="space-y-3">
          {exercises.map((ex, idx) => (
            <div key={ex.id} className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-3" />
                <div className="flex-1 grid gap-3">
                  <div className="grid sm:grid-cols-[1fr_120px] gap-3">
                    <Input value={ex.title} onChange={(e) => updateEx(idx, { title: e.target.value })} placeholder="Titre de l'exercice" />
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} value={ex.points} onChange={(e) => updateEx(idx, { points: Number(e.target.value) })} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">pts</span>
                    </div>
                  </div>
                  <Textarea value={ex.prompt} onChange={(e) => updateEx(idx, { prompt: e.target.value })} rows={2} placeholder="Énoncé / consigne de l'exercice…" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Types de réponses autorisés</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CELL_TYPES.map((t) => {
                        const active = ex.allowedTypes.includes(t.value);
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => toggleType(idx, t.value)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              active ? "bg-teal-700 text-white border-teal-700" : "bg-background border-border hover:bg-muted"
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {ex.allowedTypes.includes("qcm") && (
                    <QcmEditor ex={ex} idx={idx} onChange={(opts) => updateEx(idx, { qcmOptions: opts })} />
                  )}
                  {ex.allowedTypes.includes("table") && (
                    <TableSpecEditor ex={ex} idx={idx} onChange={(patch) => updateEx(idx, patch)} />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={() => dupEx(idx)}><CopyIcon className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeEx(idx)} disabled={exercises.length === 1}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PdfUploadButton({
  value, uploading, onFile, label,
}: { value: string | null; uploading: boolean; onFile: (f: File) => void; label: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-background hover:bg-muted cursor-pointer text-sm">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {label}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
      </label>
      {value && (
        <Badge variant="secondary" className="gap-1">
          <FileText className="w-3 h-3" /> PDF importé
        </Badge>
      )}
    </div>
  );
}

function QcmEditor({ ex, idx, onChange }: { ex: ExerciseDef; idx: number; onChange: (opts: ExerciseDef["qcmOptions"]) => void }) {
  const opts = ex.qcmOptions || [];
  return (
    <div className="rounded-md border p-3 bg-background space-y-2">
      <div className="text-xs font-medium">Options QCM (cochez les réponses correctes)</div>
      {opts.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={o.correct}
            onChange={(e) => onChange(opts.map((x, j) => (j === i ? { ...x, correct: e.target.checked } : x)))}
            className="w-4 h-4"
          />
          <Input
            value={o.label}
            onChange={(e) => onChange(opts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            placeholder={`Option ${i + 1}`}
            className="h-8"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange(opts.filter((_, j) => j !== i))}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...opts, { id: `opt-${Date.now()}-${idx}`, label: "", correct: false }])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Option
      </Button>
    </div>
  );
}

function TableSpecEditor({ ex, onChange }: { ex: ExerciseDef; idx: number; onChange: (patch: Partial<ExerciseDef>) => void }) {
  const cols = ex.tableColumns || [];
  return (
    <div className="rounded-md border p-3 bg-background space-y-2">
      <div className="text-xs font-medium">Structure du tableau attendu</div>
      <Input
        value={cols.join(", ")}
        onChange={(e) => onChange({ tableColumns: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder="En-têtes de colonnes séparés par des virgules"
      />
      <div className="flex items-center gap-2">
        <Label className="text-xs">Nombre de lignes</Label>
        <Input
          type="number"
          min={1}
          value={ex.tableRows || 3}
          onChange={(e) => onChange({ tableRows: Number(e.target.value) })}
          className="h-8 w-24"
        />
      </div>
    </div>
  );
}
