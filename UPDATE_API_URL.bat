@echo off
chcp 65001 >nul
echo Update API URL in Frontend Files
echo.

echo Enter the new ngrok URL:
echo Example: https://xxxxx-xxxxx-xxxxx.ngrok-free.dev
set /p NEW_URL=

if "%NEW_URL%"=="" (
    echo.
    echo Error: URL cannot be empty
    pause
    exit /b 1
)

echo.
echo Updating API URL in all JavaScript files...
echo New URL: %NEW_URL%
echo.

cd /d "%~dp0frontend"

REM Update all .js files
for %%f in (*.js) do (
    echo Updating %%f...
    powershell -Command "(Get-Content '%%f') -replace 'https://unscrupulous-kimbra-headstrong.ngrok-free.dev', '%NEW_URL%' | Set-Content '%%f'"
)

echo.
echo ========================================
echo SUCCESS! All files updated.
echo ========================================
echo.
echo Files updated:
dir *.js /b
echo.
echo Next steps:
echo 1. git add frontend/*.js
echo 2. git commit -m "Update backend API URL"
echo 3. git push
echo.
pause

