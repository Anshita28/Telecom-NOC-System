import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, BrainCircuit, Gauge, Network, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analyzeCustomPrediction } from "@/lib/api";
import type { CustomPredictionInput, TicketAnalysis } from "@/lib/api";
import { cn } from "@/lib/utils";

const initialInput: CustomPredictionInput = {
  target_id: 201,
  entity_type: 1,
  severity_type: 1,
  event_burst: 4,
  resource_count: 2,
  log_volume: 301,
};

const riskClass: Record<string, string> = {
  LOW: "border-risk-low/50 bg-risk-low-bg text-risk-low",
  ELEVATED: "border-risk-elevated/50 bg-risk-elevated-bg text-risk-elevated",
  HIGH: "border-risk-high/50 bg-risk-high-bg text-risk-high",
  CRITICAL: "border-risk-critical/50 bg-risk-critical-bg text-risk-critical",
};

function SignalSlider({ label, value, min, max, unit, onChange, description }: {
  label: string; value: number; min: number; max: number; unit: string; description: string; onChange: (value: number) => void;
}) {
  return (
    <div className="border-b border-noc-border py-4 last:border-0">
      <div className="mb-2 flex items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-noc-text">{label}</p><p className="mt-0.5 text-xs text-noc-text-muted">{description}</p></div>
        <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-noc-accent">{value.toLocaleString()} {unit}</span>
      </div>
      <input aria-label={label} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-noc-accent" />
      <div className="flex justify-between text-[10px] text-noc-text-dim"><span>{min.toLocaleString()}</span><span>{max.toLocaleString()}</span></div>
    </div>
  );
}

