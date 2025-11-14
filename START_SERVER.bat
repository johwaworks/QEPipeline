@echo off
echo Starting QEPipeline Frontend Server...
cd /d "%~dp0frontend"
python -m http.server 8000
pause

