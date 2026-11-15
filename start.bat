@echo off
chcp 65001 >nul
tasklist /FI "IMAGENAME eq redis-server.exe" 2>nul | find /I "redis-server.exe" >nul
if errorlevel 1 (
  if exist "D:\Redis\redis-server.exe" (
    echo [fitplan] starting redis on 6379 ...
    start "fitplan-redis" "D:\Redis\redis-server.exe" "D:\Redis\redis.windows.conf"
  ) else (
    echo [fitplan] redis not found at D:\Redis; login limits will use in-memory fallback.
  )
)
cd /d "%~dp0backend"
echo [fitplan] starting backend on http://localhost:8787 ...
call mvn -s settings.xml spring-boot:run
if errorlevel 1 (
  echo [fitplan] backend exited with an error.
  pause
)
