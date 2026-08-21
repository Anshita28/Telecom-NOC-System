"""
Multi-model inference: RF / XGBoost / SVM severity, LSTM / GRU sequence severity,
Autoencoder early-warning anomaly, F1-weighted ensemble, and XAI attributions.
"""

from __future__ import annotations

import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
import torch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from model.autoencoder import TelecomDenseAutoencoder
from model.sequence_models import TicketSequenceClassifier

SEVERITY_LABELS = {0: "0 (Low / No Fault)", 1: "1 (Medium Fault)", 2: "2 (Severe Fault)"}
CLASSIFIERS = ("random_forest", "xgboost", "svm", "lstm", "gru")


def _softmax(values: list[float]) -> np.ndarray:
    a = np.asarray(values, dtype=np.float64)
    a = a - np.max(a)
    e = np.exp(a)
    return e / np.clip(e.sum(), 1e-12, None)


class TelecomRiskEngine:
    def __init__(self, data_dir="data", model_dir="model"):
        self.data_dir = data_dir
        self.model_dir = model_dir
        self._load_artifacts()

    def _load_artifacts(self):
        print("Loading RF, XGBoost, SVM, LSTM, GRU, and Autoencoder artifacts...")
        cols_path = os.path.join(self.model_dir, "model_columns.pkl")
        le_path = os.path.join(self.model_dir, "label_encoder.pkl")
        self.feature_cols = joblib.load(cols_path)
        self.le_location = joblib.load(le_path)

        self.models = {
            "random_forest": joblib.load(os.path.join(self.model_dir, "rf_model.pkl")),
            "xgboost": joblib.load(os.path.join(self.model_dir, "xgb_model.pkl")),
            "svm": joblib.load(os.path.join(self.model_dir, "svm_model.pkl")),
        }
        self.classifier = self.models["xgboost"]

        seq_meta = joblib.load(os.path.join(self.model_dir, "sequence_meta.pkl"))
        self.seq_meta = seq_meta
        seq = np.load(os.path.join(self.model_dir, "sequences.npz"))
        self.seq_feat_ids = seq["feat_ids"]
        self.seq_volumes = seq["volumes"]
        self.seq_loc = seq["loc_codes"]
        self.seq_ticket_index = {int(t): i for i, t in enumerate(seq["ticket_ids"])}

        device = torch.device("cpu")
        self.lstm = TicketSequenceClassifier(
            vocab_size=seq_meta["vocab_size"], n_locations=seq_meta["n_locations"], cell="lstm"
        )
        self.gru = TicketSequenceClassifier(
            vocab_size=seq_meta["vocab_size"], n_locations=seq_meta["n_locations"], cell="gru"
        )
        self.lstm.load_state_dict(torch.load(os.path.join(self.model_dir, "lstm_model.pt"), map_location=device))
        self.gru.load_state_dict(torch.load(os.path.join(self.model_dir, "gru_model.pt"), map_location=device))
        self.lstm.eval()
        self.gru.eval()

        ae_model_path = os.path.join(self.model_dir, "autoencoder_model.pt")
        self.scaler = joblib.load(os.path.join(self.model_dir, "autoencoder_scaler.pkl"))
        self.threshold = float(joblib.load(os.path.join(self.model_dir, "autoencoder_threshold.pkl")))
        with open(os.path.join(self.model_dir, "autoencoder_metadata.json"), "r") as f:
            self.ae_metadata = json.load(f)

        self.autoencoder = TelecomDenseAutoencoder(input_dim=len(self.feature_cols), bottleneck_dim=16)
        self.autoencoder.load_state_dict(torch.load(ae_model_path, map_location=device))
        self.autoencoder.eval()

        metrics_path = os.path.join(self.model_dir, "all_model_metrics.json")
        if os.path.exists(metrics_path):
            with open(metrics_path, "r") as f:
                self.all_metrics = json.load(f)
        else:
            self.all_metrics = {}

        f1s = [float(self.all_metrics.get(name, {}).get("f1_macro", 0.5)) for name in CLASSIFIERS]
        self.ensemble_weights = {name: float(w) for name, w in zip(CLASSIFIERS, _softmax(f1s))}

        self.master_df = pd.read_csv(os.path.join(self.data_dir, "telecom_failure_master.csv"))
        self.importances = self._combined_importances()

    def _combined_importances(self) -> np.ndarray:
        n = len(self.feature_cols)
        acc = np.zeros(n, dtype=np.float64)
        used = 0
        for key in ("random_forest", "xgboost"):
            mdl = self.models.get(key)
            if mdl is not None and hasattr(mdl, "feature_importances_"):
                imp = np.asarray(mdl.feature_importances_, dtype=np.float64)
                if len(imp) == n:
                    acc += imp
                    used += 1
        if used == 0:
            return np.ones(n) / n
        return acc / used

    def get_all_ticket_ids(self):
        return self.master_df["id"].tolist()

    def _tabular_proba(self, x_df: pd.DataFrame, name: str) -> np.ndarray:
        mdl = self.models[name]
        arr = x_df.to_numpy(dtype=np.float32)
        probs = mdl.predict_proba(arr)
        probs = np.asarray(probs[0], dtype=np.float64)
        if name == "svm":
            classes = list(mdl.named_steps["clf"].classes_)
        else:
            classes = list(getattr(mdl, "classes_", [0, 1, 2]))
        aligned = np.zeros(3, dtype=np.float64)
        for i, c in enumerate(classes):
            aligned[int(c)] = probs[i]
        s = aligned.sum()
        return aligned / s if s > 0 else np.array([1.0, 0.0, 0.0])

    def _sequence_proba(self, ticket_id: int, net: TicketSequenceClassifier) -> np.ndarray:
        idx = self.seq_ticket_index.get(int(ticket_id))
        if idx is None:
            return np.array([1.0, 0.0, 0.0])
        feat_ids = torch.tensor(self.seq_feat_ids[idx : idx + 1], dtype=torch.long)
        volumes = torch.tensor(self.seq_volumes[idx : idx + 1], dtype=torch.float32)
        loc = torch.tensor(self.seq_loc[idx : idx + 1], dtype=torch.long)
        with torch.no_grad():
            logits = net(feat_ids, volumes, loc)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
        return probs.astype(np.float64)

    def analyze_ticket(self, ticket_id: int) -> dict:
        ticket_row = self.master_df[self.master_df["id"] == ticket_id]
        if ticket_row.empty:
            raise ValueError(f"Ticket ID {ticket_id} not found in master dataset.")

        ticket_row = ticket_row.iloc[0]
        location = str(ticket_row["location"])
        actual_severity = int(ticket_row["fault_severity"]) if "fault_severity" in ticket_row else None

        x_vec = ticket_row[self.feature_cols].to_numpy(dtype=np.float32).reshape(1, -1)
        x_df = pd.DataFrame(x_vec, columns=self.feature_cols)

        proba = {
            "random_forest": self._tabular_proba(x_df, "random_forest"),
            "xgboost": self._tabular_proba(x_df, "xgboost"),
            "svm": self._tabular_proba(x_df, "svm"),
            "lstm": self._sequence_proba(ticket_id, self.lstm),
            "gru": self._sequence_proba(ticket_id, self.gru),
        }

        ensemble = np.zeros(3, dtype=np.float64)
        for name, p in proba.items():
            ensemble += self.ensemble_weights[name] * p
        ensemble_sum = ensemble.sum()
        if ensemble_sum > 0:
            ensemble = ensemble / ensemble_sum

        pred_sev = int(np.argmax(ensemble))
        confidence = float(ensemble[pred_sev])
        pred_label = SEVERITY_LABELS[pred_sev]
        prob_fault = float(ensemble[1] + ensemble[2])
        seq_fault = float(0.5 * (proba["lstm"][1] + proba["lstm"][2] + proba["gru"][1] + proba["gru"][2]))

        x_scaled = self.scaler.transform(x_vec)
        tensor_scaled = torch.tensor(x_scaled, dtype=torch.float32)
        with torch.no_grad():
            recon = self.autoencoder(tensor_scaled)
            mse = float(torch.mean((tensor_scaled - recon) ** 2).item())

        is_anomalous = mse > self.threshold
        anomaly_status = "Anomalous Network Activity" if is_anomalous else "Normal Network Pattern"
        anomaly_risk_score = min(1.0, mse / self.threshold) if self.threshold > 0 else 0.0

        combined_risk = 0.50 * prob_fault + 0.25 * anomaly_risk_score + 0.25 * seq_fault

        log_volume_total = float(ticket_row["log_volume_total"]) if "log_volume_total" in ticket_row else 0.0
        early_warning = bool(is_anomalous or (seq_fault >= 0.45 and log_volume_total >= 8) or (prob_fault >= 0.55))

        if combined_risk >= 0.70:
            risk_category, urgency = "CRITICAL", "P1 - CRITICAL URGENCY"
        elif combined_risk >= 0.55 or prob_fault >= 0.50:
            risk_category, urgency = "HIGH", "P2 - HIGH PRIORITY"
        elif combined_risk >= 0.35 or is_anomalous or early_warning:
            risk_category, urgency = "ELEVATED", "P3 - ATTENTION"
        else:
            risk_category, urgency = "LOW", "P4 - ROUTINE"

        active_events, active_resources, active_severities = [], [], []
        active_logs = {}
        for col in self.feature_cols:
            val = float(ticket_row[col])
            if val <= 0:
                continue
            clean_name = col.replace("_", " ")
            if col.startswith("evt_"):
                active_events.append(clean_name.replace("evt ", ""))
            elif col.startswith("res_"):
                active_resources.append(clean_name.replace("res ", ""))
            elif col.startswith("sev_"):
                active_severities.append(clean_name.replace("sev ", ""))
            elif col.startswith("log_"):
                active_logs[clean_name.replace("log ", "")] = int(val)

        attributions = []
        for i, col in enumerate(self.feature_cols):
            val = float(ticket_row[col])
            if val <= 0:
                continue
            imp = float(self.importances[i])
            attributions.append(
                {
                    "feature": col,
                    "clean_feature": col.replace("evt_", "Event: ")
                    .replace("res_", "Resource: ")
                    .replace("sev_", "Severity: ")
                    .replace("log_", "Log: "),
                    "value": val,
                    "importance": imp,
                    "attribution_score": val * imp,
                }
            )
        attributions_df = pd.DataFrame(attributions)
        if not attributions_df.empty:
            attributions_df = attributions_df.sort_values(by="attribution_score", ascending=False).head(10)

        model_predictions = {}
        for name, p in proba.items():
            sev = int(np.argmax(p))
            model_predictions[name] = {
                "predicted_severity": sev,
                "predicted_severity_label": SEVERITY_LABELS[sev],
                "confidence": float(p[sev]),
                "prob_sev_0": float(p[0]),
                "prob_sev_1": float(p[1]),
                "prob_sev_2": float(p[2]),
                "weight": self.ensemble_weights[name],
            }

        root_candidates = []
        if active_resources:
            root_candidates.append(f"Resource layer: {', '.join(active_resources[:3])}")
        if active_events:
            root_candidates.append(f"Event signature: {', '.join(active_events[:4])}")
        if active_logs:
            top_log = max(active_logs.items(), key=lambda kv: kv[1])
            root_candidates.append(f"Highest log burst: {top_log[0]} (volume={top_log[1]})")
        if active_severities:
            root_candidates.append(f"Log severity type: {', '.join(active_severities)}")

        return {
            "ticket_id": int(ticket_id),
            "location": location,
            "actual_severity": actual_severity,
            "predicted_severity": pred_sev,
            "predicted_severity_label": pred_label,
            "confidence": confidence,
            "prob_sev_0": float(ensemble[0]),
            "prob_sev_1": float(ensemble[1]),
            "prob_sev_2": float(ensemble[2]),
            "prob_fault": prob_fault,
            "seq_fault": seq_fault,
            "anomaly_mse": mse,
            "threshold": self.threshold,
            "is_anomalous": is_anomalous,
            "anomaly_status": anomaly_status,
            "anomaly_risk_score": anomaly_risk_score,
            "combined_risk": combined_risk,
            "risk_category": risk_category,
            "urgency": urgency,
            "early_warning": early_warning,
            "active_events": active_events,
            "active_resources": active_resources,
            "active_severities": active_severities,
            "active_logs": active_logs,
            "top_attributions": attributions_df.to_dict(orient="records") if not attributions_df.empty else [],
            "model_predictions": model_predictions,
            "ensemble_weights": self.ensemble_weights,
            "probable_root_causes": root_candidates,
        }

    def analyze_custom_ticket(
        self,
        target_id: int,
        entity_type: int,
        severity_type: int,
        event_burst: int,
        resource_count: int,
        log_volume: int,
    ) -> dict:
        """Run a transparent what-if prediction from operator-entered signals.

        Telstra tickets contain sparse categorical features. For a manual prediction,
        the selected entity is encoded as one event type and the requested counts are
        spread deterministically across known resource/log features. This keeps the
        input inside the model's real feature schema while clearly marking the result
        as a simulated scenario rather than a historical ticket.
        """
        event_cols = [c for c in self.feature_cols if c.startswith("evt_")]
        resource_cols = [c for c in self.feature_cols if c.startswith("res_")]
        severity_cols = [c for c in self.feature_cols if c.startswith("sev_")]
        log_cols = [c for c in self.feature_cols if c.startswith("log_")]
        if not event_cols or not resource_cols or not log_cols:
            raise RuntimeError("Model feature schema is incomplete for custom prediction.")

        x_df = pd.DataFrame(0.0, index=[0], columns=self.feature_cols)
        location_code = int(target_id) % max(1, int(self.seq_meta["n_locations"]))
        if "location_code" in x_df.columns:
            x_df.loc[0, "location_code"] = location_code
        selected_event = event_cols[(int(entity_type) - 1) % len(event_cols)]
        x_df.loc[0, selected_event] = float(event_burst)
        for offset in range(min(int(resource_count), len(resource_cols))):
            x_df.loc[0, resource_cols[(int(entity_type) - 1 + offset) % len(resource_cols)]] = 1.0
        if severity_cols:
            x_df.loc[0, severity_cols[(int(severity_type) - 1) % len(severity_cols)]] = 1.0
        log_slots = max(1, min(int(event_burst), len(log_cols)))
        base_volume, remainder = divmod(int(log_volume), log_slots)
        for offset in range(log_slots):
            x_df.loc[0, log_cols[(int(entity_type) - 1 + offset) % len(log_cols)]] = float(
                base_volume + (1 if offset < remainder else 0)
            )
        # These aggregate columns exist in the dashboard master frame but are
        # deliberately not part of the persisted model schema in current model
        # artifacts. Add them only when a future retrained schema contains them.
        for name, value in (("n_events", event_burst), ("n_resources", resource_count), ("log_volume_total", log_volume)):
            if name in x_df.columns:
                x_df.loc[0, name] = float(value)

        proba = {
            "random_forest": self._tabular_proba(x_df, "random_forest"),
            "xgboost": self._tabular_proba(x_df, "xgboost"),
            "svm": self._tabular_proba(x_df, "svm"),
        }
        seq_len = int(self.seq_meta["seq_len"])
        vocab_size = max(2, int(self.seq_meta["vocab_size"]))
        feat_ids = torch.zeros((1, seq_len), dtype=torch.long)
        volumes = torch.zeros((1, seq_len), dtype=torch.float32)
        for index in range(min(int(event_burst), seq_len)):
            feat_ids[0, index] = ((int(entity_type) - 1 + index) % (vocab_size - 1)) + 1
            volumes[0, index] = np.log1p(max(1.0, log_volume / max(1, event_burst)))
        loc = torch.tensor([location_code], dtype=torch.long)
        with torch.no_grad():
            proba["lstm"] = torch.softmax(self.lstm(feat_ids, volumes, loc), dim=1).numpy()[0]
            proba["gru"] = torch.softmax(self.gru(feat_ids, volumes, loc), dim=1).numpy()[0]

        ensemble = sum(self.ensemble_weights[name] * prediction for name, prediction in proba.items())
        ensemble = ensemble / ensemble.sum()
        pred_sev = int(np.argmax(ensemble))
        prob_fault = float(ensemble[1] + ensemble[2])
        seq_fault = float(0.5 * (proba["lstm"][1] + proba["lstm"][2] + proba["gru"][1] + proba["gru"][2]))

        x_vec = x_df.to_numpy(dtype=np.float32)
        x_scaled = self.scaler.transform(x_vec)
        with torch.no_grad():
            recon = self.autoencoder(torch.tensor(x_scaled, dtype=torch.float32))
            mse = float(torch.mean((torch.tensor(x_scaled, dtype=torch.float32) - recon) ** 2).item())
        anomaly_risk_score = min(1.0, mse / self.threshold) if self.threshold > 0 else 0.0
        combined_risk = 0.50 * prob_fault + 0.25 * anomaly_risk_score + 0.25 * seq_fault
        is_anomalous = mse > self.threshold
        if combined_risk >= 0.70:
            risk_category, urgency = "CRITICAL", "P1 - CRITICAL URGENCY"
        elif combined_risk >= 0.55 or prob_fault >= 0.50:
            risk_category, urgency = "HIGH", "P2 - HIGH PRIORITY"
        elif combined_risk >= 0.35 or is_anomalous:
            risk_category, urgency = "ELEVATED", "P3 - ATTENTION"
        else:
            risk_category, urgency = "LOW", "P4 - ROUTINE"

        attributions = []
        for index, column in enumerate(self.feature_cols):
            value = float(x_df.loc[0, column])
            if value > 0:
                attributions.append({
                    "feature": column,
                    "clean_feature": column.replace("evt_", "Entity: ").replace("res_", "Resource: ").replace("sev_", "Severity: ").replace("log_", "Log: "),
                    "value": value,
                    "importance": float(self.importances[index]),
                    "attribution_score": value * float(self.importances[index]),
                })
        attributions.sort(key=lambda item: item["attribution_score"], reverse=True)
        model_predictions = {
            name: {
                "predicted_severity": int(np.argmax(prediction)),
                "predicted_severity_label": SEVERITY_LABELS[int(np.argmax(prediction))],
                "confidence": float(np.max(prediction)),
                "prob_sev_0": float(prediction[0]),
                "prob_sev_1": float(prediction[1]),
                "prob_sev_2": float(prediction[2]),
                "weight": self.ensemble_weights[name],
            }
            for name, prediction in proba.items()
        }
        return {
            "ticket_id": int(target_id), "location": f"Simulated node {target_id}", "actual_severity": None,
            "predicted_severity": pred_sev, "predicted_severity_label": SEVERITY_LABELS[pred_sev],
            "confidence": float(ensemble[pred_sev]), "prob_sev_0": float(ensemble[0]),
            "prob_sev_1": float(ensemble[1]), "prob_sev_2": float(ensemble[2]), "prob_fault": prob_fault,
            "seq_fault": seq_fault, "anomaly_mse": mse, "threshold": self.threshold,
            "is_anomalous": is_anomalous,
            "anomaly_status": "Anomalous Network Activity" if is_anomalous else "Normal Network Pattern",
            "anomaly_risk_score": anomaly_risk_score, "combined_risk": combined_risk,
            "risk_category": risk_category, "urgency": urgency, "early_warning": bool(is_anomalous or prob_fault >= 0.55),
            "active_events": [selected_event.replace("evt_", "")],
            "active_resources": [column.replace("res_", "") for column in resource_cols[:min(resource_count, len(resource_cols))]],
            "active_severities": [severity_cols[(severity_type - 1) % len(severity_cols)].replace("sev_", "")] if severity_cols else [],
            "active_logs": {f"synthetic log burst {entity_type}": int(log_volume)},
            "top_attributions": attributions[:10], "model_predictions": model_predictions,
            "ensemble_weights": self.ensemble_weights,
            "probable_root_causes": [f"Simulated entity signature: {selected_event.replace('evt_', '')}", f"Operator-entered log volume: {log_volume}", f"Operator-entered resource count: {resource_count}"],
            "scenario_mode": True,
        }
