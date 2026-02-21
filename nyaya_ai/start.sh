#!/bin/bash
# NyayaAI Startup Script for Linux/Mac
# This script starts both the FastAPI backend and Streamlit frontend

echo "========================================"
echo "     NyayaAI - Starting Services"
echo "========================================"
echo ""

# Check if virtual environment exists
if [ ! -f "venv/bin/activate" ]; then
    echo "[ERROR] Virtual environment not found!"
    echo "Please run setup first:"
    echo "  python -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    echo ""
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "[WARNING] .env file not found!"
    echo "Please copy .env.example to .env and add your GOOGLE_API_KEY"
    echo ""
    exit 1
fi

echo "[1/2] Starting FastAPI Backend..."
echo "     URL: http://localhost:8000"
echo "     Docs: http://localhost:8000/docs"
echo ""

# Start backend in background
source venv/bin/activate
uvicorn api.app:app --reload --port 8000 --timeout-keep-alive 600 > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 5

echo "[2/2] Starting Streamlit Frontend..."
echo "     URL: http://localhost:8501"
echo ""

# Start frontend
streamlit run streamlit_app.py &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "========================================"
echo "   Services Started Successfully!"
echo "========================================"
echo ""
echo "Backend API: http://localhost:8000"
echo "Frontend UI: http://localhost:8501"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop services:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user interrupt
wait
