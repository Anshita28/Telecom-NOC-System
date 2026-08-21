"""
Gemini GenAI Service & Deterministic Fallback Module
Handles AI Root Cause Analysis, Preventive Maintenance Recommendations,
Incident Summaries, and Interactive NOC Copilot Chat.
"""

import os
import json
from ai.prompts import (
    SYSTEM_NOC_PROMPT, build_root_cause_prompt,
    build_recommendations_prompt, build_copilot_chat_prompt
)

def get_gemini_client(custom_key=None):
    api_key = custom_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        return client
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")
        return None

def deterministic_root_cause_fallback(summary: dict) -> dict:
    """
    Local deterministic fallback generator for Root Cause Analysis
    when no Gemini API key is available or API calls fail.
    """
    events = summary.get('active_events', [])
    resources = summary.get('active_resources', [])
    severities = summary.get('active_severities', [])
    logs = summary.get('active_logs', {})
    risk_cat = summary.get('risk_category', 'LOW')
    mse = summary.get('anomaly_mse', 0.0)
    thresh = summary.get('threshold', 0.0)
    
    event_str = ", ".join(events) if events else "Standard Event Registration"
    resource_str = ", ".join(resources) if resources else "Generic Network Layer"
    sev_str = ", ".join(severities) if severities else "Standard Severity"
    top_log = list(logs.keys())[0] if logs else "log_feature_generic"
    top_vol = list(logs.values())[0] if logs else 1

    if risk_cat in ["CRITICAL", "HIGH"]:
        assessment = f"Executive Alert: High-risk telemetry profile detected at location {summary.get('location')}. High probability of operational disruption."
        hypothesis = f"Observed clustering of {event_str} on {resource_str} accompanied by abnormal surge in {top_log} (volume={top_vol}) indicates primary network subsystem stress or link congestion."
        confidence = "High Confidence" if len(events) >= 2 and top_vol > 20 else "Medium Confidence"
    elif risk_cat == "ELEVATED":
        assessment = f"Attention Required: Telemetry pattern shows abnormal statistical deviation (MSE={mse:.4f} vs threshold={thresh:.4f}) despite low explicit fault classifier score."
        hypothesis = f"Telemetry anomaly detected across {resource_str} driven by uncharacteristic volume of {top_log}. Indicates early-stage component degradation or transient network jitter."
        confidence = "Medium Confidence"
    else:
        assessment = f"Normal Network Status: Ticket demonstrates low fault probability ({summary.get('prob_fault'):.1%}) and normal reconstruction metrics."
        hypothesis = f"Routine operational telemetry signature. Active event types ({event_str}) match standard baseline behavior."
        confidence = "High Confidence"

    return {
        "executive_assessment": assessment,
        "probable_root_cause_hypothesis": f"[HYPOTHESIS] {hypothesis}",
        "confidence_estimate": confidence,
        "observed_telemetry_evidence": [
            f"Active Event Types: {event_str}",
            f"Active Resource Types: {resource_str}",
            f"Active Severity Types: {sev_str}",
            f"Highest Volume Log Feature: {top_log} (Volume = {top_vol})"
        ],
        "model_derived_evidence": [
            f"Predicted Fault Severity: {summary.get('predicted_severity_label')} (Confidence: {summary.get('confidence'):.1%})",
            f"Autoencoder Reconstruction MSE: {mse:.4f} (Threshold: {thresh:.4f})",
            f"Anomaly Status: {summary.get('anomaly_status')}",
            f"Combined Risk Score: {summary.get('combined_risk'):.1%} ({risk_cat})"
        ],
        "uncertainty_statement": "Note: Root-cause identification is a statistical hypothesis derived from ticket log features and event presence. Physical hardware diagnostics or live fiber tracing require manual NOC verification."
    }

