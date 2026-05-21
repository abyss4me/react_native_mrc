cd ..\
call npx expo prebuild --platform android && cd android && gradlew assembleRelease
echo Script ended.
pause