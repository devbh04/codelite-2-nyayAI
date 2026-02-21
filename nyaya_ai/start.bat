@echo off
REM NyayaAI Startup Script for Windows
REM This script starts both the FastAPI backend and Streamlit frontend

echo ========================================
echo      NyayaAI - Starting Services
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found!
    echo Please run setup first:
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

REM Check if .env exists
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo Please copy .env.example to .env and add your GOOGLE_API_KEY
    echo.
    pause
    exit /b 1
)

echo [1/2] Starting FastAPI Backend...
echo      URL: http://localhost:8000
echo      Docs: http://localhost:8000/docs
echo.

start "NyayaAI Backend" cmd /k "venv\Scripts\activate && uvicorn api.app:app --reload --port 8000 --timeout-keep-alive 600"

REM Wait for backend to start
timeout /t 5 /nobreak >nul

echo [2/2] Starting Streamlit Frontend...
echo      URL: http://localhost:8501
echo.

start "NyayaAI Frontend" cmd /k "venv\Scripts\activate && streamlit run streamlit_app.py"

echo.
echo ========================================
echo    Services Started Successfully!
echo ========================================
echo.
echo Backend API: http://localhost:8000
echo Frontend UI: http://localhost:8501
echo.
echo Press any key to exit this window.
echo (Services will continue running in separate windows)
echo.
pause >nul
