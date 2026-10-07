@echo off
setlocal
cd /d "%~dp0"
echo === sc-flighttest setup ===

rem Prefer a Python the OCR package supports: 3.12, then 3.11, then 3.13.
set "PY="
for %%V in (3.12 3.11 3.13) do (
  if not defined PY (
    py -%%V -c "import sys" >nul 2>nul && set "PY=py -%%V"
  )
)
if not defined PY (
  echo.
  echo No compatible Python found. This tool needs Python 3.11, 3.12 or 3.13.
  echo Install Python 3.12 from https://www.python.org/downloads/ - you can keep 3.14 installed too.
  echo Then double-click setup.bat again.
  pause
  exit /b 1
)
echo Using %PY%:
%PY% --version

if exist .venv (
  echo Removing the previous environment...
  rmdir /s /q .venv
)
%PY% -m venv .venv
if not exist .venv\Scripts\python.exe (
  echo Could not create the Python environment.
  pause
  exit /b 1
)
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo Package install failed - see the messages above.
  pause
  exit /b 1
)
.venv\Scripts\python -c "import cv2, mss, numpy, yaml, win32gui, pyvjoy, rapidocr_onnxruntime; print('All packages import OK')"
echo.
echo Setup complete. Next: README.md, section "Bind vJoy in Star Citizen".
echo Run commands like:  .venv\Scripts\python run.py list
pause
