@echo off
echo Packaging Frontend for sharing...
echo.

set "FRONTEND_DIR=%~dp0frontend"
set "OUTPUT_ZIP=%~dp0QEPipeline_Frontend.zip"

echo Frontend directory: %FRONTEND_DIR%
echo Output file: %OUTPUT_ZIP%
echo.

if exist "%OUTPUT_ZIP%" (
    echo Deleting existing zip file...
    del "%OUTPUT_ZIP%"
)

echo Creating zip file...
powershell -Command "Compress-Archive -Path '%FRONTEND_DIR%\*' -DestinationPath '%OUTPUT_ZIP%' -Force"

if exist "%OUTPUT_ZIP%" (
    echo.
    echo ========================================
    echo SUCCESS!
    echo ========================================
    echo.
    echo Frontend packaged successfully!
    echo Location: %OUTPUT_ZIP%
    echo.
    echo Share this file with others.
    echo They should:
    echo 1. Download and extract the zip file
    echo 2. Open index.html in their browser
    echo 3. Make sure API_BASE_URL is set to:
    echo    https://unscrupulous-kimbra-headstrong.ngrok-free.dev
    echo.
) else (
    echo.
    echo ERROR: Failed to create zip file
    echo.
)

pause

