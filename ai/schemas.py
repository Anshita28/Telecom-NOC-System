"""
Data Schemas for Telecom Fault Analytics and GenAI Output Structures
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class RootCauseAnalysis(BaseModel):
    executive_assessment: str = Field(..., description="High-level overview of ticket status and risk level.")
    probable_root_cause_hypothesis: str = Field(..., description="Evidence-grounded hypothesis of primary fault cause.")
    confidence_estimate: str = Field(..., description="High, Medium, or Low confidence based on active signal density.")
    observed_telemetry_evidence: List[str] = Field(default_factory=list, description="Explicit active events, resources, log volumes.")
    model_derived_evidence: List[str] = Field(default_factory=list, description="Classifier fault risk and Autoencoder MSE error.")
    uncertainty_statement: str = Field(..., description="Explicit disclaimer regarding unobserved data and hypothesis limitations.")

class PreventiveMaintenanceRecommendation(BaseModel):
    priority_level: str = Field(..., description="P1 - Critical, P2 - High, P3 - Medium, P4 - Routine.")
    urgency_category: str = Field(..., description="Recommended dispatch timeline (e.g. Immediate NOC Dispatch vs Routine Audit).")
    diagnostic_checks: List[str] = Field(default_factory=list, description="Recommended diagnostic tests for NOC engineers.")
    maintenance_actions: List[str] = Field(default_factory=list, description="Actionable physical/logical maintenance protocols.")
    monitoring_recommendations: List[str] = Field(default_factory=list, description="Telemetry monitoring and follow-up guidance.")

class IncidentSummary(BaseModel):
    executive_summary: str = Field(..., description="Brief NOC ticket briefing.")
    key_findings: List[str] = Field(default_factory=list, description="Core anomalies and severity signals.")
    immediate_next_steps: List[str] = Field(default_factory=list, description="Recommended immediate engineer steps.")
