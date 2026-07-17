@echo off
setlocal
title Dayan Disli ERP Deploy Dry Run
cd /d "%userprofile%\Documents\dayandisli.com"

call npm run build
if errorlevel 1 goto :error

python scripts\deploy_ftp.py --diff --dry-run
if errorlevel 1 goto :error

pause
exit /b 0

:error
echo.
echo *** DRY RUN BASARISIZ ***
pause
exit /b 1