def generate_root_cause_analysis(summary: dict, custom_api_key=None) -> tuple[dict, bool]:
    client = get_gemini_client(custom_api_key)
    if client:
        try:
            prompt = build_root_cause_prompt(summary)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{SYSTEM_NOC_PROMPT}\n\n{prompt}"
            )
            text = response.text
            
            # Create response dictionary
            result = {
                "executive_assessment": f"Gemini GenAI Analysis for Ticket #{summary.get('ticket_id')}",
                "probable_root_cause_hypothesis": text,
                "confidence_estimate": "High (Gemini 2.5 Flash)",
                "observed_telemetry_evidence": [f"Events: {', '.join(summary.get('active_events', []))}", f"Resources: {', '.join(summary.get('active_resources', []))}"],
                "model_derived_evidence": [f"Predicted Severity: {summary.get('predicted_severity_label')}", f"Combined Risk: {summary.get('combined_risk'):.1%}"],
                "uncertainty_statement": "AI-generated analysis. Verify with local network telemetry prior to field dispatch."
            }
            return result, True
        except Exception as e:
            print(f"Gemini API call failed, reverting to local fallback: {e}")
            
    return deterministic_root_cause_fallback(summary), False

def deterministic_maintenance_fallback(summary: dict) -> dict:
    risk_cat = summary.get('risk_category', 'LOW')
    resources = summary.get('active_resources', [])
    res_str = ", ".join(resources) if resources else "network interface"
    
    if risk_cat == "CRITICAL":
        p_lvl = "P1 - CRITICAL URGENCY"
        urgency = "Immediate Field Dispatch (Within 1 Hour)"
        checks = [
            f"Perform optical time-domain reflectometer (OTDR) or link test on {res_str}.",
            "Inspect power supply units (PSU) and transceivers for hardware alarms.",
            "Verify routing table convergence and packet loss rates on core interfaces."
        ]
        actions = [
            f"Reroute critical traffic from affected location ({summary.get('location')}) to backup link.",
            "Dispatch tier-3 field technician for hardware replacement.",
            "Isolate flapping ports or faulty resource module."
        ]
        monitoring = [
            "Enable 1-minute interval high-frequency telemetry logging.",
            "Set real-time alert triggers for log volume spikes."
        ]
    elif risk_cat == "HIGH":
        p_lvl = "P2 - HIGH PRIORITY"
        urgency = "Targeted Maintenance Inspection (Within 4-8 Hours)"
        checks = [
            f"Run diagnostic loopback tests on active resource modules ({res_str}).",
            "Audit recent configuration changes and firmware update logs."
        ]
        actions = [
            "Schedule maintenance window to reset or recalibrate affected interface.",
            "Clear buffer queues and check thermal thresholds."
        ]
        monitoring = [
            "Monitor error rate trends for 24 hours post-maintenance."
        ]
    elif risk_cat == "ELEVATED":
        p_lvl = "P3 - ATTENTION"
        urgency = "Review Logs & Abnormal Telemetry (Within 24 Hours)"
        checks = [
            "Inspect raw event log streams for unusual volume bursts.",
            "Check neighbor node health and protocol keep-alive status."
        ]
        actions = [
            "Soft-reset interface controller if log volumes remain elevated.",
            "Verify memory and CPU utilization trends."
        ]
        monitoring = [
            "Keep ticket under elevated monitoring status for 48 hours."
        ]
    else:
        p_lvl = "P4 - ROUTINE"
        urgency = "Standard Monitoring Cycle"
        checks = [
            "Conduct standard periodic health audit."
        ]
        actions = [
            "No immediate physical intervention required."
        ]
        monitoring = [
            "Maintain baseline automated monitoring."
        ]

    return {
        "priority_level": p_lvl,
        "urgency_category": urgency,
        "diagnostic_checks": checks,
        "maintenance_actions": actions,
        "monitoring_recommendations": monitoring
    }

def generate_maintenance_recommendations(summary: dict, custom_api_key=None) -> tuple[dict, bool]:
    client = get_gemini_client(custom_api_key)
    if client:
        try:
            prompt = build_recommendations_prompt(summary)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{SYSTEM_NOC_PROMPT}\n\n{prompt}"
            )
            text = response.text
            result = {
                "priority_level": summary.get('urgency'),
                "urgency_category": f"GenAI Recommended Action for Ticket #{summary.get('ticket_id')}",
                "diagnostic_checks": [text],
                "maintenance_actions": ["Follow Gemini guidance above."],
                "monitoring_recommendations": ["Review post-maintenance logs."]
            }
            return result, True
        except Exception as e:
            print(f"Gemini API call failed: {e}")
            
    return deterministic_maintenance_fallback(summary), False

