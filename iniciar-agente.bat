@echo off
title Agente SM Agora
cd /d "%~dp0agente"
:loop
echo [%date% %time%] Iniciando o agente...
call npm start
echo O agente parou. Reiniciando em 15 segundos (feche esta janela para encerrar)...
timeout /t 15 /nobreak >nul
goto loop
