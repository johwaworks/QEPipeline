@echo off
chcp 65001 >nul
echo ========================================
echo 프론트엔드 실행 중...
echo ========================================
echo.

REM 현재 배치 파일이 있는 디렉토리로 이동
cd /d "%~dp0"

echo 현재 디렉토리: %CD%
echo.

REM Python http.server 확인 (Python 3)
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Python이 설치되어 있습니다. Python HTTP 서버를 사용합니다.
    echo.
    echo 브라우저에서 http://localhost:8000 을 열어주세요.
    echo.
    echo 서버를 종료하려면 Ctrl+C를 누르세요.
    echo.
    python -m http.server 8000
    goto :end
)

REM Python 3가 없으면 Python 2 시도
python3 --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Python 3이 설치되어 있습니다. Python HTTP 서버를 사용합니다.
    echo.
    echo 브라우저에서 http://localhost:8000 을 열어주세요.
    echo.
    echo 서버를 종료하려면 Ctrl+C를 누르세요.
    echo.
    python3 -m http.server 8000
    goto :end
)

REM Node.js와 npx 확인
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Node.js가 설치되어 있습니다.
    echo.
    
    REM serve 패키지 확인 및 설치
    where serve >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo serve를 사용하여 서버를 시작합니다.
        echo.
        echo 브라우저에서 http://localhost:3000 을 열어주세요.
        echo.
        echo 서버를 종료하려면 Ctrl+C를 누르세요.
        echo.
        serve -s . -l 3000
        goto :end
    ) else (
        REM npx를 사용하여 serve 실행
        echo npx를 사용하여 serve를 실행합니다.
        echo.
        echo 브라우저에서 http://localhost:3000 을 열어주세요.
        echo.
        echo 서버를 종료하려면 Ctrl+C를 누르세요.
        echo.
        npx -y serve -s . -l 3000
        goto :end
    )
)

REM 둘 다 없으면 오류 메시지
echo [오류] Python 또는 Node.js가 설치되어 있지 않습니다.
echo.
echo 해결 방법:
echo 1. Python 설치: https://www.python.org/downloads/
echo 2. 또는 Node.js 설치: https://nodejs.org/
echo.
pause
exit /b 1

:end
pause

