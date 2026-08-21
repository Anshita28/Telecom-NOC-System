"""Orchestrate feature engineering + ML + sequence DL + autoencoder training."""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.chdir(ROOT)

from model.features import persist_features
from model.train_autoencoder import train_autoencoder
from model.train_ml import train_ml_models
from model.train_sequence import train_sequence_models


def main():
    print("=== 1/4 Feature engineering (Telstra tables + log sequences) ===")
    persist_features(data_dir="data", model_dir="model")

    print("=== 2/4 Tabular ML: Random Forest, XGBoost, SVM ===")
    ml_metrics = train_ml_models(data_dir="data", model_dir="model")

    print("=== 3/4 Sequence DL: LSTM and GRU ===")
    dl_metrics = train_sequence_models(model_dir="model")

    print("=== 4/4 Autoencoder anomaly detector (normal tickets only) ===")
    train_autoencoder(data_dir="data", model_dir="model", epochs=28)

    ae_path = os.path.join("model", "autoencoder_metadata.json")
    with open(ae_path, "r") as f:
        ae_meta = json.load(f)

    combined = {
        "random_forest": {k: v for k, v in ml_metrics["random_forest"].items() if k != "classification_report"},
        "xgboost": {k: v for k, v in ml_metrics["xgboost"].items() if k != "classification_report"},
        "svm": {k: v for k, v in ml_metrics["svm"].items() if k != "classification_report"},
        "lstm": {k: v for k, v in dl_metrics["lstm"].items() if k != "classification_report"},
        "gru": {k: v for k, v in dl_metrics["gru"].items() if k != "classification_report"},
        "autoencoder": {
            "roc_auc": ae_meta.get("roc_auc"),
            "pr_auc": ae_meta.get("pr_auc"),
            "anomaly_threshold": ae_meta.get("anomaly_threshold"),
            "task": "unsupervised_anomaly_early_warning",
        },
    }

    classifiers = ["random_forest", "xgboost", "svm", "lstm", "gru"]
    best = max(classifiers, key=lambda k: combined[k]["f1_macro"])
    combined["primary_classifier"] = best
    combined["ensemble_note"] = (
        "Ticket severity uses a F1-weighted soft ensemble of RF, XGBoost, SVM, LSTM, and GRU. "
        "The autoencoder is unsupervised early-warning (reconstruction MSE on severity-0 tickets)."
    )

    # Legacy dashboard fields: report the best classifier
    legacy = {
        "accuracy": combined[best]["accuracy"],
        "precision_macro": combined[best]["precision_macro"],
        "recall_macro": combined[best]["recall_macro"],
        "f1_macro": combined[best]["f1_macro"],
        "primary_classifier": best,
        "models": combined,
    }
    with open(os.path.join("model", "classifier_metrics.json"), "w") as f:
        json.dump(legacy, f, indent=2)
    with open(os.path.join("model", "all_model_metrics.json"), "w") as f:
        json.dump(combined, f, indent=2)

    print("\n================ MODEL COMPARISON (held-out 20%) ================")
    for name in classifiers:
        m = combined[name]
        print(
            f"{name:15s}  acc={m['accuracy']*100:5.2f}%  f1_macro={m['f1_macro']*100:5.2f}%  "
            f"prec={m['precision_macro']*100:5.2f}%  rec={m['recall_macro']*100:5.2f}%"
        )
    print(
        f"{'autoencoder':15s}  ROC-AUC={combined['autoencoder']['roc_auc']:.4f}  "
        f"PR-AUC={combined['autoencoder']['pr_auc']:.4f}"
    )
    print(f"Primary classifier (best macro-F1): {best}")
    print("==============================================================")


if __name__ == "__main__":
    main()
