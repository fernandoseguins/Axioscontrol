@echo off
title AXIOS DUON 24 - app
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor\servidor.ps1"
pause
