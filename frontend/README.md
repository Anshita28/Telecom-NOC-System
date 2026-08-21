# Telecom NOC — React Frontend

Premium React frontend for the **Telecom Network Fault Prediction & Predictive Maintenance System**. This replaces the original Streamlit UI with a modern, enterprise-grade NOC dashboard.

## Architecture

```
frontend/          ← This (Vite + React + TypeScript + Tailwind CSS)
backend/           ← FastAPI server wrapping the existing Python ML/AI logic
ai/                ← XAI risk engine + Gemini service (Python, untouched)
model/             ← Trained ML artifacts (RF classifier + PyTorch autoencoder)
sql/               ← SQLite database + schema
app/               ← Original Streamlit app (kept as reference)
```

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python 3.10+** with the ML dependencies installed
- GPU optional (PyTorch autoencoder runs on CPU)

## Quick Start

### 1. Start the Backend

```bash
# From the project root (where ai/, model/, sql/ live)
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

The backend will:
- Initialize the SQLite database
- Load the Random Forest classifier and PyTorch autoencoder into memory
- Serve all API endpoints at `http://localhost:8000`

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at **http://localhost:5173** with automatic proxy to the backend.

### 3. Open the App

Navigate to **http://localhost:5173** to see the landing page, then click "Open Dashboard" to enter the NOC console.

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` (same-origin proxy) | Backend API URL. Leave empty when using the Vite dev proxy. Set to `http://localhost:8000` for explicit backend URL. |

### Backend (root `.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | `None` | Google Gemini API key. If not set, the system uses deterministic local fallback logic. |

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite 8** — Build tool and dev server
- **Tailwind CSS 4** — Utility-first styling
- **shadcn/ui (Radix)** — Accessible component primitives
- **Recharts** — Chart library for dashboards
- **Framer Motion** — Animations and page transitions
- **Tanstack Query** — Server state management and caching
- **Sonner** — Toast notifications
- **Lucide React** — Icons
- **JetBrains Mono** — Monospace font for numeric/ticket data

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/tickets` | List all ticket IDs |
| `GET` | `/api/analytics/overview` | KPIs, metrics, metadata |
| `GET` | `/api/analytics/severity-distribution` | Severity pie chart data |
| `GET` | `/api/analytics/top-locations?limit=10` | Top locations bar chart |
| `GET` | `/api/analytics/severity-location-heatmap` | Heatmap matrix |
| `GET` | `/api/history/predictions?limit=50` | Prediction history |
| `GET` | `/api/history/audit-logs?limit=50` | AI audit logs |
| `POST` | `/api/analyze/{ticket_id}` | Run ML analysis on a ticket |
| `POST` | `/api/ai/root-cause` | AI root cause analysis |
| `POST` | `/api/ai/recommendations` | AI maintenance recommendations |
| `POST` | `/api/ai/incident-summary` | AI incident summary |
| `POST` | `/api/ai/chat` | AI copilot chat |

## Build for Production

```bash
cd frontend
npm run build    # outputs to frontend/dist/
npm run preview  # preview production build locally
```
