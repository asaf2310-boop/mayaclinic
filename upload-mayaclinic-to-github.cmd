@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0upload-mayaclinic-to-github.ps1"
pause
