@echo off
echo Installing debug APK to connected device...
call adb install -r ..\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Script ended.
pause

