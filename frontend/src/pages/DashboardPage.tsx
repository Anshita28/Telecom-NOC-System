import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import OverviewView from "@/pages/dashboard/OverviewView";
import AnalysisView from "@/pages/dashboard/AnalysisView";
import ModelsView from "@/pages/dashboard/ModelsView";
import CustomPredictionView from "@/pages/dashboard/CustomPredictionView";

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);

  const settingsSlot = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-noc-text">
          Gemini API Key (Optional)
        </label>
        <p className="mt-1 text-xs text-noc-text-muted">
          If not provided, the system uses deterministic local fallback logic.
        </p>
        <input
          type="password"
          placeholder="Enter your Gemini API key..."
          value={apiKey ?? ""}
          onChange={(e) => setApiKey(e.target.value || null)}
          className="mt-2 w-full rounded-lg border border-noc-border bg-noc-bg px-3 py-2 text-sm text-noc-text placeholder-noc-text-dim focus:border-noc-accent focus:outline-none focus:ring-1 focus:ring-noc-accent"
        />
        {apiKey ? (
          <p className="mt-2 text-xs text-risk-low">✅ Gemini API Key Configured</p>
        ) : (
          <p className="mt-2 text-xs text-noc-text-muted">
            ℹ️ Running in Local Deterministic Fallback Mode
          </p>
        )}
      </div>

      <div className="rounded-lg border border-noc-border bg-noc-bg/50 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-noc-text-muted">
          System Information
        </h4>
        <div className="mt-2 space-y-1 text-xs text-noc-text-muted">
          <p>ML: Random Forest, XGBoost, SVM</p>
          <p>DL: Autoencoder, LSTM, GRU</p>
          <p>Severity: F1-weighted ensemble</p>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout settingsSlot={settingsSlot}>
      <Routes>
        <Route index element={<OverviewView />} />
        <Route path="analysis" element={<AnalysisView apiKey={apiKey} />} />
        <Route path="models" element={<ModelsView />} />
        <Route path="predict" element={<CustomPredictionView />} />
      </Routes>
    </DashboardLayout>
  );
}
