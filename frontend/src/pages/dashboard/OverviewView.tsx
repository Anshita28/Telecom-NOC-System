import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Layers,
  TrendingUp,
  Server,
  Shield,
} from "lucide-react";
import HeatmapChart from "@/components/HeatmapChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAnalyticsOverview,
  fetchSeverityDistribution,
  fetchTopLocations,
  fetchPredictionHistory,
  fetchAuditLogs,
} from "@/lib/api";
import type { PredictionHistoryItem, AuditLogItem } from "@/lib/api";
import type { AnalyticsOverview } from "@/lib/api";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-noc-accent",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-noc-accent/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-noc-text-muted">
                {label}
              </p>
              <p className={`mt-1.5 text-2xl font-bold font-[family-name:var(--font-mono)] ${color}`}>
                {value}
              </p>
            </div>
            <div className="rounded-lg bg-noc-accent/10 p-2">
              <Icon className="h-5 w-5 text-noc-accent" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default function OverviewView() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: fetchAnalyticsOverview,
  });

  const { data: sevDist } = useQuery({
    queryKey: ["severity-distribution"],
    queryFn: fetchSeverityDistribution,
  });

  const { data: topLocs } = useQuery({
    queryKey: ["top-locations"],
    queryFn: () => fetchTopLocations(10),
  });

  const { data: predData } = useQuery({
    queryKey: ["prediction-history"],
    queryFn: () => fetchPredictionHistory(50),
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetchAuditLogs(50),
  });

  if (overviewLoading) return <OverviewSkeleton />;

  const sc = overview?.severity_counts ?? { 0: 0, 1: 0, 2: 0 };
  const ml: AnalyticsOverview["ml_metrics"] = overview?.ml_metrics ?? {
    accuracy: 0,
    precision_macro: 0,
    recall_macro: 0,
    f1_macro: 0,
  };
  const ae: AnalyticsOverview["ae_metadata"] = overview?.ae_metadata ?? {
    input_dim: 0,
    bottleneck_dim: 0,
    roc_auc: 0,
    pr_auc: 0,
    anomaly_threshold: 0,
  };

  const predictions: PredictionHistoryItem[] = predData?.predictions ?? [];
  const audits: AuditLogItem[] = auditData?.audit_logs ?? [];

  const chartColors = {
    low: "#22c55e",
    medium: "#eab308",
    severe: "#ef4444",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Network Analytics Overview</h1>
        <p className="mt-1 text-sm text-noc-text-muted">
          Telecom event telemetry, model performance, and prediction audit trail.
        </p>
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 md:grid-cols-5"
      >
        <StatCard icon={Layers} label="Total Tickets" value={overview?.total_tickets?.toLocaleString() ?? "—"} />
        <StatCard icon={CheckCircle2} label="Low Severity (0)" value={sc[0]?.toLocaleString() ?? "—"} color="text-risk-low" />
        <StatCard icon={AlertTriangle} label="Medium Severity (1)" value={sc[1]?.toLocaleString() ?? "—"} color="text-risk-elevated" />
        <StatCard icon={Activity} label="Severe Faults (2)" value={sc[2]?.toLocaleString() ?? "—"} color="text-risk-critical" />
        <StatCard icon={Shield} label="AE Anomaly Threshold" value={overview?.ae_threshold?.toFixed(4) ?? "—"} />
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Severity Distribution Donut */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-noc-accent" />
                Fault Severity Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sevDist?.distribution ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(sevDist?.distribution ?? []).map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#e2e8f0",
                      }}
                    />
                    <Legend
                      formatter={(value) => <span className="text-xs text-noc-text-muted">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Locations Bar */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-noc-accent" />
                Top 10 Ticket Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topLocs?.locations ?? []}
                    margin={{ top: 5, right: 20, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="location"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#e2e8f0",
                      }}
                    />
                    <Bar
                      dataKey="ticket_count"
                      name="Ticket Count"
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Model Metrics Strip */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-noc-accent" />
              Model Evaluation Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Best Acc (held-out)", value: `${((ml.accuracy ?? 0) * 100).toFixed(2)}%` },
                { label: "Best F1-Macro", value: `${((ml.f1_macro ?? 0) * 100).toFixed(2)}%` },
                { label: "AE Anomaly ROC-AUC", value: (ae.roc_auc ?? 0).toFixed(4) },
                { label: "Primary model", value: String(overview?.primary_classifier ?? ml.primary_classifier ?? "ensemble") },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-noc-border bg-noc-bg/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-noc-text-muted">
                    {m.label}
                  </p>
                  <p className="mt-1 text-xl font-bold font-[family-name:var(--font-mono)] text-noc-text">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Heatmap */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <HeatmapChart />
      </motion.div>

      {/* History & Audit Logs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="predictions">
            <TabsList>
              <TabsTrigger value="predictions">
                Predictions History ({predictions.length})
              </TabsTrigger>
              <TabsTrigger value="audit">AI Audit Logs ({audits.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="predictions" className="mt-4">
              {predictions.length === 0 ? (
                <p className="py-8 text-center text-sm text-noc-text-muted">
                  No predictions logged yet. Run a prediction in the Analysis tab.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-noc-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-noc-border bg-noc-surface/50 text-left text-xs uppercase tracking-wider text-noc-text-muted">
                        <th className="px-4 py-3">Ticket</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Severity</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((p) => (
                        <tr
                          key={p.prediction_id}
                          className="border-b border-noc-border/50 transition hover:bg-noc-surface/30"
                        >
                          <td className="px-4 py-2.5 font-[family-name:var(--font-mono)]">
                            #{p.ticket_id}
                          </td>
                          <td className="px-4 py-2.5">{p.location}</td>
                          <td className="px-4 py-2.5">{p.predicted_severity_label}</td>
                          <td className="px-4 py-2.5 font-[family-name:var(--font-mono)]">
                            {(p.combined_risk_score * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                p.risk_category === "CRITICAL"
                                  ? "bg-risk-critical-bg text-risk-critical"
                                  : p.risk_category === "HIGH"
                                    ? "bg-risk-high-bg text-risk-high"
                                    : p.risk_category === "ELEVATED"
                                      ? "bg-risk-elevated-bg text-risk-elevated"
                                      : "bg-risk-low-bg text-risk-low"
                              }`}
                            >
                              {p.risk_category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-noc-text-muted">
                            {new Date(p.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              {audits.length === 0 ? (
                <p className="py-8 text-center text-sm text-noc-text-muted">
                  No AI audit logs yet. Interact with AI tools in the Analysis tab.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-noc-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-noc-border bg-noc-surface/50 text-left text-xs uppercase tracking-wider text-noc-text-muted">
                        <th className="px-4 py-3">Log ID</th>
                        <th className="px-4 py-3">Ticket</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Gemini?</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audits.map((a) => (
                        <tr
                          key={a.log_id}
                          className="border-b border-noc-border/50 transition hover:bg-noc-surface/30"
                        >
                          <td className="px-4 py-2.5 font-[family-name:var(--font-mono)]">
                            {a.log_id}
                          </td>
                          <td className="px-4 py-2.5 font-[family-name:var(--font-mono)]">
                            #{a.ticket_id}
                          </td>
                          <td className="px-4 py-2.5">{a.action_type}</td>
                          <td className="px-4 py-2.5">
                            {a.is_gemini_generated ? (
                              <span className="text-risk-low">✅ Gemini</span>
                            ) : (
                              <span className="text-noc-text-muted">Local Fallback</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-noc-text-muted">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
