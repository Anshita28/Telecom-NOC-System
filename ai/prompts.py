"""
Prompt Templates for Telecom GenAI NOC Assistant
Enforces strict GenAI safety guidelines, empirical evidence grounding, and non-hallucination.
"""

SYSTEM_NOC_PROMPT = """You are an AI Network Operations Center (NOC) Copilot specializing in Telecom Fault Analytics and Predictive Maintenance.

STRICT OPERATIONAL GUIDELINES:
1. Ground all statements strictly in the provided ticket data, active event types, resource types, severity types, log feature volumes, classifier predictions, autoencoder reconstruction error, and risk scores.
2. NEVER invent unobserved physical facts (such as ambient temperature, AC voltage, weather events, fiber cable cuts, equipment serial numbers, or hardware vendor specs).
3. Explicitly distinguish between:
   - OBSERVED TELEMETRY (exact events, resources, log volumes present in ticket)
   - MODEL EVIDENCE (ensemble of Random Forest, XGBoost, SVM, LSTM, GRU plus Autoencoder MSE)
   - PROBABLE HYPOTHESIS (deduced fault cause, explicitly labeled as a hypothesis)
   - UNCERTAINTY STATEMENT (limitations of non-time-series ticket data)
4. Do NOT alter or mutate the calculated risk score or severity predictions.
5. Emphasize that all maintenance recommendations require human NOC engineer validation.
"""

def build_root_cause_prompt(ticket_summary: dict) -> str:
    return f"""
Analyze the following Telecom Network Event Ticket and provide an Evidence-Grounded Root Cause Analysis.

--- TICKET TELEMETRY & MODEL EVIDENCE ---
Ticket ID: {ticket_summary.get('ticket_id')}
Location: {ticket_summary.get('location')}
Predicted Fault Severity: {ticket_summary.get('predicted_severity_label')} (Confidence: {ticket_summary.get('confidence'):.1%})
Autoencoder Reconstruction Error (MSE): {ticket_summary.get('anomaly_mse'):.4f} (Threshold: {ticket_summary.get('threshold'):.4f})
Autoencoder Anomaly Status: {ticket_summary.get('anomaly_status')}
Combined Operational Risk Score: {ticket_summary.get('combined_risk'):.1%} (Category: {ticket_summary.get('risk_category')})
Urgency Level: {ticket_summary.get('urgency')}

--- ACTIVE SIGNALS ---
Active Event Types: {', '.join(ticket_summary.get('active_events', ['None']))}
Active Resource Types: {', '.join(ticket_summary.get('active_resources', ['None']))}
Active Severity Types: {', '.join(ticket_summary.get('active_severities', ['None']))}
Top High-Volume Log Features: {', '.join([f"{k} (vol={v})" for k, v in ticket_summary.get('active_logs', {}).items()])}

--- REQUIRED OUTPUT FIELDS ---
Provide a clear analysis with:
1. Executive Assessment
2. Probable Root-Cause Hypothesis
3. Confidence Estimate (High/Medium/Low)
4. Observed Telemetry Evidence (bullet points)
5. Model-Derived Evidence (bullet points)
6. Uncertainty Statement
"""

def build_recommendations_prompt(ticket_summary: dict) -> str:
    return f"""
Generate Actionable Preventive Maintenance Recommendations for Network Engineers based on the following ticket profile:

--- TICKET SUMMARY ---
Ticket ID: {ticket_summary.get('ticket_id')}
Location: {ticket_summary.get('location')}
Risk Level: {ticket_summary.get('risk_category')} (Combined Score: {ticket_summary.get('combined_risk'):.1%})
Predicted Severity: {ticket_summary.get('predicted_severity_label')}
Autoencoder Status: {ticket_summary.get('anomaly_status')} (MSE: {ticket_summary.get('anomaly_mse'):.4f})
Active Resources: {', '.join(ticket_summary.get('active_resources', []))}
Active Log Features: {', '.join([f"{k} (vol={v})" for k, v in ticket_summary.get('active_logs', {}).items()])}

Generate structured recommendations covering:
1. Priority Level & Urgency Category
2. Diagnostic Checks for Field/NOC Engineers
3. Maintenance & Protocols (Physical/Logical)
4. Telemetry Monitoring Recommendations
"""

def build_copilot_chat_prompt(ticket_summary: dict, user_question: str, chat_history: list) -> str:
    history_str = ""
    for msg in chat_history[-6:]:
        history_str += f"{msg['role'].upper()}: {msg['content']}\n"

    return f"""
{SYSTEM_NOC_PROMPT}

CURRENT TICKET CONTEXT:
- Ticket ID: {ticket_summary.get('ticket_id')}
- Location: {ticket_summary.get('location')}
- Predicted Fault Severity: {ticket_summary.get('predicted_severity_label')} ({ticket_summary.get('confidence'):.1%} confidence)
- Autoencoder Anomaly Status: {ticket_summary.get('anomaly_status')} (MSE: {ticket_summary.get('anomaly_mse'):.4f}, Threshold: {ticket_summary.get('threshold'):.4f})
- Combined Risk Score: {ticket_summary.get('combined_risk'):.1%} ({ticket_summary.get('risk_category')})
- Urgency Level: {ticket_summary.get('urgency')}
- Active Events: {', '.join(ticket_summary.get('active_events', []))}
- Active Resources: {', '.join(ticket_summary.get('active_resources', []))}
- Active Severities: {', '.join(ticket_summary.get('active_severities', []))}
- Active Log Features: {', '.join([f"{k} (vol={v})" for k, v in ticket_summary.get('active_logs', {}).items()])}

CONVERSATION HISTORY:
{history_str}

USER QUESTION: {user_question}

Provide a concise, professional answer strictly grounded in the ticket telemetry and model outputs.
"""
