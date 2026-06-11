@echo off
cd ..\
echo Prebuilding Android project (clean)...
call npx expo prebuild --clean --platform android
if errorlevel 1 goto fail

echo.
echo Assembling debug APK...
cd android
call gradlew assembleDebug
if errorlevel 1 goto fail

echo.
echo BUILD SUCCESSFUL
echo APK location: android\app\build\outputs\apk\debug\app-debug.apk
goto end

:fail
echo.
echo BUILD FAILED - check output above.

:end
pause

