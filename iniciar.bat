@echo off
title AI Screen Assistant
echo ========================================
echo   AI Screen Assistant - Iniciando
echo ========================================
echo.

:: Inicia backend em background (sem janela extra)
echo [1/3] Iniciando Backend...
cd /d "%~dp0backend"
start /b cmd /c "npm run dev > nul 2>&1"

:: Aguarda backend ficar pronto
echo       Aguardando backend (porta 3001)...
:wait_backend
timeout /t 1 /nobreak >nul
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -TimeoutSec 2 -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait_backend
echo       Backend pronto!

:: Inicia frontend em background (sem janela extra)
echo [2/3] Iniciando Frontend...
cd /d "%~dp0frontend"
start /b cmd /c "npm run dev > nul 2>&1"

:: Aguarda frontend ficar pronto
echo       Aguardando frontend (porta 5173)...
:wait_frontend
timeout /t 1 /nobreak >nul
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 2 -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait_frontend
echo       Frontend pronto!

:: Abre o navegador
echo [3/3] Abrindo navegador...
start "" "http://localhost:5173"

echo.
echo ========================================
echo   Sistema rodando!
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo ========================================
echo.
echo   Pressione qualquer tecla para PARAR
echo   tudo e fechar esta janela.
echo.
pause >nul

:: Ao pressionar qualquer tecla, para tudo
echo.
echo Parando servicos...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Pronto. Ate mais!
timeout /t 2 /nobreak >nul
