@echo off
echo Triggering App Links re-verification for com.playworks.mrcengine...
call adb shell pm verify-app-links --re-verify com.playworks.mrcengine
echo.
echo Checking verification state (look for "approved" or "verified")...
call adb shell pm get-app-links com.playworks.mrcengine
echo.
echo Note: state 1024 = server error (check Content-Type: application/json on your domain).
echo Script ended.
pause

