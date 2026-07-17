@echo off
setlocal
title Dayan Disli ERP Deploy
cd /d "%userprofile%\Documents\dayandisli.com"

if not exist "package.json" (
  echo.
  echo HATA: Proje klasoru bulunamadi veya package.json yok.
  echo Beklenen klasor: %userprofile%\Documents\dayandisli.com
  pause
  exit /b 1
)

if not exist "scripts\deploy_ftp.py" (
  echo.
  echo HATA: scripts\deploy_ftp.py bulunamadi.
  pause
  exit /b 1
)

echo.
echo === TYPECHECK ===
call npm run typecheck
if errorlevel 1 goto :error

echo.
echo === TESTS ===
call npm test -- --run
if errorlevel 1 goto :error

echo.
echo === PRODUCTION BUILD ===
call npm run build
if errorlevel 1 goto :error

echo.
echo === FTP DIFF DEPLOY ===
python scripts\deploy_ftp.py --diff
if errorlevel 1 goto :error

echo.
echo === DEPLOY BASARILI ===
echo Ozet kontrolu: Errors 0 olmali.
pause
exit /b 0

:error
echo.
echo *** ISLEM BASARISIZ ***
echo Yukaridaki hata mesajlarini kontrol edin.
pause
exit /b 1
