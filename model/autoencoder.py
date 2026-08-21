"""
PyTorch Dense Autoencoder for Telecom Network Anomaly Detection
Architectural Definition of the Encoder-Decoder Neural Network
"""

import torch
import torch.nn as nn

class TelecomDenseAutoencoder(nn.Module):
    """
    Dense Autoencoder designed for network event anomaly detection.
    Compresses high-dimensional ticket feature vectors into a low-dimensional bottleneck
    representation and attempts to reconstruct the original input.
    """
    def __init__(self, input_dim: int, bottleneck_dim: int = 16):
        super(TelecomDenseAutoencoder, self).__init__()
        
        hidden_1 = max(64, input_dim // 2)
        hidden_2 = max(32, input_dim // 4)
        
        # Encoder network
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_1),
            nn.BatchNorm1d(hidden_1),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_1, hidden_2),
            nn.BatchNorm1d(hidden_2),
            nn.ReLU(),
            nn.Linear(hidden_2, bottleneck_dim),
            nn.ReLU()
        )
        
        # Decoder network
        self.decoder = nn.Sequential(
            nn.Linear(bottleneck_dim, hidden_2),
            nn.BatchNorm1d(hidden_2),
            nn.ReLU(),
            nn.Linear(hidden_2, hidden_1),
            nn.BatchNorm1d(hidden_1),
            nn.ReLU(),
            nn.Linear(hidden_1, input_dim)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        latent = self.encoder(x)
        reconstruction = self.decoder(latent)
        return reconstruction

    def compute_reconstruction_error(self, x: torch.Tensor) -> torch.Tensor:
        """
        Computes sample-wise Mean Squared Error (MSE) reconstruction loss.
        """
        self.eval()
        with torch.no_grad():
            reconstruction = self.forward(x)
            mse = torch.mean((x - reconstruction) ** 2, dim=1)
        return mse