export default function CustomPredictionView() {
  const [input, setInput] = useState<CustomPredictionInput>(initialInput);
  const [result, setResult] = useState<TicketAnalysis | null>(null);
  const queryClient = useQueryClient();
  const prediction = useMutation({
    mutationFn: analyzeCustomPrediction,
    onSuccess: (data) => { setResult(data); queryClient.invalidateQueries({ queryKey: ["prediction-history"] }); toast.success("Scenario prediction complete"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const set = <K extends keyof CustomPredictionInput>(key: K, value: CustomPredictionInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const chart = result ? [
    { name: "Fault likelihood", value: Math.round(result.prob_fault * 100), color: "#ef4444" },
    { name: "Anomaly signal", value: Math.round(result.anomaly_risk_score * 100), color: "#eab308" },
    { name: "Combined risk", value: Math.round(result.combined_risk * 100), color: "#8cff74" },
  ] : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="border-b border-noc-border pb-6">
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-noc-accent">Manual signal simulator</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Analyse a network node</h1>
        <p className="mt-2 max-w-3xl text-sm text-noc-text-muted">Enter five operational signals for any node ID. The trained model evaluates the simulated feature vector and returns an explainable risk assessment. This is a what-if scenario, not historical telemetry.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-noc-border bg-noc-surface/80">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4 text-noc-accent" /> Telemetry input</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <label className="block py-2 text-sm font-semibold">Target Node ID
              <input type="number" min="1" max="9999999" value={input.target_id} onChange={(event) => set("target_id", Math.max(1, Number(event.target.value)))} className="mt-2 w-full rounded-md border border-noc-border bg-noc-bg px-3 py-2.5 font-[family-name:var(--font-mono)] text-noc-text outline-none transition focus:border-noc-accent" />
            </label>
            <p className="pb-2 text-xs text-noc-text-muted">Any positive ID is supported; it is used as a simulated network-node key.</p>

            <label className="block border-t border-noc-border py-4 text-sm font-semibold">Entity type
              <select value={input.entity_type} onChange={(event) => set("entity_type", Number(event.target.value))} className="mt-2 w-full rounded-md border border-noc-border bg-noc-bg px-3 py-2.5 text-sm text-noc-text outline-none focus:border-noc-accent">
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Event entity type {index + 1}</option>)}
              </select>
            </label>

            <div className="border-t border-noc-border py-4"><p className="mb-2 text-sm font-semibold">Upstream severity type</p><div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((severity) => <button key={severity} onClick={() => set("severity_type", severity)} className={cn("rounded-md border px-2 py-2 text-xs transition", input.severity_type === severity ? "border-noc-accent bg-noc-accent/15 text-noc-accent" : "border-noc-border bg-noc-bg text-noc-text-muted hover:border-noc-border-light")}>Type {severity}</button>)}
            </div></div>

            <SignalSlider label="Event burst count" value={input.event_burst} min={1} max={24} unit="events" description="Distinct event signals present in the scenario." onChange={(value) => set("event_burst", value)} />
            <SignalSlider label="Resource count" value={input.resource_count} min={1} max={10} unit="resources" description="Resource types implicated by this node." onChange={(value) => set("resource_count", value)} />
            <SignalSlider label="Log volume" value={input.log_volume} min={1} max={20000} unit="units" description="Aggregate log volume; higher bursts can increase anomaly risk." onChange={(value) => set("log_volume", value)} />

            <div className="flex flex-wrap gap-3 pt-5"><Button onClick={() => prediction.mutate(input)} disabled={prediction.isPending} className="min-w-52 gap-2 bg-noc-accent text-noc-bg hover:bg-noc-accent-dim"><Sparkles className="h-4 w-4" />{prediction.isPending ? "Running model…" : "Run fault prediction"}</Button><Button variant="outline" onClick={() => { setInput(initialInput); setResult(null); }} className="gap-2"><RotateCcw className="h-4 w-4" /> Reset</Button></div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {result ? <>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-xl border p-6", riskClass[result.risk_category])}>
              <div className="flex items-start justify-between gap-5"><div><p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest">Predicted operating state</p><h2 className="mt-2 text-3xl font-bold">{result.risk_category}</h2><p className="mt-1 text-sm">{result.urgency}</p></div><Gauge className="h-11 w-11" /></div>
              <p className="mt-5 text-sm text-noc-text">Combined risk <span className="font-[family-name:var(--font-mono)] text-lg font-bold">{(result.combined_risk * 100).toFixed(1)}%</span> · confidence {(result.confidence * 100).toFixed(1)}%</p>
            </motion.div>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-noc-accent" /> Result chart — model signals (%)</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#26352a" /><XAxis dataKey="name" tick={{ fill: "#a6b6a6", fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fill: "#a6b6a6", fontSize: 11 }} /><Tooltip contentStyle={{ background: "#0c120d", border: "1px solid #26352a", color: "#edf7e9" }} formatter={(value) => `${value}%`} /><Bar dataKey="value" radius={[5, 5, 0, 0]}>{chart.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4 text-noc-accent" /> Why the model flagged this</CardTitle></CardHeader><CardContent className="space-y-3">{result.top_attributions.slice(0, 4).map((item) => <div key={item.feature} className="flex items-center justify-between gap-4 border-b border-noc-border pb-2 last:border-0"><span className="text-sm text-noc-text-muted">{item.clean_feature}</span><span className="font-[family-name:var(--font-mono)] text-xs text-noc-accent">impact {(item.attribution_score * 100).toFixed(2)}</span></div>)}</CardContent></Card>
          </> : <Card className="border-dashed"><CardContent className="flex min-h-96 flex-col items-center justify-center text-center"><ShieldCheck className="h-10 w-10 text-noc-accent" /><h2 className="mt-4 text-lg font-semibold">Ready to check a node?</h2><p className="mt-2 max-w-sm text-sm text-noc-text-muted">Set the five signals and run the model. Results will include risk, anomaly evidence, and the signals that mattered most.</p><div className="mt-6 flex items-center gap-2 text-xs text-noc-text-dim"><AlertTriangle className="h-3.5 w-3.5" /> Validate before acting on a live network.</div></CardContent></Card>}
        </div>
      </div>
    </div>
  );
}
