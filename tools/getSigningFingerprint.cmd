@echo off
echo Fetching signing fingerprint (SHA-256) for deep-link / assetlinks.json setup...
echo Look for the "Variant: debug" section in the output below.
echo.
cd ..\android
call gradlew signingReport
echo.
echo Script ended.
pause

