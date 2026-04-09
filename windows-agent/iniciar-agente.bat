@echo off
title Agente Windows - AI Assistant
echo ========================================
echo   Agente Windows - AI Screen Assistant
echo ========================================
echo.
echo Instalando dependencias...
call npm install
echo.
echo Iniciando agente...
echo.
node agent.js
pause
