"use client";
import { useState } from "react";
import { useRoute } from "@/lib/nav";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function StudentAccess() {
  const { go } = useRoute();
  const [firstname, setFirstname] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.studentAccess({ name, firstname, className, code });
      toast.success(res.resumed ? "Reprise de votre session" : "Accès autorisé");
      go("exam", { session: res.session });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-teal-50 to-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => go("landing")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white grid place-items-center font-bold text-sm">P</div>
            <span className="font-bold">PROFNSI</span>
          </div>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-10">
        <Card className="w-full max-w-md p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-5 h-5 text-teal-700" />
            <h1 className="text-xl font-bold">Accès à l'évaluation</h1>
          </div>
          <p className="text-sm text-muted-foreground">Saisissez votre identité et le code d'accès communiqué par votre professeur.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Prénom</Label>
                <Input id="fn" value={firstname} onChange={(e) => setFirstname(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nom</Label>
                <Input id="ln" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl">Classe</Label>
              <Input id="cl" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Ex : Terminale 3" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code d'accès à l'examen</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EX : AB3K7Q"
                className="font-mono tracking-widest uppercase"
                maxLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Commencer l'évaluation
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Aucun compte permanent n'est requis. Vos réponses sont sauvegardées
            automatiquement et associées à un identifiant de session unique.
          </p>
        </Card>
      </main>
    </div>
  );
}
