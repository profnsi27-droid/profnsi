"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Cpu, Mail, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";

export function SettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiModel, setAiModel] = useState("auto");
  const [teacherEmail, setTeacherEmail] = useState("profnsi27@gmail.com");
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [models, setModels] = useState<{ value: string; label: string }[]>([]);
  const [provider, setProvider] = useState<string>("zai");
  const [providerLabel, setProviderLabel] = useState<string>("");

  useEffect(() => {
    api.getSettings().then((r) => {
      setAiModel(r.aiModel);
      setTeacherEmail(r.teacherEmail);
      setEmailConfigured(r.emailConfigured);
      setModels(r.models);
      setProvider(r.provider);
      setProviderLabel(r.providerLabel);
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.saveSettings(aiModel, teacherEmail);
      toast.success("Réglages enregistrés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Réglages</h1>
        <p className="text-sm text-muted-foreground">Configuration de l'agent IA et de l'envoi des copies corrigées.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium"><Cpu className="w-4 h-4 text-teal-700" /> Agent IA de correction</div>
        <div className="space-y-1.5">
          <Label>Modèle IA</Label>
          <Select value={aiModel} onValueChange={setAiModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground flex items-start gap-1.5 mt-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Fournisseur actif : <Badge variant="secondary" className="mx-1 align-middle">{providerLabel || provider}</Badge>
              La clé API est configurée côté serveur. Les élèves ne voient jamais la clé. Le sélecteur permet de
              basculer entre plusieurs modèles selon le besoin (rapidité vs. raisonnement).
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <div className="font-medium text-foreground mb-1">À propos du fournisseur IA</div>
          {provider === "gemini" ? (
            <>L'application utilise <b>Google Gemini</b> (clé <code className="font-mono">GEMINI_API_KEY</code>).
            Quota gratuit généreux, idéal pour un déploiement Vercel. Obtenez une clé gratuite sur
            Google AI Studio.</>
          ) : (
            <>L'environnement fournit le SDK <code className="font-mono">z-ai-web-dev-sdk</code> (modèles GLM, quota
            gratuit, sans clé à saisir). Pour un déploiement Vercel, définissez <code className="font-mono">GEMINI_API_KEY</code>
            pour basculer automatiquement vers Google Gemini.</>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium"><Mail className="w-4 h-4 text-teal-700" /> E-mail du professeur</div>
        <div className="space-y-1.5">
          <Label htmlFor="em">Adresse de réception des copies corrigées</Label>
          <Input id="em" type="email" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          {emailConfigured ? (
            <Badge className="bg-emerald-100 text-emerald-800"><ShieldCheck className="w-3 h-3 mr-1" /> SMTP configuré</Badge>
          ) : (
            <Badge variant="outline" className="text-amber-700 border-amber-300">Mode simulé</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {emailConfigured
              ? "Les PDF seront réellement envoyés par e-mail."
              : "SMTP non configuré : les PDF sont générés et téléchargeables depuis la copie (envoi simulé). Configurez EMAIL_HOST / EMAIL_USER / EMAIL_PASS pour activer l'envoi réel."}
          </span>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer les réglages
        </Button>
      </div>
    </div>
  );
}
