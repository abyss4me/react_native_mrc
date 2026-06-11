@echo off
cd ..\
echo Prebuilding Android project...
call npx expo prebuild --platform android
if errorlevel 1 goto fail
echo.
echo Bundling release AAB...
cd android
call gradlew bundleRelease
if errorlevel 1 goto fail
echo.
echo BUILD SUCCESSFUL
echo AAB location: android\app\build\outputs\bundle\release\app-release.aab
echo.
echo Next steps:
echo   - Upload app-release.aab to Google Play Console, OR
echo   - Use bundletool to test locally (see installReleaseAAB.cmd)
goto end
:fail
echo.
echo BUILD FAILED - check output above.
:end
pause
