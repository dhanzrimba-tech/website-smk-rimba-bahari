@echo off
setlocal
cd /d "%~dp0"
start "SMK Rimba Bahari - Local Server" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-local.ps1"
endlocal