def generate_incident_summary(summary: dict, custom_api_key=None) -> tuple[dict, bool]:
    client = get_gemini_client(custom_api_key)
    if client:
        try:
            prompt = f"Provide a bulleted NOC Executive Briefing for Ticket #{summary.get('ticket_id')} at {summary.get('location')} with Risk {summary.get('risk_category')} ({summary.get('combined_risk'):.1%})."
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{SYSTEM_NOC_PROMPT}\n\n{prompt}"
            )
            return {"summary": response.text, "is_gemini": True}, True
        except Exception as e:
            print(f"Gemini API call failed: {e}")

    # Fallback
    exec_summary = (
        f"NOC INCIDENT BRIEFING - TICKET #{summary.get('ticket_id')}\n"
        f"Location: {summary.get('location')} | Risk Level: {summary.get('risk_category')} ({summary.get('combined_risk'):.1%})\n"
        f"Predicted Severity: {summary.get('predicted_severity_label')} (Confidence: {summary.get('confidence'):.1%})\n"
        f"Autoencoder Anomaly MSE: {summary.get('anomaly_mse'):.4f} (Threshold: {summary.get('threshold'):.4f})\n"
        f"Active Signals: Events [{', '.join(summary.get('active_events', []))}], Resources [{', '.join(summary.get('active_resources', []))}]\n"
        f"Recommended Urgency: {summary.get('urgency')}"
    )
    return {"summary": exec_summary, "is_gemini": False}, False

def answer_copilot_chat(summary: dict, question: str, chat_history: list, custom_api_key=None) -> tuple[str, bool]:
    client = get_gemini_client(custom_api_key)
    if client:
        try:
            prompt = build_copilot_chat_prompt(summary, question, chat_history)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            return response.text, True
        except Exception as e:
            print(f"Gemini Copilot chat error: {e}")

    # Local Rule-based Copilot Fallback Response Generator
    q_lower = question.lower()
    t_id = summary.get('ticket_id')
    loc = summary.get('location')
    pred_sev = summary.get('predicted_severity_label')
    conf = summary.get('confidence')
    risk = summary.get('combined_risk')
    risk_cat = summary.get('risk_category')
    mse = summary.get('anomaly_mse')
    thresh = summary.get('threshold')
    status = summary.get('anomaly_status')
    events = ", ".join(summary.get('active_events', ['None']))
    resources = ", ".join(summary.get('active_resources', ['None']))
    logs = ", ".join([f"{k} (vol={v})" for k, v in summary.get('active_logs', {}).items()])

    if "severity" in q_lower or "predict" in q_lower:
        ans = f"Ticket #{t_id} at location {loc} is predicted as **{pred_sev}** with **{conf:.1%} confidence** by the F1-weighted ensemble of Random Forest, XGBoost, SVM, LSTM, and GRU."
    elif "risk" in q_lower or "combined" in q_lower:
        ans = f"The combined operational risk score for Ticket #{t_id} is **{risk:.1%}** (**{risk_cat}**). Formula: 50% ensemble P(fault) + 25% autoencoder anomaly + 25% LSTM/GRU sequence fault probability."
    elif "anomaly" in q_lower or "autoencoder" in q_lower or "mse" in q_lower:
        ans = f"The PyTorch Autoencoder measured a reconstruction MSE of **{mse:.4f}** against an anomaly threshold of **{thresh:.4f}**. Anomaly Status: **{status}**."
    elif "event" in q_lower or "resource" in q_lower or "log" in q_lower or "signal" in q_lower:
        ans = f"Active Telemetry Signals for Ticket #{t_id}:\n- Active Events: {events}\n- Active Resources: {resources}\n- Active Log Features: {logs}"
    elif "recommend" in q_lower or "action" in q_lower or "do" in q_lower:
        ans = f"For Ticket #{t_id} ({risk_cat} risk level), recommended urgency is **{summary.get('urgency')}**. Inspect active resources ({resources}) and check log volume spikes in {logs}."
    else:
        ans = (
            f"Regarding Ticket #{t_id} at {loc}:\n"
            f"- Predicted Severity: **{pred_sev}** ({conf:.1%} confidence)\n"
            f"- Autoencoder MSE: **{mse:.4f}** (Threshold: {thresh:.4f}) -> {status}\n"
            f"- Combined Operational Risk: **{risk:.1%}** ({risk_cat})\n"
            f"- Active Signals: Events [{events}], Resources [{resources}]\n"
            f"Feel free to ask about risk math, active logs, anomaly status, or maintenance actions!"
        )
    return ans, False
