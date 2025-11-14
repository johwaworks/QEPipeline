@echo off
echo Starting QEPipeline Frontend Server...
echo.
echo Frontend will be available at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0frontend"
python -m http.server 8000
pause

