@echo off
cd /d "%~dp0"
pm2 start ecosystem.config.cjs
timeout /t 2
pm2 logs Febot --out 
pause