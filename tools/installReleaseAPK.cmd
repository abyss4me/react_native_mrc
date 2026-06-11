@echo off
echo Installing RELEASE APK to connected device...
echo Note: device must allow installation from unknown sources if not a dev build.
call adb install -r ..\android\app\build\outputs\apk\release\app-release.apk
echo.
echo Script ended.
pause

