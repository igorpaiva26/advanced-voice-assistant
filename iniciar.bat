@echo off

:: Sobe backend em background (sem janela)
cd /d "%~dp0backend"
start /b "" cmd /c "npm run dev >nul 2>&1"

:: Aguarda backend iniciar
timeout /t 4 /nobreak >nul

:: Sobe frontend em background (sem janela)
cd /d "%~dp0frontend"
start /b "" cmd /c "npm run dev >nul 2>&1"

:: Aguarda frontend compilar
timeout /t 5 /nobreak >nul

:: Abre o navegador
start "" "http://localhost:5173"
