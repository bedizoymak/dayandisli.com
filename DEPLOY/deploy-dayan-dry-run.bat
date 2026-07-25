@echo off
setlocal
title Dayan Disli Combined Deploy Dry Run
cd /d "%~dp0.."

if not exist "package.json" (
  echo.
  echo HATA: Proje klasoru bulunamadi veya package.json yok.
  echo Beklenen klasor: bu script'in bir ust dizini.
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
echo === DEPENDENCIES ===
call npm install
if errorlevel 1 goto :error

echo.
echo === PRODUCTION BUILD ===
call npm run build
if errorlevel 1 goto :error

echo.
echo === VERIFY COMBINED BUILD OUTPUT ===
if not exist "dist\index.html" (
  echo HATA: dist\index.html bulunamadi.
  goto :error
)
if not exist "dist\erp\index.html" (
  echo HATA: dist\erp\index.html bulunamadi.
  goto :error
)
echo dist\index.html ve dist\erp\index.html mevcut.

echo.
echo === FULL DEPLOY DRY RUN (hicbir uzak dosya degistirilmez) ===
python scripts\deploy_ftp.py --full --dry-run
if errorlevel 1 goto :error

echo.
echo === DRY RUN BASARILI ===
echo Hicbir uzak dosya degistirilmedi. Ozet kontrolu: Errors 0 olmali.
pause
exit /b 0

:error
echo.
echo *** DRY RUN BASARISIZ ***
echo Yukaridaki hata mesajlarini kontrol edin.
pause
exit /b 1
