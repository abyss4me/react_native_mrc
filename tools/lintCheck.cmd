@echo off
cd ..\
echo Running linter (expo lint)...
call npx expo lint
echo.
echo Script ended.
pause

