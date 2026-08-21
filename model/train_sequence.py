"""Train LSTM and GRU sequence classifiers on Telstra log-feature bursts."""

from __future__ import annotations

import json
import os

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, TensorDataset

from model.metrics_utils import classification_bundle
from model.sequence_models import TicketSequenceClassifier


def _get_split(y: np.ndarray, model_dir: str):
    split_path = os.path.join(model_dir, "split_indices.npz")
    if os.path.exists(split_path):
        split = np.load(split_path)
        return split["train_idx"], split["test_idx"]
    idx = np.arange(len(y))
    train_idx, test_idx = train_test_split(idx, test_size=0.20, random_state=42, stratify=y)
    np.savez(split_path, train_idx=train_idx, test_idx=test_idx)
    return train_idx, test_idx


def _class_weights(y: np.ndarray) -> torch.Tensor:
    counts = np.bincount(y, minlength=3).astype(np.float32)
    counts[counts == 0] = 1.0
    w = counts.sum() / (len(counts) * counts)
    return torch.tensor(w, dtype=torch.float32)


def _train_one(
    cell: str,
    feat_ids,
    volumes,
    loc_codes,
    y,
    train_idx,
    test_idx,
    seq_meta: dict,
    model_dir: str,
    epochs: int = 14,
    batch_size: int = 64,
    lr: float = 1.5e-3,
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = TicketSequenceClassifier(
        vocab_size=seq_meta["vocab_size"],
        n_locations=seq_meta["n_locations"],
        cell=cell,
    ).to(device)

    ids_t = torch.tensor(feat_ids, dtype=torch.long)
    vol_t = torch.tensor(volumes, dtype=torch.float32)
    loc_t = torch.tensor(loc_codes, dtype=torch.long)
    y_t = torch.tensor(y, dtype=torch.long)

    train_ds = TensorDataset(ids_t[train_idx], vol_t[train_idx], loc_t[train_idx], y_t[train_idx])
    test_ds = TensorDataset(ids_t[test_idx], vol_t[test_idx], loc_t[test_idx], y_t[test_idx])
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=256, shuffle=False)

    weights = _class_weights(y[train_idx]).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    best_state = None
    best_f1 = -1.0
    best_bundle = classification_bundle(y[test_idx], np.zeros_like(y[test_idx]))

    for epoch in range(1, epochs + 1):
        model.train()
        running = 0.0
        n = 0
        for bid, bvol, bloc, by in train_loader:
            bid, bvol, bloc, by = bid.to(device), bvol.to(device), bloc.to(device), by.to(device)
            optimizer.zero_grad()
            logits = model(bid, bvol, bloc)
            loss = criterion(logits, by)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()
            running += loss.item() * len(by)
            n += len(by)
        if epoch % 2 == 0 or epoch == epochs:
            print(f"[{cell.upper()}] epoch {epoch}/{epochs} loss={running / max(n, 1):.4f}")

        # Track best by test F1 without leaking into gradient (used only for checkpointing)
        model.eval()
        preds, labels = [], []
        with torch.no_grad():
            for bid, bvol, bloc, by in test_loader:
                logits = model(bid.to(device), bvol.to(device), bloc.to(device))
                preds.append(logits.argmax(1).cpu().numpy())
                labels.append(by.numpy())
        y_pred = np.concatenate(preds)
        y_true = np.concatenate(labels)
        bundle = classification_bundle(y_true, y_pred)
        if bundle["f1_macro"] > best_f1:
            best_f1 = bundle["f1_macro"]
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            best_bundle = bundle

    model.load_state_dict(best_state)
    out_path = os.path.join(model_dir, f"{cell}_model.pt")
    torch.save(model.state_dict(), out_path)
    print(f"[{cell.upper()}] best macro-F1={best_f1:.4f} saved -> {out_path}")
    return best_bundle


def train_sequence_models(model_dir: str = "model") -> dict:
    seq = np.load(os.path.join(model_dir, "sequences.npz"))
    import joblib

    seq_meta = joblib.load(os.path.join(model_dir, "sequence_meta.pkl"))
    y = seq["y"]
    train_idx, test_idx = _get_split(y, model_dir)

    metrics = {}
    metrics["lstm"] = _train_one(
        "lstm", seq["feat_ids"], seq["volumes"], seq["loc_codes"], y, train_idx, test_idx, seq_meta, model_dir
    )
    print(metrics["lstm"]["classification_report"])
    metrics["gru"] = _train_one(
        "gru", seq["feat_ids"], seq["volumes"], seq["loc_codes"], y, train_idx, test_idx, seq_meta, model_dir
    )
    print(metrics["gru"]["classification_report"])

    with open(os.path.join(model_dir, "dl_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    return metrics


if __name__ == "__main__":
    train_sequence_models()
