# Telecom Network Fault Prediction System Startup Script (PowerShell)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "📡 Starting Telecom Fault Prediction & Anomaly NOC System" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

# Check Python installation
$pythonPath = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonPath) {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

Write-Host "Installing Backend Dependencies..." -ForegroundColor Yellow
python -m pip install -r requirements.txt

Write-Host "Installing Frontend Dependencies..." -ForegroundColor Yellow
Push-Location frontend
npm install
Pop-Location

# Ensure real dataset zip files are unpacked
if (-not (Test-Path "data\train.csv")) {
    Write-Host "Unpacking real dataset zip files..." -ForegroundColor Yellow
    python data\generate_dataset.py
}

# Train all six models if the new artifacts are missing
if (-not (Test-Path "model\rf_model.pkl") -or -not (Test-Path "model\lstm_model.pt")) {
    Write-Host "Training RF, XGBoost, SVM, LSTM, GRU, Autoencoder on Telstra data..." -ForegroundColor Yellow
    python -m model.train_all
}

# Launch Backend and Frontend
Write-Host "Launching Backend (FastAPI)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "python -m backend.run"

Write-Host "Launching Frontend (React)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "cd frontend && npm run dev"
