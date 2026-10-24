@echo off
echo ==============================================================================
echo Launching MedDRAG Full-Stack System
echo ==============================================================================
echo 1. Launching Backend on http://localhost:8000
start "MedDRAG Backend (FastAPI)" cmd /k "%~dp0run_backend.bat"

echo 2. Launching Frontend on http://localhost:3000
start "MedDRAG Frontend (Next.js)" cmd /k "%~dp0run_frontend.bat"

echo.
echo Both services launched in separate windows!
echo - Frontend: http://localhost:3000
echo - Backend API Docs: http://localhost:8000/docs
echo ==============================================================================
