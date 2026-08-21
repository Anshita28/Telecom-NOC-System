@echo off
echo ============================================================
echo 📡 Starting Telecom Fault Prediction ^& Anomaly NOC System
echo ============================================================

if not exist .venv\Scripts\python.exe (
    echo Error: Project virtual environment is missing. Recreate .venv first.
    exit /b 1
)

if not exist frontend\node_modules\vite\bin\vite.js (
    echo Error: Frontend dependencies are missing. Install them with a working npm installation.
    exit /b 1
)

if not exist data\train.csv (
    echo Unpacking real dataset zip files...
    .venv\Scripts\python.exe data\generate_dataset.py
)

if not exist model\rf_model.pkl (
    echo Training RF, XGBoost, SVM, LSTM, GRU, Autoencoder...
    .venv\Scripts\python.exe -m model.train_all
)

echo Launching Backend (FastAPI)...
start cmd /k ".venv\Scripts\python.exe -m backend.run"

echo Launching Frontend (React)...
start cmd /k "cd frontend && node node_modules\vite\bin\vite.js"
pause
