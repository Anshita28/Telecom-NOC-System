-- Database Schema for Telecom Network Fault Prediction and Predictive Maintenance System

-- 1. Raw & Engineered Telecom Data Table
CREATE TABLE IF NOT EXISTS telecom_data (
    id INTEGER PRIMARY KEY,
    location TEXT NOT NULL,
    fault_severity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Network Predictions Table
CREATE TABLE IF NOT EXISTS predictions (
    prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    location TEXT NOT NULL,
    predicted_severity INTEGER NOT NULL,
    predicted_severity_label TEXT NOT NULL,
    model_confidence REAL NOT NULL,
    anomaly_mse REAL NOT NULL,
    anomaly_threshold REAL NOT NULL,
    anomaly_status TEXT NOT NULL,
    combined_risk_score REAL NOT NULL,
    risk_category TEXT NOT NULL,
    urgency_level TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. AI Operations Audit Logs Table
CREATE TABLE IF NOT EXISTS ai_audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 'ROOT_CAUSE', 'RECOMMENDATION', 'SUMMARY', 'COPILOT_CHAT'
    input_context TEXT,
    ai_response TEXT NOT NULL,
    is_gemini_generated INTEGER DEFAULT 0, -- 1 if Gemini API, 0 if local fallback
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
