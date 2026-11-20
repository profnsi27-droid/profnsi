"use client";
import { useState } from "react";
import { useRoute } from "@/lib/nav";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TeacherLogin() {
  const { go } = useRoute();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.login(username, password);
      toast.success("Connexion réussie");
      go("dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de connexion");
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
          <h1 className="text-xl font-bold">Espace professeur</h1>
          <p className="text-sm text-muted-foreground mt-1">Accès réservé à l'administrateur unique de la plateforme.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u">Identifiant</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="profnsi" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Mot de passe</Label>
              <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
              Se connecter
            </Button>
          </form>
          <div className="mt-4 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
            Accès strictement réservé au professeur administrateur. Pour définir ou
            modifier vos identifiants définitifs, renseignez les variables
            d'environnement{" "}
            <code className="font-mono">PROFNSI_USERNAME</code> et{" "}
            <code className="font-mono">PROFNSI_PASSWORD</code> côté serveur.
          </div>
        </Card>
      </main>
    </div>
  );
}
