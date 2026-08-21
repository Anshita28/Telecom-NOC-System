@echo off
echo ============================================================
echo 📡 Starting Telecom Fault Prediction ^& Anomaly NOC System
echo ============================================================

echo Installing Backend Dependencies...
python -m pip install -r requirements.txt

echo Installing Frontend Dependencies...
cd frontend
call npm install
cd ..

if not exist data\train.csv (
    echo Unpacking real dataset zip files...
    python data\generate_dataset.py
)

if not exist model\rf_model.pkl (
    echo Training RF, XGBoost, SVM, LSTM, GRU, Autoencoder...
    python -m model.train_all
)

echo Launching Backend (FastAPI)...
start cmd /k "python -m backend.run"

echo Launching Frontend (React)...
start cmd /k "cd frontend && npm run dev"
pause
