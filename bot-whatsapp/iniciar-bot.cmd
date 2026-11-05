@echo off
cd /d "%~dp0"
if not exist node_modules call npm install --omit=dev --no-audit --no-fund
:inicio
node --env-file=.env index.js
if %errorlevel%==42 goto inicio
rem se o bot cair por outro motivo, espera 30 segundos e liga de novo
ping -n 31 127.0.0.1 >nul
goto inicio
