@echo off
echo Starting QEPipeline Backend Server...
echo.
cd /d %~dp0backend
echo Current directory: %CD%
echo.

REM Clear Python cache
if exist __pycache__ rmdir /s /q __pycache__
for /r %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d"
del /s /q *.pyc 2>nul

echo Starting Flask server on http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
python app.py
pause
