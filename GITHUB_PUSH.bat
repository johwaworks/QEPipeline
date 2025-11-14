@echo off
chcp 65001 >nul
echo GitHub Push Helper
echo.

echo ========================================
echo Step 1: Check if GitHub repository is created
echo ========================================
echo.
echo Please make sure you have created a GitHub repository:
echo 1. Go to https://github.com and login
echo 2. Click + icon ^> New repository
echo 3. Repository name: QEPipeline
echo 4. DO NOT check "Initialize with README"
echo 5. Click "Create repository"
echo.
pause

echo.
echo ========================================
echo Step 2: Add remote repository
echo ========================================
echo.
echo Enter your GitHub repository URL:
echo Example: https://github.com/johwaworks/QEPipeline.git
set /p REPO_URL=

git remote add origin "%REPO_URL%"
if errorlevel 1 (
    echo.
    echo Warning: Remote repository might already be added.
    echo Checking current remotes...
    git remote -v
    echo.
    pause
)

echo.
echo ========================================
echo Step 3: Push to GitHub
echo ========================================
echo.
echo Now pushing to GitHub...
echo.
echo IMPORTANT: When prompted for password, use Personal Access Token!
echo (NOT your GitHub password)
echo.
pause

git push -u origin main

echo.
if errorlevel 1 (
    echo.
    echo ========================================
    echo Push failed. Common issues:
    echo ========================================
    echo 1. Personal Access Token not created
    echo 2. Wrong token or password
    echo 3. Repository not created on GitHub
    echo.
    echo Please check the errors above and try again.
    echo.
) else (
    echo.
    echo ========================================
    echo SUCCESS! Code pushed to GitHub!
    echo ========================================
    echo.
    echo Next step: Deploy to AWS Amplify
    echo.
)

pause

