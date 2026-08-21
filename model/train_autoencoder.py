"""
PyTorch Autoencoder Training and Threshold Selection Script
Trains dense autoencoder on normal network tickets (fault_severity = 0),
computes 95th percentile reconstruction threshold, evaluates ROC-AUC / PR-AUC, 
and exports model artifacts.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc

# Ensure parent directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from model.autoencoder import TelecomDenseAutoencoder

def train_autoencoder(data_dir="data", model_dir="model", epochs=40, batch_size=64, lr=1e-3, percentile=95.0):
    os.makedirs(model_dir, exist_ok=True)
    
    print("Loading master dataset for Autoencoder training...")
    master_path = os.path.join(data_dir, "telecom_failure_master.csv")
    cols_path = os.path.join(model_dir, "model_columns.pkl")
    
    df = pd.read_csv(master_path)
    feature_cols = joblib.load(cols_path)
    
    # Separate normal tickets (severity 0) and non-normal tickets (severity 1 or 2)
    normal_df = df[df['fault_severity'] == 0].copy()
    all_df = df.copy()

    X_normal = normal_df[feature_cols].values
    X_all = all_df[feature_cols].values
    y_all_binary = (all_df['fault_severity'] >= 1).astype(int).values

    print(f"Total dataset records: {len(all_df)}")
    print(f"Normal records (fault_severity = 0) used for AE training: {len(normal_df)}")

    # Fit StandardScaler on normal samples
    scaler = StandardScaler()
    X_normal_scaled = scaler.fit_transform(X_normal)
    X_all_scaled = scaler.transform(X_all)

    # Train / validation split on normal data (80/20)
    n_train = int(len(X_normal_scaled) * 0.8)
    X_norm_train = X_normal_scaled[:n_train]
    X_norm_val = X_normal_scaled[n_train:]

    # DataLoaders
    train_dataset = TensorDataset(torch.tensor(X_norm_train, dtype=torch.float32))
    val_dataset = TensorDataset(torch.tensor(X_norm_val, dtype=torch.float32))
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    # Initialize PyTorch Autoencoder model
    input_dim = len(feature_cols)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training Autoencoder on device: {device} (Input dimension: {input_dim})")

    # DESIGN CHOICE: Dual-Model Architecture (Unsupervised Component)
    # The Autoencoder is trained exclusively on normal (severity=0) network tickets.
    # Its purpose is to learn the latent distribution of "normal" network telemetry.
    # During inference, tickets with high reconstruction error (MSE) represent anomalies
    # (novel or unknown faults), complementing the supervised Random Forest which only
    # recognizes previously seen fault patterns.
    model = TelecomDenseAutoencoder(input_dim=input_dim, bottleneck_dim=16).to(device)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)

    # Training Loop
    model.train()
    history = []
    
    for epoch in range(1, epochs + 1):
        running_loss = 0.0
        for batch in train_loader:
            x_b = batch[0].to(device)
            optimizer.zero_grad()
            recon = model(x_b)
            loss = criterion(recon, x_b)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * len(x_b)
            
        epoch_loss = running_loss / len(X_norm_train)
        history.append(epoch_loss)
        
        if epoch % 10 == 0 or epoch == epochs:
            print(f"Epoch [{epoch}/{epochs}] - Loss: {epoch_loss:.6f}")

    # Compute validation reconstruction error on normal validation set
    model.eval()
    val_errors = []
    with torch.no_grad():
        for batch in val_loader:
            x_b = batch[0].to(device)
            recon = model(x_b)
            batch_err = torch.mean((x_b - recon) ** 2, dim=1)
            val_errors.extend(batch_err.cpu().numpy())
            
    val_errors = np.array(val_errors)
    anomaly_threshold = float(np.percentile(val_errors, percentile))
    print(f"\nComputed {percentile}th Percentile Anomaly Threshold: {anomaly_threshold:.6f}")

    # Evaluate Anomaly Detection across all samples (normal vs fault)
    model.eval()
    all_tensor = torch.tensor(X_all_scaled, dtype=torch.float32).to(device)
    with torch.no_grad():
        all_recon = model(all_tensor)
        all_errors = torch.mean((all_tensor - all_recon) ** 2, dim=1).cpu().numpy()

    roc_auc = roc_auc_score(y_all_binary, all_errors)
    precision_vals, recall_vals, _ = precision_recall_curve(y_all_binary, all_errors)
    pr_auc = auc(recall_vals, precision_vals)

    print("\n================ ANOMALY EVALUATION METRICS ================")
    print(f"ROC-AUC Score (vs Fault Severity >= 1): {roc_auc:.4f}")
    print(f"PR-AUC Score  (vs Fault Severity >= 1): {pr_auc:.4f}")
    print(f"Anomalous Rate (MSE > Threshold)     : {(all_errors > anomaly_threshold).mean() * 100:.2f}%")
    print("============================================================")

    # Save artifacts
    model_pt_path = os.path.join(model_dir, "autoencoder_model.pt")
    scaler_path = os.path.join(model_dir, "autoencoder_scaler.pkl")
    threshold_path = os.path.join(model_dir, "autoencoder_threshold.pkl")
    metadata_path = os.path.join(model_dir, "autoencoder_metadata.json")

    torch.save(model.state_dict(), model_pt_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(anomaly_threshold, threshold_path)

    metadata = {
        "input_dim": input_dim,
        "bottleneck_dim": 16,
        "anomaly_threshold": anomaly_threshold,
        "percentile_used": percentile,
        "epochs": epochs,
        "final_train_loss": float(history[-1]),
        "val_mean_mse": float(np.mean(val_errors)),
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "total_evaluated_samples": len(all_df)
    }
    
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)

    print(f"\nAutoencoder artifacts successfully saved:")
    print(f" - Model State Dict: {model_pt_path}")
    print(f" - Scaler          : {scaler_path}")
    print(f" - Threshold       : {threshold_path}")
    print(f" - Metadata JSON   : {metadata_path}")

if __name__ == "__main__":
    train_autoencoder()
