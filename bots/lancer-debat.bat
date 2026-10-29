@echo off
chcp 65001 >nul
cd /d "%~dp0"
node debat.js
pause
