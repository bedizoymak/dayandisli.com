@echo off
setlocal EnableExtensions
title Dayan Disli Combined Deploy
cd /d "%~dp0.."

call :load_env ".env.local"
call :load_env ".env.deploy.local"
if not defined DAYAN_FTP_REMOTE_ROOT set "DAYAN_FTP_REMOTE_ROOT=/"

if not defined DAYAN_FTP_HOST goto :missing_env
if not defined DAYAN_FTP_USER goto :missing_env
if not defined DAYAN_FTP_PASS goto :missing_env
goto :env_ok

:missing_env
echo.
echo HATA: FTP bilgileri bulunamadi.
echo .env.deploy.example dosyasini .env.deploy.local olarak kopyalayip doldurun.
echo Gerekli alanlar: DAYAN_FTP_HOST, DAYAN_FTP_USER, DAYAN_FTP_PASS
echo Dogru uzak kok: DAYAN_FTP_REMOTE_ROOT=/
pause
exit /b 1

:env_ok
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
echo === FTP FULL DEPLOY: dist/ -^> %DAYAN_FTP_REMOTE_ROOT% ===
python scripts\deploy_ftp.py --full
if errorlevel 1 goto :error

echo.
echo === DEPLOY BASARILI ===
echo dist/ -^> %DAYAN_FTP_REMOTE_ROOT% tamamlandi. ERP hedefi: /erp/index.html
pause
exit /b 0

:error
echo.
echo *** ISLEM BASARISIZ ***
echo Yukaridaki hata mesajlarini kontrol edin.
pause
exit /b 1

:load_env
if exist "%~1" (
  echo Deploy environment loaded: %~1
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%~1") do (
    if not "%%A"=="" if not "%%B"=="" set "%%A=%%B"
  )
)
exit /b 0
