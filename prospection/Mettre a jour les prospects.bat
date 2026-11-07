@echo off
rem Relance le robot OpenStreetMap : nouveaux commerces et coordonnees a jour (quelques minutes)
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" robot-osm.mjs
echo.
echo Termine. Rafraichis la page NAYRA Prospection.
pause
