@echo off

:: Mata processo na porta 3001 (backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Mata processo na porta 5173 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

exit
