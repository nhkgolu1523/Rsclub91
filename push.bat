@echo off
title Rsclub91 - auto push
cd /d "%~dp0"

git add -A
git diff --cached --quiet
if %errorlevel%==0 (
    echo Nothing changed - nothing to push.
    goto end
)

git commit -m "update %date% %time%"
if %errorlevel% neq 0 (
    echo Commit failed.
    goto end
)

git push -u origin main
if %errorlevel% neq 0 (
    echo Push rejected - pulling remote changes first...
    git pull --rebase origin main
    git push -u origin main
)

:end
echo.
pause
