@echo off
title HIT SaaS - Servidor Local de Pruebas (Base de Datos Local SQLite)
cd /d "%~dp0"
echo ======================================================================
echo    INICIANDO SERVIDOR LOCAL DE PRUEBAS (HIT SaaS)
echo    Base de datos: SQLite Local (hit_saas.sqlite)
echo    * Aislada de Render: No altera la base de datos de produccion *
echo ======================================================================
echo.
echo Abriendo aplicacion en el navegador (http://localhost:3000)...
timeout /t 2 >nul
start http://localhost:3000
npm start
pause
