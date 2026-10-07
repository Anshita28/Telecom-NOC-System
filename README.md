 # Telecom NOC AI — Fault Prediction & Predictive Maintenance System

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-orange.svg)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB.svg)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI-powered Network Operations Center (NOC) decision-support platform built on the real **Telstra Recruiting Network Disruptions Dataset** (Kaggle). It predicts fault-severity risk with a 5-model ensemble, detects telemetry anomalies with a PyTorch autoencoder, fuses every signal into one operational risk score, explains its predictions via feature attribution, and generates evidence-grounded root-cause hypotheses and preventive recommendations through a Gemini-powered (or fully offline) NOC copilot.

Built for the **Cognizant Nurture Partner Network (NPN) 2027 — AI & Analytics Hackathon**, Use Case 14: *Telecom Network Fault Prediction & Predictive Maintenance*.

Team 9 · KIET Group of Institutions · CSE (AI/ML)

---

## 📌 Problem Statement

Telecom networks generate large volumes of event tickets, alarm logs, and resource alerts. NOC engineers must triage these quickly, flag high-severity faults before they escalate into outages, and diagnose likely root causes — usually under time pressure with incomplete context.

This system closes that loop with three layers:

1. **Supervised Fault Severity Prediction** — a 5-model ensemble (Random Forest, XGBoost, SVM, LSTM, GRU) classifies each ticket as `0` (Low/No Fault), `1` (Medium Fault), or `2` (Severe Fault).
2. **Unsupervised Anomaly Detection** — a PyTorch autoencoder, trained only on normal (severity-0) tickets, flags telemetry that doesn't reconstruct well — catching patterns the classifier has no labeled examples for.
3. **Combined Risk Engine + XAI + NOC Copilot** — fuses all signals into one operational risk score, explains *why* via top contributing signals, and generates plain-language root-cause hypotheses and recommendations (Gemini 3.5 Flash, with a fully offline deterministic fallback).

---

## 📂 Dataset: Real Telstra Data, Not Synthetic

Runs entirely on the real Kaggle Telstra competition files (`kaggle competitions download -c telstra-recruiting-network`) — no synthetic data anywhere in the pipeline.

| File | Rows | Columns | Represents |
|---|---|---|---|
| `train.csv` | 7,381 | `id`, `location`, `fault_severity` | Labeled training tickets |
| `test.csv` | 11,171 | `id`, `location` | Unlabeled tickets |
| `event_type.csv` | 31,170 | `id`, `event_type` | Alarm/event categories |
| `resource_type.csv` | 21,076 | `id`, `resource_type` | Device/resource categories |
| `severity_type.csv` | 18,552 | `id`, `severity_type` | Raw alarm severity level |
| `log_feature.csv` | 58,671 | `id`, `log_feature`, `volume` | Log feature + volume count |

**Verified integrity**: 929 unique locations, real class distribution (~65% / 25% / 10% for severity 0/1/2), `sample_submission.csv` present. No target leakage — `id`, raw `location`, and `fault_severity` are excluded from the feature set; only the encoded `location_code` and 454 engineered event/resource/severity/log signals are used (455 features total).

---

## 🏗️ System Architecture

```
Kaggle Telstra archives (dataset/dataset/*.zip)
  → data/generate_dataset.py (unpacks real data)
  → model/features.py (feature engineering → 455 columns)
  → data/telecom_failure_master.csv
        │
        ├── model/train_ml.py       → Random Forest, XGBoost, SVM
        ├── model/train_sequence.py → LSTM, GRU (sequence_models.py)
        └── model/train_autoencoder.py → PyTorch Autoencoder (normal-only)
        │
  → F1-weighted soft-vote ensemble (5 severity models)
  → Combined Risk Engine (ensemble + anomaly + sequence fusion)
  → XAI feature attribution (location_code excluded)
  → Gemini 3.5 Flash / deterministic local fallback (RCA, recommendations, copilot)
  → SQLite (predictions + ai_audit_logs)
        │
  → FastAPI backend (backend/main.py, loaded once at startup)
  → React + TypeScript frontend (Overview, Analysis, Custom Prediction, Models views)
```

**Stack**: Python (FastAPI, scikit-learn, XGBoost, PyTorch) · React/TypeScript (Vite, Tailwind, Recharts, Framer Motion) · SQLite · Google Gemini API.

---

## ⚙️ Setup & Execution

### Prerequisites
- Python 3.10+, Node.js 18+
- (Optional) Google Gemini API key — app runs fully offline without one

### Backend
```bash
pip install -r requirements.txt
cp .env.example .env   # optionally set GEMINI_API_KEY
```

### Build the ML Pipeline
```bash
python data/generate_dataset.py       # unpack real Kaggle archives
python model/train_ml.py              # Random Forest, XGBoost, SVM
python model/train_sequence.py        # LSTM, GRU
python model/train_autoencoder.py     # Autoencoder (anomaly detection)
# or run all of the above via: python model/train_all.py
```

### Validate Before Launching
```bash
python smoke_test.py
```
Runs the risk engine standalone against known tickets and asserts every output is within valid mathematical range — catches model/engine bugs independent of the web server.

