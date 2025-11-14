@echo off
chcp 65001 >nul
echo Git User Configuration
echo.

echo Enter your GitHub email address:
set /p GIT_EMAIL=

echo Enter your GitHub username:
set /p GIT_NAME=

git config --global user.email "%GIT_EMAIL%"
git config --global user.name "%GIT_NAME%"

echo.
echo Git user information has been configured:
echo Email: %GIT_EMAIL%
echo Name: %GIT_NAME%
echo.

pause

