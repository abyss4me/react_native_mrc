@echo off
cd ..\
echo Running full test suite (no coverage)...
call npx jest --no-coverage
echo.
echo Script ended.
pause

