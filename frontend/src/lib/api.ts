/**
 * Typed API client for the Telecom NOC FastAPI backend.
 * All calls go through the Vite proxy (/api → localhost:8000) in dev,
 * or can be configured via VITE_API_URL env var.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface HealthResponse {
  status: string;
  engine_loaded: boolean;
  total_tickets: number;
}

export interface TicketsResponse {
  tickets: number[];
}

export interface SeverityCount {
  0: number;
  1: number;
  2: number;
}

export interface AnalyticsOverview {
  total_tickets: number;
  severity_counts: SeverityCount;
  ae_threshold: number;
  ml_metrics: {
    accuracy: number;
    precision_macro: number;
    recall_macro: number;
    f1_macro: number;
    primary_classifier?: string;
    models?: Record<string, unknown>;
  };
  ae_metadata: {
    input_dim: number;
    bottleneck_dim: number;
    roc_auc: number;
    pr_auc: number;
    anomaly_threshold: number;
    [key: string]: unknown;
  };
  all_model_metrics?: Record<string, unknown>;
  ensemble_weights?: Record<string, number>;
  primary_classifier?: string;
}

export interface SeverityDistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface SeverityDistributionResponse {
  distribution: SeverityDistributionItem[];
}

export interface TopLocationItem {
  location: string;
  ticket_count: number;
}

export interface TopLocationsResponse {
  locations: TopLocationItem[];
}

export interface HeatmapItem {
  location: string;
  fault_severity: number;
  volume: number;
  severity_label: string;
}

export interface HeatmapResponse {
  heatmap: HeatmapItem[];
}

export interface AttributionItem {
  feature: string;
  clean_feature: string;
  value: number;
  importance: number;
  attribution_score: number;
}

export interface TicketAnalysis {
  ticket_id: number;
  location: string;
  actual_severity: number | null;
  predicted_severity: number;
  predicted_severity_label: string;
  confidence: number;
  prob_sev_0: number;
  prob_sev_1: number;
  prob_sev_2: number;
  prob_fault: number;
  anomaly_mse: number;
  threshold: number;
  is_anomalous: boolean;
  anomaly_status: string;
  anomaly_risk_score: number;
  combined_risk: number;
  risk_category: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  urgency: string;
  early_warning?: boolean;
  seq_fault?: number;
  active_events: string[];
  active_resources: string[];
  active_severities: string[];
  active_logs: Record<string, number>;
  top_attributions: AttributionItem[];
  model_predictions?: Record<string, ModelPrediction>;
  ensemble_weights?: Record<string, number>;
  probable_root_causes?: string[];
  scenario_mode?: boolean;
}

export interface CustomPredictionInput {
  target_id: number;
  entity_type: number;
  severity_type: number;
  event_burst: number;
  resource_count: number;
  log_volume: number;
}

export interface ModelPrediction {
  predicted_severity: number;
  predicted_severity_label: string;
  confidence: number;
  prob_sev_0: number;
  prob_sev_1: number;
  prob_sev_2: number;
  weight: number;
}

export interface ClassifierMetrics {
  accuracy?: number;
  precision_macro?: number;
  recall_macro?: number;
  f1_macro?: number;
  f1_weighted?: number;
  roc_auc?: number;
  pr_auc?: number;
  anomaly_threshold?: number;
  task?: string;
  confusion_matrix?: number[][];
}

export interface ModelsAnalyticsResponse {
  models: Record<string, ClassifierMetrics | string>;
  ensemble_weights: Record<string, number>;
  primary_classifier?: string;
  ae_metadata: Record<string, unknown>;
}

export interface PredictionHistoryItem {
  prediction_id: number;
  ticket_id: number;
  location: string;
  predicted_severity: number;
  predicted_severity_label: string;
  model_confidence: number;
  anomaly_mse: number;
  anomaly_threshold: number;
  anomaly_status: string;
  combined_risk_score: number;
  risk_category: string;
  urgency_level: string;
  created_at: string;
}

export interface AuditLogItem {
  log_id: number;
  ticket_id: number;
  action_type: string;
  input_context: string;
  ai_response: string;
  is_gemini_generated: number;
  created_at: string;
}

export interface RootCauseResult {
  executive_assessment: string;
  probable_root_cause_hypothesis: string;
  confidence_estimate: string;
  observed_telemetry_evidence: string[];
  model_derived_evidence: string[];
  uncertainty_statement: string;
}

export interface RecommendationsResult {
  priority_level: string;
  urgency_category: string;
  diagnostic_checks: string[];
  maintenance_actions: string[];
  monitoring_recommendations: string[];
}

export interface IncidentSummaryResult {
  summary: string;
}

export interface AIResponse<T> {
  result: T;
  is_gemini: boolean;
}

export interface ChatResponse {
  answer: string;
  is_gemini: boolean;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------
export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export async function fetchTickets(): Promise<number[]> {
  const data = await apiFetch<TicketsResponse>("/api/tickets");
  return data.tickets;
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>("/api/analytics/overview");
}

export async function fetchModelsAnalytics(): Promise<ModelsAnalyticsResponse> {
  return apiFetch<ModelsAnalyticsResponse>("/api/analytics/models");
}

export async function fetchSeverityDistribution(): Promise<SeverityDistributionResponse> {
  return apiFetch<SeverityDistributionResponse>("/api/analytics/severity-distribution");
}

export async function fetchTopLocations(limit = 10): Promise<TopLocationsResponse> {
  return apiFetch<TopLocationsResponse>(`/api/analytics/top-locations?limit=${limit}`);
}

export async function fetchSeverityLocationHeatmap(): Promise<HeatmapResponse> {
  return apiFetch<HeatmapResponse>("/api/analytics/severity-location-heatmap");
}

export async function fetchPredictionHistory(limit = 50): Promise<{ predictions: PredictionHistoryItem[] }> {
  return apiFetch(`/api/history/predictions?limit=${limit}`);
}

export async function fetchAuditLogs(limit = 50): Promise<{ audit_logs: AuditLogItem[] }> {
  return apiFetch(`/api/history/audit-logs?limit=${limit}`);
}

export async function analyzeTicket(ticketId: number): Promise<TicketAnalysis> {
  return apiFetch<TicketAnalysis>(`/api/analyze/${ticketId}`, { method: "POST" });
}

export async function analyzeCustomPrediction(input: CustomPredictionInput): Promise<TicketAnalysis> {
  return apiFetch<TicketAnalysis>("/api/custom-prediction", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestRootCause(
  ticketSummary: TicketAnalysis,
  apiKey?: string | null,
): Promise<AIResponse<RootCauseResult>> {
  return apiFetch("/api/ai/root-cause", {
    method: "POST",
    body: JSON.stringify({ ticket_summary: ticketSummary, api_key: apiKey }),
  });
}

export async function requestRecommendations(
  ticketSummary: TicketAnalysis,
  apiKey?: string | null,
): Promise<AIResponse<RecommendationsResult>> {
  return apiFetch("/api/ai/recommendations", {
    method: "POST",
    body: JSON.stringify({ ticket_summary: ticketSummary, api_key: apiKey }),
  });
}

export async function requestIncidentSummary(
  ticketSummary: TicketAnalysis,
  apiKey?: string | null,
): Promise<AIResponse<IncidentSummaryResult>> {
  return apiFetch("/api/ai/incident-summary", {
    method: "POST",
    body: JSON.stringify({ ticket_summary: ticketSummary, api_key: apiKey }),
  });
}

export async function requestCopilotChat(
  ticketSummary: TicketAnalysis,
  message: string,
  history: { role: string; content: string }[],
  apiKey?: string | null,
): Promise<ChatResponse> {
  return apiFetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ ticket_summary: ticketSummary, message, history, api_key: apiKey }),
  });
}
