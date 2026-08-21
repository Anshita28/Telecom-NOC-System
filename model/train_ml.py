"""
Train Random Forest, XGBoost, and Linear SVM (calibrated) on Telstra tabular features.
Uses a shared stratified split persisted to model/split_indices.npz.
"""

from __future__ import annotations

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.utils.class_weight import compute_sample_weight

from model.metrics_utils import classification_bundle


def _get_split(y: np.ndarray, model_dir: str):
    split_path = os.path.join(model_dir, "split_indices.npz")
    if os.path.exists(split_path):
        split = np.load(split_path)
        return split["train_idx"], split["test_idx"]
    idx = np.arange(len(y))
    train_idx, test_idx = train_test_split(idx, test_size=0.20, random_state=42, stratify=y)
    np.savez(split_path, train_idx=train_idx, test_idx=test_idx)
    return train_idx, test_idx


def train_ml_models(data_dir: str = "data", model_dir: str = "model") -> dict:
    os.makedirs(model_dir, exist_ok=True)
    master_df = pd.read_csv(os.path.join(data_dir, "telecom_failure_master.csv"))
    feature_cols = joblib.load(os.path.join(model_dir, "model_columns.pkl"))

    X = master_df[feature_cols].to_numpy(dtype=np.float32)
    y = master_df["fault_severity"].to_numpy(dtype=np.int64)
    train_idx, test_idx = _get_split(y, model_dir)

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    sample_w = compute_sample_weight("balanced", y_train)

    metrics = {}

    print("\n--- Training Random Forest ---")
    rf = RandomForestClassifier(
        n_estimators=180,
        max_depth=18,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
    )
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    metrics["random_forest"] = classification_bundle(y_test, rf_pred)
    print(metrics["random_forest"]["classification_report"])
    joblib.dump(rf, os.path.join(model_dir, "rf_model.pkl"))

    print("\n--- Training XGBoost ---")
    from xgboost import XGBClassifier

    xgb = XGBClassifier(
        n_estimators=180,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.55,
        min_child_weight=3,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        tree_method="hist",
        n_jobs=-1,
        random_state=42,
    )
    xgb.fit(X_train, y_train, sample_weight=sample_w)
    xgb_pred = xgb.predict(X_test)
    metrics["xgboost"] = classification_bundle(y_test, xgb_pred)
    print(metrics["xgboost"]["classification_report"])
    joblib.dump(xgb, os.path.join(model_dir, "xgb_model.pkl"))

    print("\n--- Training RBF SVM (PCA-reduced, class-balanced) ---")
    n_comp = min(48, X_train.shape[1], X_train.shape[0] - 1)
    svm = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("pca", PCA(n_components=n_comp, random_state=42)),
            (
                "clf",
                CalibratedClassifierCV(
                    SVC(
                        kernel="rbf",
                        C=2.0,
                        gamma="scale",
                        class_weight="balanced",
                        cache_size=1000,
                        random_state=42,
                    ),
                    method="sigmoid",
                    cv=3,
                    ensemble=False,
                ),
            ),
        ]
    )
    svm.fit(X_train, y_train)
    svm_pred = svm.predict(X_test)
    metrics["svm"] = classification_bundle(y_test, svm_pred)
    print(metrics["svm"]["classification_report"])
    joblib.dump(svm, os.path.join(model_dir, "svm_model.pkl"))

    # Keep legacy filename pointing at the strongest tabular model for old loaders
    best_name = max(("random_forest", "xgboost", "svm"), key=lambda k: metrics[k]["f1_macro"])
    best_path = {
        "random_forest": "rf_model.pkl",
        "xgboost": "xgb_model.pkl",
        "svm": "svm_model.pkl",
    }[best_name]
    joblib.dump(joblib.load(os.path.join(model_dir, best_path)), os.path.join(model_dir, "failure_model.pkl"))

    with open(os.path.join(model_dir, "ml_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Best tabular model by macro-F1: {best_name} ({metrics[best_name]['f1_macro']:.4f})")
    return metrics


if __name__ == "__main__":
    from model.features import persist_features

    persist_features()
    train_ml_models()
