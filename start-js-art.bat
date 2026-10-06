@echo off
chcp 65001 >nul
title JS-Art
rem Запуск JS-Art двойным кликом: сервер + браузер на главной странице сайта.
rem Папку сайта и страницу можно поменять: start-js-art.bat --root www --open /about.html
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js 18+ с https://nodejs.org и запустите снова.
  pause
  exit /b 1
)
set "ARGS=%*"
if "%ARGS%"=="" set "ARGS=--open"
echo JS-Art запускается... Чтобы остановить, закройте это окно или нажмите Ctrl+C.
node "%~dp0server.js" %ARGS%
echo.
echo Сервер остановлен.
pause
