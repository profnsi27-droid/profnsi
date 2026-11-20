"use client";
import { useRoute } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpenCheck, GraduationCap, ShieldCheck, Cpu, FileText, MailCheck } from "lucide-react";

export function Landing() {
  const { go } = useRoute();
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-teal-50 via-background to-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-teal-700 text-white grid place-items-center font-bold">P</div>
            <div>
              <div className="font-bold text-lg leading-none">PROFNSI</div>
              <div className="text-xs text-muted-foreground leading-none mt-0.5">Évaluation NSI · Première & Terminale</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => go("student")}>Accès élève</Button>
            <Button size="sm" onClick={() => go("login")}>Espace professeur</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-medium mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Plateforme personnelle — un seul professeur
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
            Créez, diffusez et corrigez vos évaluations NSI avec un agent IA
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Importez un sujet PDF, générez un code d'accès, laissez vos élèves
            composer dans un environnement professionnel (Python via Pyodide,
            éditeur de code, QCM, tableaux), puis obtenez une correction
            détaillée et une note sur 20.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => go("login")}>
              <GraduationCap className="w-4 h-4 mr-2" /> Ouvrir mon espace professeur
            </Button>
            <Button size="lg" variant="outline" onClick={() => go("student")}>
              <BookOpenCheck className="w-4 h-4 mr-2" /> Je suis élève
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-14">
          {[
            { icon: FileText, title: "Sujet PDF intégré", desc: "Lecteur PDF à gauche, espace de travail à droite, défilement indépendant et redimensionnable." },
            { icon: Cpu, title: "Python en ligne (Pyodide)", desc: "Éditeur Monaco avec exécution réelle du code Python et console de résultats." },
            { icon: ShieldCheck, title: "Surveillance anti-triche", desc: "Journal des changements d'onglet, sorties plein écran et pertes de focus, sans webcam ni micro." },
            { icon: BookOpenCheck, title: "Correction IA spécialisée NSI", desc: "Agent expert des programmes officiels de Première et Terminale, respect du barème." },
            { icon: MailCheck, title: "Copie corrigée par e-mail", desc: "PDF professionnel généré et envoyé automatiquement à profnsi27@gmail.com." },
            { icon: GraduationCap, title: "Sans inscription élève", desc: "L'élève saisit nom, prénom, classe et code d'accès, puis compose immédiatement." },
          ].map((f) => (
            <Card key={f.title} className="p-5">
              <f.icon className="w-6 h-6 text-teal-700 mb-3" />
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.desc}</div>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t bg-background mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PROFNSI — Plateforme personnelle d'évaluation NSI</span>
          <span>profnsi27@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}
