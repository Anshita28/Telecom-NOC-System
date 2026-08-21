import { useQuery } from "@tanstack/react-query";
import { Brain, Cpu, Radar, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchModelsAnalytics } from "@/lib/api";
import type { ClassifierMetrics } from "@/lib/api";

const MODEL_META: Record<string, { family: string; role: string }> = {
  random_forest: { family: "ML", role: "Tabular severity (bagging)" },
  xgboost: { family: "ML", role: "Tabular severity (boosting)" },
  svm: { family: "ML", role: "PCA + calibrated Linear SVM" },
  lstm: { family: "DL", role: "Log-burst sequence severity" },
  gru: { family: "DL", role: "Log-burst sequence severity" },
  autoencoder: { family: "DL", role: "Unsupervised early-warning anomaly" },
};

export default function ModelsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["models-analytics"],
    queryFn: fetchModelsAnalytics,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  const models = (data.models ?? {}) as Record<string, ClassifierMetrics>;
  const chartData = ["random_forest", "xgboost", "svm", "lstm", "gru"].map((name) => ({
    name: name.replace("_", " "),
    Accuracy: Number((((models[name]?.accuracy ?? 0) as number) * 100).toFixed(2)),
    "F1 Macro": Number((((models[name]?.f1_macro ?? 0) as number) * 100).toFixed(2)),
    Precision: Number((((models[name]?.precision_macro ?? 0) as number) * 100).toFixed(2)),
    Recall: Number((((models[name]?.recall_macro ?? 0) as number) * 100).toFixed(2)),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Model Zoo</h1>
        <p className="mt-1 text-sm text-noc-text-muted">
          Three ML classifiers and three DL models trained on the Telstra Network Disruptions dataset.
          Severity uses a F1-weighted ensemble; the autoencoder is reserved for early-warning anomalies.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-noc-text-muted">Primary classifier</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold capitalize">
              <Trophy className="h-4 w-4 text-noc-accent" />
              {(data.primary_classifier ?? "ensemble").replace("_", " ")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-noc-text-muted">Autoencoder ROC-AUC</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold font-[family-name:var(--font-mono)]">
              <Radar className="h-4 w-4 text-noc-accent" />
              {Number(models.autoencoder?.roc_auc ?? 0).toFixed(4)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-noc-text-muted">Held-out split</p>
            <p className="mt-1 text-lg font-bold">20% stratified</p>
            <p className="text-xs text-noc-text-muted">Same indices for all supervised models</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(MODEL_META).map(([key, meta]) => {
          const m = models[key] ?? {};
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base capitalize">
                  <span className="flex items-center gap-2">
                    {meta.family === "ML" ? <Cpu className="h-4 w-4 text-noc-accent" /> : <Brain className="h-4 w-4 text-noc-accent" />}
                    {key.replace("_", " ")}
                  </span>
                  <span className="rounded-full border border-noc-border px-2 py-0.5 text-[10px] uppercase text-noc-text-muted">
                    {meta.family}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-noc-text-muted">
                <p>{meta.role}</p>
                {key === "autoencoder" ? (
                  <>
                    <p className="font-[family-name:var(--font-mono)] text-noc-text">ROC-AUC {Number(m.roc_auc ?? 0).toFixed(4)}</p>
                    <p className="font-[family-name:var(--font-mono)]">PR-AUC {Number(m.pr_auc ?? 0).toFixed(4)}</p>
                  </>
                ) : (
                  <>
                    <p className="font-[family-name:var(--font-mono)] text-noc-text">
                      Acc {((m.accuracy ?? 0) * 100).toFixed(2)}% · F1 {((m.f1_macro ?? 0) * 100).toFixed(2)}%
                    </p>
                    <p className="font-[family-name:var(--font-mono)]">
                      Prec {((m.precision_macro ?? 0) * 100).toFixed(2)}% · Rec {((m.recall_macro ?? 0) * 100).toFixed(2)}%
                    </p>
                    <p>Ensemble weight {(data.ensemble_weights?.[key] ?? 0).toFixed(3)}</p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Held-out comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                  }}
                />
                <Legend />
                <Bar dataKey="Accuracy" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="F1 Macro" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
