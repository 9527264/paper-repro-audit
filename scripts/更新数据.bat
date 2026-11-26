@echo off
setlocal
set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" "%~dp0csv2js.py"
echo.
if errorlevel 1 (
  echo [FAIL] data error. Fix data\papers.csv, then run this again.
) else (
  echo [OK] data\papers.js updated. Upload data\papers.csv and data\papers.js to GitHub.
)
pause