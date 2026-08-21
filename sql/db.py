"""
SQLite Database Helper Module for Telecom Fault Prediction System
Handles initialization of DB tables, loading initial telecom master records,
logging predictions, and auditing AI NOC Copilot actions.
"""

import os
import sqlite3
import pandas as pd

DB_PATH = os.path.join(os.path.dirname(__file__), "telecom_noc.db")
SQL_SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "database.sql")

def get_connection():
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def init_db(data_dir="data"):
    """
    Initializes SQLite tables and populates initial ticket dataset if empty.
    """
    conn = get_connection()
    cursor = conn.cursor()

    if os.path.exists(SQL_SCHEMA_PATH):
        with open(SQL_SCHEMA_PATH, "r") as f:
            schema_sql = f.read()
        cursor.executescript(schema_sql)

    # Always re-populate telecom_data if count doesn't match current telecom_failure_master.csv length
    master_csv = os.path.join(data_dir, "telecom_failure_master.csv")
    if os.path.exists(master_csv):
        df = pd.read_csv(master_csv)
        cursor.execute("SELECT COUNT(*) FROM telecom_data")
        count = cursor.fetchone()[0]
        if count != len(df):
            cursor.execute("DELETE FROM telecom_data")
            subset_df = df[['id', 'location', 'fault_severity']]
            subset_df.to_sql("telecom_data", conn, if_exists="append", index=False)
            print(f"Populated database table 'telecom_data' with {len(subset_df)} real ticket records.")

    conn.commit()
    conn.close()

def log_prediction(ticket_id, location, pred_severity, pred_label, confidence, anomaly_mse, threshold, anomaly_status, combined_risk, risk_category, urgency):
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
    INSERT INTO predictions (
        ticket_id, location, predicted_severity, predicted_severity_label,
        model_confidence, anomaly_mse, anomaly_threshold, anomaly_status,
        combined_risk_score, risk_category, urgency_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    cursor.execute(query, (
        int(ticket_id), str(location), int(pred_severity), str(pred_label),
        float(confidence), float(anomaly_mse), float(threshold), str(anomaly_status),
        float(combined_risk), str(risk_category), str(urgency)
    ))
    conn.commit()
    conn.close()

def log_ai_action(ticket_id, action_type, input_context, ai_response, is_gemini=False):
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
    INSERT INTO ai_audit_logs (ticket_id, action_type, input_context, ai_response, is_gemini_generated)
    VALUES (?, ?, ?, ?, ?)
    """
    cursor.execute(query, (int(ticket_id), str(action_type), str(input_context), str(ai_response), 1 if is_gemini else 0))
    conn.commit()
    conn.close()

def get_prediction_history(limit=50):
    conn = get_connection()
    query = f"SELECT * FROM predictions ORDER BY created_at DESC LIMIT {limit}"
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def get_ai_audit_logs(limit=50):
    conn = get_connection()
    query = f"SELECT * FROM ai_audit_logs ORDER BY created_at DESC LIMIT {limit}"
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df
