@echo off
rem Requires bundletool JAR in tools\bin\bundletool.jar
rem Download from: https://github.com/google/bundletool/releases
echo.
echo Building APK set from AAB...
call java -jar bin\bundletool.jar build-apks --bundle=..\android\app\build\outputs\bundle\release\app-release.aab --output=bin\app-release.apks --connected-device
if errorlevel 1 goto fail
echo.
echo Installing APK set to connected device...
call java -jar bin\bundletool.jar install-apks --apks=bin\app-release.apks
if errorlevel 1 goto fail
echo.
echo INSTALL SUCCESSFUL
goto end
:fail
echo.
echo FAILED - check output above.
echo Make sure tools\bin\bundletool.jar is present and a device is connected.
:end
pause
