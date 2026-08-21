"""
FastAPI Backend for Telecom Network Fault Prediction & Predictive Maintenance System
Wraps the existing TelecomRiskEngine, Gemini service, and DB logic over HTTP.
"""

import os
import sys
import json
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Path setup — mirror the Streamlit app's ROOT_DIR so imports resolve
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
except Exception:
    pass

from ai.xai_explainer import TelecomRiskEngine
from ai.gemini_service import (
    generate_root_cause_analysis,
    generate_maintenance_recommendations,
    generate_incident_summary,
    answer_copilot_chat,
)
from sql.db import (
    init_db,
    log_prediction,
    log_ai_action,
    get_prediction_history,
    get_ai_audit_logs,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("noc-backend")

# ---------------------------------------------------------------------------
# Global state — loaded once at startup
# ---------------------------------------------------------------------------
risk_engine: Optional[TelecomRiskEngine] = None
ml_metrics: dict = {}
ae_metadata: dict = {}


# ---------------------------------------------------------------------------
# Lifespan — init DB + load engine once (replaces @st.cache_resource)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global risk_engine, ml_metrics, ae_metadata
    logger.info("Initializing database...")
    init_db(data_dir=os.path.join(ROOT_DIR, "data"))

    logger.info("Loading TelecomRiskEngine (one-time)...")
    risk_engine = TelecomRiskEngine(
        data_dir=os.path.join(ROOT_DIR, "data"),
        model_dir=os.path.join(ROOT_DIR, "model"),
    )
    ae_metadata = risk_engine.ae_metadata

    metrics_path = os.path.join(ROOT_DIR, "model", "classifier_metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            ml_metrics = json.load(f)
    else:
        ml_metrics = {"accuracy": 0.0, "f1_macro": 0.0}

    logger.info("Backend ready — engine loaded, DB initialized.")
    yield
    logger.info("Shutting down backend.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Telecom NOC Fault Prediction API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class AnalyzeResponse(BaseModel):
    ticket_id: int
    location: str
    actual_severity: Optional[int] = None
    predicted_severity: int
    predicted_severity_label: str
    confidence: float
    prob_sev_0: float
    prob_sev_1: float
    prob_sev_2: float
    prob_fault: float
    anomaly_mse: float
    threshold: float
    is_anomalous: bool
    anomaly_status: str
    anomaly_risk_score: float
    combined_risk: float
    risk_category: str
    urgency: str
    active_events: List[str]
    active_resources: List[str]
    active_severities: List[str]
    active_logs: Dict[str, int]
    top_attributions: List[Dict[str, Any]]


class AIRootCauseRequest(BaseModel):
    ticket_summary: dict
    api_key: Optional[str] = None


class AIRecommendationsRequest(BaseModel):
    ticket_summary: dict
    api_key: Optional[str] = None


class AIIncidentSummaryRequest(BaseModel):
    ticket_summary: dict
    api_key: Optional[str] = None


class AIChatRequest(BaseModel):
    ticket_summary: dict
    message: str
    history: List[Dict[str, str]] = Field(default_factory=list)
    api_key: Optional[str] = None


class CustomPredictionRequest(BaseModel):
    target_id: int = Field(ge=1, le=9_999_999)
    entity_type: int = Field(default=1, ge=1, le=54)
    severity_type: int = Field(default=1, ge=1, le=5)
    event_burst: int = Field(default=3, ge=1, le=24)
    resource_count: int = Field(default=2, ge=1, le=10)
    log_volume: int = Field(default=100, ge=1, le=20_000)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "engine_loaded": risk_engine is not None,
        "total_tickets": len(risk_engine.get_all_ticket_ids()) if risk_engine else 0,
    }


# ---------------------------------------------------------------------------
# Ticket listing
# ---------------------------------------------------------------------------
@app.get("/api/tickets")
async def get_tickets():
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    return {"tickets": risk_engine.get_all_ticket_ids()}


# ---------------------------------------------------------------------------
# Analytics endpoints
# ---------------------------------------------------------------------------
@app.get("/api/analytics/overview")
async def analytics_overview():
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    master_df = risk_engine.master_df
    sev_counts = master_df["fault_severity"].value_counts().to_dict()
    return {
        "total_tickets": len(master_df),
        "severity_counts": {
            "0": int(sev_counts.get(0, 0)),
            "1": int(sev_counts.get(1, 0)),
            "2": int(sev_counts.get(2, 0)),
        },
        "ae_threshold": risk_engine.threshold,
        "ml_metrics": ml_metrics,
        "ae_metadata": ae_metadata,
        "all_model_metrics": getattr(risk_engine, "all_metrics", {}),
        "ensemble_weights": getattr(risk_engine, "ensemble_weights", {}),
        "primary_classifier": ml_metrics.get("primary_classifier")
        or getattr(risk_engine, "all_metrics", {}).get("primary_classifier"),
    }


@app.get("/api/analytics/models")
async def analytics_models():
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    return {
        "models": getattr(risk_engine, "all_metrics", {}),
        "ensemble_weights": getattr(risk_engine, "ensemble_weights", {}),
        "primary_classifier": ml_metrics.get("primary_classifier")
        or getattr(risk_engine, "all_metrics", {}).get("primary_classifier"),
        "ae_metadata": ae_metadata,
    }


@app.get("/api/analytics/severity-distribution")
async def severity_distribution():
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    master_df = risk_engine.master_df
    sev_counts = master_df["fault_severity"].value_counts().to_dict()
    return {
        "distribution": [
            {"name": "0: Low / Normal", "value": int(sev_counts.get(0, 0)), "color": "#22c55e"},
            {"name": "1: Medium Fault", "value": int(sev_counts.get(1, 0)), "color": "#eab308"},
            {"name": "2: Severe Fault", "value": int(sev_counts.get(2, 0)), "color": "#ef4444"},
        ]
    }


@app.get("/api/analytics/top-locations")
async def top_locations(limit: int = Query(default=10, ge=1, le=100)):
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    master_df = risk_engine.master_df
    top = master_df["location"].value_counts().head(limit).reset_index()
    top.columns = ["location", "ticket_count"]
    return {"locations": top.to_dict(orient="records")}


@app.get("/api/analytics/severity-location-heatmap")
async def severity_location_heatmap():
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    master_df = risk_engine.master_df
    sev_map = {0: "0: Low/Normal", 1: "1: Medium", 2: "2: Severe"}
    cross = master_df.groupby(["location", "fault_severity"]).size().reset_index(name="volume")
    cross["severity_label"] = cross["fault_severity"].map(sev_map)
    return {"heatmap": cross.to_dict(orient="records")}


# ---------------------------------------------------------------------------
# History / audit
# ---------------------------------------------------------------------------
@app.get("/api/history/predictions")
async def history_predictions(limit: int = Query(default=50, ge=1, le=500)):
    df = get_prediction_history(limit=limit)
    if df.empty:
        return {"predictions": []}
    df = df.fillna("")
    return {"predictions": df.to_dict(orient="records")}


@app.get("/api/history/audit-logs")
async def history_audit_logs(limit: int = Query(default=50, ge=1, le=500)):
    df = get_ai_audit_logs(limit=limit)
    if df.empty:
        return {"audit_logs": []}
    df = df.fillna("")
    return {"audit_logs": df.to_dict(orient="records")}


# ---------------------------------------------------------------------------
# Analyze ticket
# ---------------------------------------------------------------------------
@app.post("/api/analyze/{ticket_id}")
async def analyze_ticket(ticket_id: int):
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    try:
        summary = risk_engine.analyze_ticket(ticket_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Log prediction
    log_prediction(
        ticket_id=summary["ticket_id"],
        location=summary["location"],
        pred_severity=summary["predicted_severity"],
        pred_label=summary["predicted_severity_label"],
        confidence=summary["confidence"],
        anomaly_mse=summary["anomaly_mse"],
        threshold=summary["threshold"],
        anomaly_status=summary["anomaly_status"],
        combined_risk=summary["combined_risk"],
        risk_category=summary["risk_category"],
        urgency=summary["urgency"],
    )

    return summary


@app.post("/api/custom-prediction")
async def analyze_custom_ticket(req: CustomPredictionRequest):
    if not risk_engine:
        raise HTTPException(status_code=503, detail="Engine not loaded yet.")
    summary = risk_engine.analyze_custom_ticket(**req.model_dump())
    log_prediction(
        ticket_id=summary["ticket_id"], location=summary["location"],
        pred_severity=summary["predicted_severity"], pred_label=summary["predicted_severity_label"],
        confidence=summary["confidence"], anomaly_mse=summary["anomaly_mse"],
        threshold=summary["threshold"], anomaly_status=summary["anomaly_status"],
        combined_risk=summary["combined_risk"], risk_category=summary["risk_category"], urgency=summary["urgency"],
    )
    return summary


# ---------------------------------------------------------------------------
# AI actions
# ---------------------------------------------------------------------------
@app.post("/api/ai/root-cause")
async def ai_root_cause(req: AIRootCauseRequest):
    result, is_gemini = generate_root_cause_analysis(
        req.ticket_summary, custom_api_key=req.api_key
    )
    log_ai_action(
        ticket_id=req.ticket_summary.get("ticket_id", 0),
        action_type="ROOT_CAUSE",
        input_context=json.dumps(req.ticket_summary),
        ai_response=json.dumps(result),
        is_gemini=is_gemini,
    )
    return {"result": result, "is_gemini": is_gemini}


@app.post("/api/ai/recommendations")
async def ai_recommendations(req: AIRecommendationsRequest):
    result, is_gemini = generate_maintenance_recommendations(
        req.ticket_summary, custom_api_key=req.api_key
    )
    log_ai_action(
        ticket_id=req.ticket_summary.get("ticket_id", 0),
        action_type="RECOMMENDATION",
        input_context=json.dumps(req.ticket_summary),
        ai_response=json.dumps(result),
        is_gemini=is_gemini,
    )
    return {"result": result, "is_gemini": is_gemini}


@app.post("/api/ai/incident-summary")
async def ai_incident_summary(req: AIIncidentSummaryRequest):
    result, is_gemini = generate_incident_summary(
        req.ticket_summary, custom_api_key=req.api_key
    )
    log_ai_action(
        ticket_id=req.ticket_summary.get("ticket_id", 0),
        action_type="SUMMARY",
        input_context=json.dumps(req.ticket_summary),
        ai_response=json.dumps(result),
        is_gemini=is_gemini,
    )
    return {"result": result, "is_gemini": is_gemini}


@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest):
    answer, is_gemini = answer_copilot_chat(
        req.ticket_summary, req.message, req.history, custom_api_key=req.api_key
    )
    log_ai_action(
        ticket_id=req.ticket_summary.get("ticket_id", 0),
        action_type="COPILOT_CHAT",
        input_context=req.message,
        ai_response=answer,
        is_gemini=is_gemini,
    )
    return {"answer": answer, "is_gemini": is_gemini}
