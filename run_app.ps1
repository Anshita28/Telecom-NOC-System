# Telecom Network Fault Prediction System Startup Script (PowerShell)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "📡 Starting Telecom Fault Prediction & Anomaly NOC System" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

# Use the project virtual environment so launch behavior does not depend on a
# broken or differently configured global Python installation.
$projectPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $projectPython)) {
    Write-Host "Error: Project virtual environment is missing. Recreate .venv first." -ForegroundColor Red
    exit 1
}

$frontendVite = Join-Path $PSScriptRoot "frontend\node_modules\vite\bin\vite.js"
if (-not (Test-Path $frontendVite)) {
    Write-Host "Error: Frontend dependencies are missing. Install them with a working npm installation." -ForegroundColor Red
    exit 1
}

# Ensure real dataset zip files are unpacked
if (-not (Test-Path "data\train.csv")) {
    Write-Host "Unpacking real dataset zip files..." -ForegroundColor Yellow
    & $projectPython data\generate_dataset.py
}

# Train all six models if the new artifacts are missing
if (-not (Test-Path "model\rf_model.pkl") -or -not (Test-Path "model\lstm_model.pt")) {
    Write-Host "Training RF, XGBoost, SVM, LSTM, GRU, Autoencoder on Telstra data..." -ForegroundColor Yellow
    & $projectPython -m model.train_all
}

# Launch Backend and Frontend
Write-Host "Launching Backend (FastAPI)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", ".venv\Scripts\python.exe -m backend.run"

Write-Host "Launching Frontend (React)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "cd frontend && node node_modules\vite\bin\vite.js"
