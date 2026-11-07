@echo off
rem Ouvre l'application NAYRA Prospection dans Chromium (serveur local : les contacts restent sur ce PC)
cd /d "%~dp0"
start "NAYRA Prospection - serveur (laisse ouvert)" /min "C:\Program Files\nodejs\node.exe" serveur.mjs
timeout /t 2 /nobreak >nul
start "" "%LOCALAPPDATA%\Chromium\Application\chrome.exe" http://localhost:8787
