"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRoute } from "@/lib/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardList, FileText, Users, Clock, TrendingUp, Plus, Settings } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { DashboardStats } from "@/lib/types";

export function Dashboard() {
  const { go } = useRoute();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }
  if (!stats) {
    return <div className="py-20 text-center text-muted-foreground">Impossible de charger les statistiques.</div>;
  }

  const cards = [
    { label: "Évaluations", value: stats.examsCount, icon: FileText, color: "text-teal-700 bg-teal-50" },
    { label: "Élèves ayant commencé", value: stats.studentsStarted, icon: Users, color: "text-amber-700 bg-amber-50" },
    { label: "Copies reçues", value: stats.copiesReceived, icon: ClipboardList, color: "text-emerald-700 bg-emerald-50" },
    { label: "Corrections en attente", value: stats.correctionsPending, icon: Clock, color: "text-orange-700 bg-orange-50" },
    { label: "Copies corrigées", value: stats.copiesGraded, icon: ClipboardList, color: "text-teal-700 bg-teal-50" },
    { label: "Moyenne de classe", value: stats.classAverage != null ? `${stats.classAverage.toFixed(2)}/20` : "—", icon: TrendingUp, color: "text-emerald-700 bg-emerald-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de vos évaluations et copies.</p>
        </div>
        <Button onClick={() => go("dashboard", { tab: "exams", examId: "new" })}>
          <Plus className="w-4 h-4 mr-2" /> Nouvelle évaluation
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
              </div>
              <div className={`w-10 h-10 rounded-lg grid place-items-center ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Répartition des notes</h2>
            <div className="text-xs text-muted-foreground">
              {stats.copiesGraded > 0
                ? `Min ${stats.minGrade?.toFixed(1)} · Max ${stats.maxGrade?.toFixed(1)}`
                : "Aucune note"}
            </div>
          </div>
          {stats.copiesGraded > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.gradeDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">
              Les notes apparaîtront ici après correction.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Accès rapide</h2>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => go("dashboard", { tab: "exams" })}>
              <FileText className="w-4 h-4 mr-2" /> Bibliothèque d'évaluations
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => go("dashboard", { tab: "copies" })}>
              <ClipboardList className="w-4 h-4 mr-2" /> Toutes les copies
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => go("dashboard", { tab: "settings" })}>
              <Settings className="w-4 h-4 mr-2" /> Réglages IA & e-mail
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

