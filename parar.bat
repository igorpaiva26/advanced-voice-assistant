@echo off
echo ========================================
echo   AI Screen Assistant - Parando
echo ========================================
echo.

echo [1/2] Parando Backend (porta 3001)...
:: Mata processo na porta 3001 (backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [2/2] Parando Frontend (porta 5173)...
:: Mata processo na porta 5173 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo ========================================
echo   Sistema parado com sucesso!
echo ========================================
echo.
timeout /t 2 /nobreak >nul
exit
