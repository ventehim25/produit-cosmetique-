@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Sauvegarde sur GitHub en cours...
git add -A
git diff --cached --quiet && (
  echo Rien de nouveau a sauvegarder.
) || (
  git commit -q -m "Sauvegarde du %date% %time:~0,5%"
  git push -q
  echo Sauvegarde terminee ! Le site sera mis a jour dans 1 minute :
  echo https://ventehim25.github.io/produit-cosmetique-/
)
pause
