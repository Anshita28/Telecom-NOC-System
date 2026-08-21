"""LSTM and GRU classifiers over padded Telstra log-feature sequences."""

from __future__ import annotations

import torch
import torch.nn as nn


class TicketSequenceClassifier(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        n_locations: int,
        embed_dim: int = 24,
        hidden: int = 48,
        num_classes: int = 3,
        cell: str = "lstm",
        dropout: float = 0.25,
    ):
        super().__init__()
        self.cell = cell.lower()
        self.embed = nn.Embedding(vocab_size + 1, embed_dim, padding_idx=0)
        self.vol_proj = nn.Linear(1, embed_dim)
        rnn_cls = nn.LSTM if self.cell == "lstm" else nn.GRU
        self.rnn = rnn_cls(embed_dim, hidden, batch_first=True)
        self.loc_embed = nn.Embedding(max(n_locations, 1), 8)
        self.head = nn.Sequential(
            nn.Linear(hidden + 8, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes),
        )

    def forward(self, feat_ids: torch.Tensor, volumes: torch.Tensor, loc_code: torch.Tensor):
        x = self.embed(feat_ids) + self.vol_proj(volumes.unsqueeze(-1))
        out, h = self.rnn(x)
        if isinstance(h, tuple):
            h = h[0]
        h_last = h[-1]
        loc = self.loc_embed(loc_code.clamp(min=0))
        return self.head(torch.cat([h_last, loc], dim=1))
