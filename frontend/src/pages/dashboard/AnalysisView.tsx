import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Search,
  Loader2,
  Zap,
  AlertTriangle,
  Shield,
  Radio,
  Bot,
  Send,
  ChevronDown,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchTickets,
  analyzeTicket,
  requestRootCause,
  requestRecommendations,
  requestIncidentSummary,
  requestCopilotChat,
} from "@/lib/api";
import type { TicketAnalysis, AIResponse, ModelPrediction } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  apiKey: string | null;
}

const riskColors: Record<string, string> = {
  LOW: "text-risk-low",
  ELEVATED: "text-risk-elevated",
  HIGH: "text-risk-high",
  CRITICAL: "text-risk-critical",
};

const riskBg: Record<string, string> = {
  LOW: "bg-risk-low-bg border-risk-low",
  ELEVATED: "bg-risk-elevated-bg border-risk-elevated",
  HIGH: "bg-risk-high-bg border-risk-high",
  CRITICAL: "bg-risk-critical-bg border-risk-critical",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AnalysisView({ apiKey }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [analysis, setAnalysis] = useState<TicketAnalysis | null>(null);
  const [aiOutput, setAiOutput] = useState<{
    type: string;
    data: unknown;
    isGemini: boolean;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: ticketIds = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: fetchTickets,
  });

  const analyzeMutation = useMutation({
    mutationFn: (id: number) => analyzeTicket(id),
    onSuccess: (data) => {
      setAnalysis(data);
      setAiOutput(null);
      setChatMessages([
        {
          role: "assistant",
          content: `Hello! I am your AI NOC Copilot. Ask me any questions regarding Ticket #${data.ticket_id} at ${data.location}.`,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ["prediction-history"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      toast.success(`Ticket #${data.ticket_id} analyzed successfully`);
    },
    onError: (err: Error) => {
      toast.error(`Analysis failed: ${err.message}`);
    },
  });

  const rootCauseMutation = useMutation({
    mutationFn: (summary: TicketAnalysis) => requestRootCause(summary, apiKey),
    onSuccess: (resp) => {
      setAiOutput({ type: "root_cause", data: resp.result, isGemini: resp.is_gemini });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const recommendationsMutation = useMutation({
    mutationFn: (summary: TicketAnalysis) => requestRecommendations(summary, apiKey),
    onSuccess: (resp) => {
      setAiOutput({ type: "recommendations", data: resp.result, isGemini: resp.is_gemini });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const incidentMutation = useMutation({
    mutationFn: (summary: TicketAnalysis) => requestIncidentSummary(summary, apiKey),
    onSuccess: (resp) => {
      setAiOutput({ type: "incident_summary", data: resp.result, isGemini: resp.is_gemini });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const chatMutation = useMutation({
    mutationFn: ({ summary, message, history }: { summary: TicketAnalysis; message: string; history: ChatMessage[] }) =>
      requestCopilotChat(summary, message, history, apiKey),
    onSuccess: (resp) => {
      setChatMessages((prev) => [...prev, { role: "assistant", content: resp.answer }]);
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const filteredTickets = ticketIds.filter((id) =>
    String(id).includes(searchTerm),
  ).slice(0, 50);

  const handleAnalyze = () => {
    if (selectedId !== null) {
      analyzeMutation.mutate(selectedId);
    }
  };

  const handleChatSend = () => {
    if (!chatInput.trim() || !analysis) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatInput("");
    chatMutation.mutate({ summary: analysis, message: userMsg, history: chatMessages });
  };

  const isAiLoading =
    rootCauseMutation.isPending ||
    recommendationsMutation.isPending ||
    incidentMutation.isPending;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ticket Analysis</h1>
        <p className="mt-1 text-sm text-noc-text-muted">
          Real-time network ticket inspection, risk assessment & AI diagnostics.
        </p>
      </div>

      {/* Ticket Selector */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1" ref={dropdownRef}>
              <div
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-noc-border bg-noc-bg px-3 py-2.5 transition hover:border-noc-accent"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <Search className="h-4 w-4 shrink-0 text-noc-text-muted" />
                <span className={cn("flex-1 text-sm", selectedId ? "text-noc-text" : "text-noc-text-dim")}>
                  {selectedId !== null ? `Ticket #${selectedId}` : "Search for a ticket ID..."}
                </span>
                {selectedId !== null && (
                  <button
                    className="text-noc-text-muted hover:text-noc-text"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(null);
                      setAnalysis(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <ChevronDown className="h-4 w-4 text-noc-text-muted" />
              </div>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-noc-border bg-noc-surface shadow-2xl"
                  >
                    <div className="sticky top-0 border-b border-noc-border bg-noc-surface p-2">
                      <input
                        autoFocus
                        placeholder="Type to filter..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-md border border-noc-border bg-noc-bg px-2 py-1.5 text-sm text-noc-text placeholder-noc-text-dim focus:border-noc-accent focus:outline-none"
                      />
                    </div>
                    {ticketsLoading ? (
                      <div className="p-4 text-center text-sm text-noc-text-muted">Loading...</div>
                    ) : (
                      filteredTickets.map((id) => (
                        <button
                          key={id}
                          className={cn(
                            "flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-noc-surface-hover",
                            id === selectedId && "bg-noc-accent/10 text-noc-accent",
                          )}
                          onClick={() => {
                            setSelectedId(id);
                            setShowDropdown(false);
                            setSearchTerm("");
                          }}
                        >
                          <span className="font-[family-name:var(--font-mono)]">#{id}</span>
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={selectedId === null || analyzeMutation.isPending}
              className="gap-2"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Analyze Ticket
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      <AnimatePresence>
        {analyzeMutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-4 md:grid-cols-5"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {analysis && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Stat Cards Row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-noc-text-muted">
                  Ticket / Location
                </p>
                <p className="mt-1 text-xl font-bold font-[family-name:var(--font-mono)] text-noc-accent">
                  #{analysis.ticket_id}
                </p>
                <p className="mt-0.5 text-xs text-noc-text-muted">{analysis.location}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-noc-text-muted">
                  Predicted Severity
                </p>
                <p className="mt-1 text-lg font-bold">{analysis.predicted_severity_label}</p>
                <p className="mt-0.5 font-[family-name:var(--font-mono)] text-xs text-risk-low">
                  {(analysis.confidence * 100).toFixed(1)}% Conf
                </p>
              </CardContent>
            </Card>

            <Card className={cn(analysis.is_anomalous && "border-risk-critical")}>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-noc-text-muted">
                  Autoencoder MSE
                </p>
                <p className="mt-1 text-xl font-bold font-[family-name:var(--font-mono)]">
                  {analysis.anomaly_mse.toFixed(4)}
                </p>
                <p className="mt-0.5 text-xs text-noc-text-muted">
                  Thresh: {analysis.threshold.toFixed(4)} |{" "}
                  <span className={cn("font-bold", analysis.is_anomalous ? "text-risk-critical" : "text-risk-low")}>
                    {analysis.is_anomalous ? "⚠️ ANOMALOUS" : "✅ Normal"}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-noc-text-muted">
                  Combined Risk Score
                </p>
                <p className={cn("mt-1 text-xl font-bold font-[family-name:var(--font-mono)]", riskColors[analysis.risk_category])}>
                  {(analysis.combined_risk * 100).toFixed(1)}%
                </p>
                <p className="mt-0.5 text-xs text-noc-text-muted">50% ensemble + 25% AE + 25% LSTM/GRU</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-noc-text-muted">
                  Risk Category
                </p>
                <div className="mt-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase",
                      riskBg[analysis.risk_category],
                      riskColors[analysis.risk_category],
                      analysis.risk_category === "CRITICAL" && "animate-[pulse-critical_2s_infinite_alternate]",
                    )}
                  >
                    {analysis.risk_category === "CRITICAL" && "🔴"}
                    {analysis.risk_category === "HIGH" && "🟠"}
                    {analysis.risk_category === "ELEVATED" && "🟡"}
                    {analysis.risk_category === "LOW" && "🟢"}
                    {analysis.risk_category} RISK
                  </span>
                  <p className="mt-1.5 text-[10px] text-noc-text-muted">{analysis.urgency}</p>
                  {analysis.early_warning && (
                    <p className="mt-1 text-[10px] font-semibold text-risk-high">Early warning: failure pattern forming</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-model severity votes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                {Object.entries(analysis.model_predictions ?? {}).map(([name, pred]) => {
                  const p = pred as ModelPrediction;
                  return (
                    <div key={name} className="rounded-lg border border-noc-border bg-noc-bg/40 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-noc-text-muted">
                        {name.replace("_", " ")}
                      </p>
                      <p className="mt-1 text-sm font-bold">{p.predicted_severity_label}</p>
                      <p className="font-[family-name:var(--font-mono)] text-xs text-noc-text-muted">
                        {(p.confidence * 100).toFixed(1)}% · w={p.weight.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {analysis.probable_root_causes && analysis.probable_root_causes.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-noc-text-muted">Probable root-cause signals</p>
                  <ul className="mt-2 space-y-1 text-sm text-noc-text-muted">
                    {analysis.probable_root_causes.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Telemetry + XAI */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Radio className="h-4 w-4 text-noc-accent" />
                  Active Telemetry & Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-noc-text-muted">Location: </span>
                  <span className="font-[family-name:var(--font-mono)]">{analysis.location}</span>
                </div>
                <div>
                  <span className="font-medium text-noc-text-muted">Events: </span>
                  <span>{analysis.active_events.join(", ") || "None"}</span>
                </div>
                <div>
                  <span className="font-medium text-noc-text-muted">Resources: </span>
                  <span>{analysis.active_resources.join(", ") || "None"}</span>
                </div>
                <div>
                  <span className="font-medium text-noc-text-muted">Severity Types: </span>
                  <span>{analysis.active_severities.join(", ") || "None"}</span>
                </div>
                <div>
                  <span className="font-medium text-noc-text-muted">Log Volumes:</span>
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(analysis.active_logs)
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between font-[family-name:var(--font-mono)] text-xs">
                          <span className="text-noc-text-muted">{k}</span>
                          <span>{v}</span>
                        </div>
                      ))}
                    {Object.keys(analysis.active_logs).length === 0 && (
                      <p className="text-xs text-noc-text-dim">None</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-noc-accent" />
                  Top Contributing Signals (XAI)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.top_attributions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-noc-text-muted">
                    No active feature attributions for this ticket.
                  </p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analysis.top_attributions}
                        layout="vertical"
                        margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="clean_feature"
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                          width={115}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            color: "#e2e8f0",
                          }}
                        />
                        <Bar dataKey="attribution_score" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Action Buttons */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Bot className="h-5 w-5 text-noc-accent" />
                <h3 className="text-base font-semibold">AI Operations & Diagnostics</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={isAiLoading}
                  onClick={() => rootCauseMutation.mutate(analysis)}
                >
                  {rootCauseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Find Root Cause
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={isAiLoading}
                  onClick={() => recommendationsMutation.mutate(analysis)}
                >
                  {recommendationsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  Recommend Actions
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={isAiLoading}
                  onClick={() => incidentMutation.mutate(analysis)}
                >
                  {incidentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Incident Summary
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={isAiLoading}
                  onClick={() =>
                    setAiOutput({
                      type: "explain_risk",
                      data: analysis,
                      isGemini: false,
                    })
                  }
                >
                  <Shield className="h-4 w-4" />
                  Explain Risk
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Output Display */}
          <AnimatePresence>
            {aiOutput && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                <Card className="border-noc-accent/30">
                  <CardContent className="p-6">
                    {aiOutput.isGemini && (
                      <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-risk-low/10 px-2.5 py-0.5 text-xs font-medium text-risk-low">
                        ✅ Gemini 2.5 Flash
                      </span>
                    )}

                    {aiOutput.type === "root_cause" && (
                      <RootCauseOutput data={aiOutput.data as any} />
                    )}
                    {aiOutput.type === "recommendations" && (
                      <RecommendationsOutput data={aiOutput.data as any} />
                    )}
                    {aiOutput.type === "incident_summary" && (
                      <IncidentSummaryOutput data={aiOutput.data as any} />
                    )}
                    {aiOutput.type === "explain_risk" && analysis && (
                      <ExplainRiskOutput analysis={analysis} />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Copilot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-noc-accent" />
                AI Network Operations Copilot (Ticket #{analysis.ticket_id})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-noc-border bg-noc-bg/50 p-4">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-noc-accent/20 text-noc-text"
                          : "bg-noc-surface text-noc-text",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-noc-surface px-4 py-2.5">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-noc-text-muted [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-noc-text-muted [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-noc-text-muted [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                  placeholder="Ask a question about this ticket..."
                  disabled={chatMutation.isPending}
                  className="flex-1 rounded-lg border border-noc-border bg-noc-bg px-3 py-2.5 text-sm text-noc-text placeholder-noc-text-dim focus:border-noc-accent focus:outline-none focus:ring-1 focus:ring-noc-accent"
                />
                <Button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatMutation.isPending}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// ----- AI Output Sub-components -----

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-noc-text">{title}</p>
      <ul className="space-y-1 text-sm text-noc-text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-noc-accent">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RootCauseOutput({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">🔍 Root-Cause Analysis</h3>
      <div>
        <p className="text-sm font-medium text-noc-text-muted">Executive Assessment</p>
        <p className="mt-0.5 text-sm">{data.executive_assessment}</p>
      </div>
      <div className="rounded-lg border border-noc-accent/20 bg-noc-accent/5 p-3">
        <p className="text-sm font-medium text-noc-accent">Probable Hypothesis</p>
        <p className="mt-0.5 text-sm">{data.probable_root_cause_hypothesis}</p>
      </div>
      <div className="font-[family-name:var(--font-mono)] text-xs text-noc-text-muted">
        Confidence: {data.confidence_estimate}
      </div>
      <SectionList title="Observed Telemetry Evidence" items={data.observed_telemetry_evidence} />
      <SectionList title="Model-Derived Evidence" items={data.model_derived_evidence} />
      <p className="text-xs text-noc-text-dim italic">⚠️ {data.uncertainty_statement}</p>
    </div>
  );
}

function RecommendationsOutput({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">🛠️ Preventive Maintenance Recommendations</h3>
      <div className="flex gap-4 text-sm">
        <span className="font-[family-name:var(--font-mono)]">{data.priority_level}</span>
        <span className="text-noc-text-muted">{data.urgency_category}</span>
      </div>
      <SectionList title="Diagnostic Checks" items={data.diagnostic_checks} />
      <SectionList title="Maintenance Actions" items={data.maintenance_actions} />
      <SectionList title="Monitoring Guidance" items={data.monitoring_recommendations} />
    </div>
  );
}

function IncidentSummaryOutput({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold">📋 Incident Executive Briefing</h3>
      <pre className="whitespace-pre-wrap rounded-lg bg-noc-bg p-4 font-[family-name:var(--font-mono)] text-sm text-noc-text">
        {data.summary}
      </pre>
    </div>
  );
}

function ExplainRiskOutput({ analysis }: { analysis: TicketAnalysis }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">📊 Combined Risk Score Explanation</h3>
      <div className="rounded-lg border border-noc-border bg-noc-bg p-4">
        <p className="font-[family-name:var(--font-mono)] text-sm">
          Combined Risk ={" "}
          <span className="text-noc-accent">0.50</span> × ensemble P(Fault) +{" "}
          <span className="text-noc-accent">0.25</span> × AE anomaly +{" "}
          <span className="text-noc-accent">0.25</span> × LSTM/GRU P(Fault)
        </p>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-noc-text-muted">Ensemble fault probability P(Fault ≥ 1)</span>
          <span className="font-[family-name:var(--font-mono)]">{(analysis.prob_fault * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-noc-text-muted">Autoencoder Reconstruction MSE</span>
          <span className="font-[family-name:var(--font-mono)]">
            {analysis.anomaly_mse.toFixed(4)} / {analysis.threshold.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-noc-text-muted">LSTM/GRU sequence fault probability (Weight: 25%)</span>
          <span className="font-[family-name:var(--font-mono)]">{((analysis.seq_fault ?? 0) * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-noc-text-muted">Normalized Anomaly Score (Weight: 25%)</span>
          <span className="font-[family-name:var(--font-mono)]">{(analysis.anomaly_risk_score * 100).toFixed(1)}%</span>
        </div>
        <div className="border-t border-noc-border pt-2">
          <div className="flex justify-between font-semibold">
            <span>Final Calculated Risk</span>
            <span className={cn("font-[family-name:var(--font-mono)]", riskColors[analysis.risk_category])}>
              {(analysis.combined_risk * 100).toFixed(1)}% → {analysis.risk_category}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
