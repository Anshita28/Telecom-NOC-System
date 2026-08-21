"""
Shared Telstra feature engineering: merge event/resource/severity/log tables
and build padded log-feature sequences for LSTM/GRU.
"""

from __future__ import annotations

import os

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

SEQ_LEN = 24
PAD_ID = 0


def load_raw_tables(data_dir: str = "data"):
    train_df = pd.read_csv(os.path.join(data_dir, "train.csv"))
    event_df = pd.read_csv(os.path.join(data_dir, "event_type.csv"))
    resource_df = pd.read_csv(os.path.join(data_dir, "resource_type.csv"))
    severity_df = pd.read_csv(os.path.join(data_dir, "severity_type.csv"))
    log_df = pd.read_csv(os.path.join(data_dir, "log_feature.csv"))
    return train_df, event_df, resource_df, severity_df, log_df


def build_master_frame(data_dir: str = "data"):
    train_df, event_df, resource_df, severity_df, log_df = load_raw_tables(data_dir)

    event_pivot = pd.crosstab(event_df["id"], event_df["event_type"])
    event_pivot.columns = [f"evt_{str(c).strip().replace(' ', '_')}" for c in event_pivot.columns]

    resource_pivot = pd.crosstab(resource_df["id"], resource_df["resource_type"])
    resource_pivot.columns = [f"res_{str(c).strip().replace(' ', '_')}" for c in resource_pivot.columns]

    severity_pivot = pd.crosstab(severity_df["id"], severity_df["severity_type"])
    severity_pivot.columns = [f"sev_{str(c).strip().replace(' ', '_')}" for c in severity_pivot.columns]

    log_pivot = log_df.pivot_table(
        index="id", columns="log_feature", values="volume", aggfunc="sum", fill_value=0
    )
    log_pivot.columns = [f"log_{str(c).strip().replace(' ', '_')}" for c in log_pivot.columns]

    master_df = (
        train_df.merge(event_pivot, on="id", how="left")
        .merge(resource_pivot, on="id", how="left")
        .merge(severity_pivot, on="id", how="left")
        .merge(log_pivot, on="id", how="left")
    )

    feature_cols = [c for c in master_df.columns if c not in ["id", "location", "fault_severity"]]
    master_df[feature_cols] = master_df[feature_cols].fillna(0)

    le_location = LabelEncoder()
    extra = pd.DataFrame(
        {
            "location_code": le_location.fit_transform(master_df["location"].astype(str)),
            "n_events": master_df[[c for c in master_df.columns if c.startswith("evt_")]].sum(axis=1),
            "n_resources": master_df[[c for c in master_df.columns if c.startswith("res_")]].sum(axis=1),
            "log_volume_total": master_df[[c for c in master_df.columns if c.startswith("log_")]].sum(axis=1),
        },
        index=master_df.index,
    )
    master_df = pd.concat([master_df, extra], axis=1)
    all_feature_cols = ["location_code"] + feature_cols

    return master_df, all_feature_cols, le_location, log_df


def build_log_sequences(master_df: pd.DataFrame, log_df: pd.DataFrame, seq_len: int = SEQ_LEN):
    """
    Each ticket becomes a sequence of (log_feature_id, volume) steps ordered by volume desc.
    Telstra has no timestamps; log bursts are the closest sequential signal for LSTM/GRU.
    """
    unique_feats = sorted(log_df["log_feature"].astype(str).unique())
    feat_to_id = {name: i + 1 for i, name in enumerate(unique_feats)}  # 0 reserved for PAD

    grouped = {}
    for ticket_id, grp in log_df.groupby("id"):
        rows = grp.sort_values("volume", ascending=False)
        ids = [feat_to_id[str(f)] for f in rows["log_feature"].tolist()][:seq_len]
        vols = [float(v) for v in rows["volume"].tolist()][:seq_len]
        grouped[int(ticket_id)] = (ids, vols)

    n = len(master_df)
    feat_ids = np.full((n, seq_len), PAD_ID, dtype=np.int64)
    volumes = np.zeros((n, seq_len), dtype=np.float32)
    loc_codes = master_df["location_code"].to_numpy(dtype=np.int64)
    ticket_ids = master_df["id"].to_numpy(dtype=np.int64)

    for i, tid in enumerate(ticket_ids):
        pair = grouped.get(int(tid))
        if not pair:
            continue
        ids, vols = pair
        feat_ids[i, : len(ids)] = ids
        volumes[i, : len(vols)] = np.log1p(vols)

    meta = {
        "seq_len": seq_len,
        "vocab_size": len(feat_to_id),
        "pad_id": PAD_ID,
        "n_locations": int(master_df["location_code"].max()) + 1,
        "feat_to_id": feat_to_id,
    }
    return feat_ids, volumes, loc_codes, meta


def persist_features(data_dir: str = "data", model_dir: str = "model"):
    os.makedirs(model_dir, exist_ok=True)
    master_df, feature_cols, le_location, log_df = build_master_frame(data_dir)
    master_path = os.path.join(data_dir, "telecom_failure_master.csv")
    master_df.to_csv(master_path, index=False)

    feat_ids, volumes, loc_codes, seq_meta = build_log_sequences(master_df, log_df)

    joblib.dump(feature_cols, os.path.join(model_dir, "model_columns.pkl"))
    joblib.dump(le_location, os.path.join(model_dir, "label_encoder.pkl"))
    joblib.dump(seq_meta, os.path.join(model_dir, "sequence_meta.pkl"))
    np.savez_compressed(
        os.path.join(model_dir, "sequences.npz"),
        feat_ids=feat_ids,
        volumes=volumes,
        loc_codes=loc_codes,
        ticket_ids=master_df["id"].to_numpy(dtype=np.int64),
        y=master_df["fault_severity"].to_numpy(dtype=np.int64),
    )
    return master_df, feature_cols, le_location, feat_ids, volumes, loc_codes, seq_meta
