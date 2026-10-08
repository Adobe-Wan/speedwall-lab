@echo off
rem All the outstanding in-game rounds in one go (6, 7, 5, 4), then process, analyze and zip the results.
rem   Arena Commander free flight ONLY (never the PU, never PvP), Gladius, decoupled, SCM, open space, G-safe off,
rem   you at the keyboard. F12 stops everything.
rem   Run only some rounds:   run_campaign.bat --rounds 6 7
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Run setup.bat first.
  exit /b 1
)
.venv\Scripts\python run.py campaign %*
pause