### Run Backend + Frontend
```bash
python backend/run.py          # or: uvicorn backend.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

**Note**: models load once at backend startup. After any retrain, fully restart the backend process — a frontend refresh alone will not pick up new model artifacts.

---

## 🔬 Model Evaluation (Real Dataset, Honest Numbers)

All metrics below are read live by the frontend from saved JSON files — nothing is hardcoded in the UI.

| Model | Accuracy | F1 (macro) |
|---|---|---|
| **XGBoost** (primary — best individual model) | **72.71%** | **68.98%** |
| Random Forest | 69.26% | 65.11% |
| GRU | 57.82% | 51.32% |
| SVM | 57.28% | 51.76% |
| LSTM | 55.72% | 50.66% |

**Autoencoder** (anomaly detection, evaluated separately — not a classifier): ROC-AUC **0.6377** · PR-AUC **0.4768** · threshold (95th percentile of normal validation MSE) **1.3836**

*These are real, moderate results on a genuinely difficult, well-known Kaggle competition dataset — intentionally not inflated.*

### Ensemble
All 5 severity models' class probabilities are combined via **F1-weighted soft voting** — each model's contribution weighted by its own macro-F1, so the strongest model (XGBoost) has the most influence without discarding the others.

### Combined Risk Fusion
```
Combined Risk = 0.50 × Ensemble Fault Probability [P(severity ≥ 1)]
              + 0.25 × Autoencoder Anomaly Risk [min(1.0, MSE / threshold)]
              + 0.25 × Sequence (LSTM/GRU) Fault Probability
```
| Risk Category | Condition |
|---|---|
| 🟢 LOW | combined_risk < 0.35 |
| 🟡 ELEVATED | combined_risk ≥ 0.35, or anomaly/early-warning flag |
| 🟠 HIGH | combined_risk ≥ 0.55, or fault probability ≥ 0.50 |
| 🔴 CRITICAL | combined_risk ≥ 0.70 |

---

## 🖥️ Application Features

- **Overview** — dataset-wide KPIs, live model comparison, severity distribution and location heatmap
- **Analysis** — per-ticket prediction: severity, confidence, per-model breakdown, anomaly MSE vs threshold, combined risk, XAI top contributing signals
- **Custom Prediction ("What-If" Simulator)** — manually set signal values (entity type, severity type, event burst, resource count, log volume) and get a live prediction through the exact same models — every field is bounds-validated (Pydantic) before it reaches the model. Explicitly a transparent simulated scenario, not a claim of real historical data.
- **Models** — full benchmark comparison across all 5 severity models plus the autoencoder
- **NOC Copilot** — chat interface grounded in real backend data; Gemini-powered with deterministic offline fallback. AI explains and recommends — it never overrides the deterministic ML prediction, risk score, or anomaly status.
- All AI actions logged to SQLite (`ai_audit_logs`) with a flag for whether Gemini or the fallback was used.

---

## 🩺 Known Fixes & Validation Notes

- **Dynamic metrics** — all evaluation numbers are read live from saved JSON files; sidebar/dashboard/models view always agree.
- **XAI attribution scaling — resolved** — `location_code` (a `LabelEncoder` output ranging 0–928) previously dominated the attribution chart purely by numeric magnitude versus binary event/resource signals, despite modest actual importance (~6%, not top-1). Now explicitly excluded from the attribution-scoring loop; shown separately as location context.
- **Stale cached engine after retrain** — the backend loads models once at startup; a full restart (not a frontend refresh) is required after retraining.
- Run `python smoke_test.py` after any model or code change to catch these classes of bug before a live demo.
- **XAI method is custom, not SHAP** — attribution score = `feature_value × feature_importance`, ranked. A simpler, legitimate method; explicitly not the SHAP algorithm, despite the module name `xai_explainer.py`.

---

## ⚠️ Assumptions & Limitations

> 1. **Ticket-level, not continuous telemetry** — Telstra data is event-ticket data aggregated by ID, not live streaming sensor data.
> 2. **No timestamps in the base dataset** — the system assesses *current* fault-severity risk, not a forecasted future outage date. Sequence models use ticket-ID ordering per location as a chronological proxy, mirroring a known technique from top solutions to this competition.
> 3. **Hypothesis, not diagnosis** — root-cause outputs are statistical hypotheses grounded in observed signals, meant to accelerate a human NOC engineer's triage, not replace it.
> 4. **No automated remediation** — decision support only; no physical or automated network changes are triggered.
> 5. **Modest accuracy is intentional and honest** — 72.71% on a genuinely difficult, imbalanced, real-world classification task is a defensible result, not inflated with synthetic data or leakage.
> 6. **No model versioning yet** — retraining overwrites artifacts in place; a production system would tag and log model versions per prediction.

---

## 🚀 Future Scope

- Graph Neural Network to model fault propagation across connected network locations (current models treat each ticket independently)
- Real streaming telemetry with timestamps → true time-based forecasting, not just current-risk assessment
- SHAP integration to upgrade the current simple attribution method
- Multi-agent GenAI pipeline (dedicated RCA, recommendation, and escalation agents)
- PostgreSQL + containerized deployment for multi-user production scale
- On-prem/fine-tuned LLM for data-sensitive production environments

---

## 🗂️ Project Structure
```
├── ai/                  # xai_explainer.py (risk engine), gemini_service.py, prompts.py
├── backend/              # FastAPI app (main.py, run.py)
├── frontend/              # React + TypeScript (Vite) — Overview, Analysis, Custom Prediction, Models
├── data/                 # Real Telstra CSVs + dataset unpacker
├── dataset/dataset/       # Original Kaggle .zip archives
├── model/                # Training scripts (train_ml.py, train_sequence.py, train_autoencoder.py,
│                          #   train_all.py), sequence_models.py, autoencoder.py, saved artifacts, metrics JSON
├── sql/                  # SQLite schema + DB helper (predictions, audit logs)
├── smoke_test.py          # Standalone risk-engine validation script
├── requirements.txt
└── README.md
```

## 📄 License
MIT

## 🔗 Links
- Repository: [github.com/aryandevtyagi10/Telecom-NOC-System](https://github.com/aryandevtyagi10/Telecom-NOC-System)
- Dataset: [Kaggle — Telstra Recruiting Network Disruptions](https://www.kaggle.com/c/telstra-recruiting-network)
- 
