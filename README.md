# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


## How to build debug apk

1. Generation (npx expo prebuild)
Ensure all icons/splash images in app.json are local paths (not URLs).

Run `npx expo prebuild --clean` in the project root.

This generates the android directory and injects your package name (com.playworks.mrc).

2. Getting Fingerprint (SHA-256)
Navigate to the native folder: `cd android`.

Run the signing report: `.\gradlew signingReport`.

Locate the Variant: debug section in the output.

Copy the SHA-256 string for your `assetlinks.json`.

3. Creating APK
Ensure local.properties exists in android/ with a valid sdk.dir.

Run the assembly command: `.\gradlew assembleDebug`.

Wait for BUILD SUCCESSFUL (this may take several minutes).

Find the file at: `android\app\build\outputs\apk\debug\app-debug.apk`.

4. Installation
Return to root: `cd ...`

Install to device: `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`.

## App Links & Deep Linking Setup (Production & Environment Config)

When setting up deep linking (App Links for Android, Universal Links for iOS) in a new environment, follow these critical rules to ensure the OS automatically opens the app instead of falling back to the browser:

### 1. Server Configuration (CRITICAL: Content-Type)
Both Apple and Google **strictly require** their respective configuration files to be served with the `Content-Type: application/json` HTTP header.
- **AWS S3 / CloudFront / CDNs**: By default, these might serve files without extensions as `application/octet-stream`. You **must** manually set the object's metadata to `Content-Type: application/json` and invalidate the cache.
- Verify via terminal before debugging the app:
  ```bash
  curl -s -v https://<YOUR_DOMAIN>/.well-known/assetlinks.json
  ```

### 2. Android (`assetlinks.json`)
- **Location**: `https://<YOUR_DOMAIN>/.well-known/assetlinks.json`
- **Format Example**:
  ```json
  [
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.playworks.mrcengine",
        "sha256_cert_fingerprints": [
          "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
        ]
      }
    }
  ]
  ```
- Ensure the `sha256_cert_fingerprints` exactly matches the keystore used to sign the APK.
- For production, use the SHA256 of the production keystore. For dev, use the SHA256 of the `debug.keystore`.
- **Testing Verification on Device**:
  ```bash
  # Force re-verify without reinstalling
  adb shell pm verify-app-links --re-verify com.playworks.mrcengine

  # Check verification state (Look for state 'approved' or 'verified', 1024 means server error)
  adb shell pm get-app-links com.playworks.mrcengine
  ```

### 3. iOS (`apple-app-site-association`)
- **Location**: `https://<YOUR_DOMAIN>/.well-known/apple-app-site-association`
- **Extension**: The file must have **NO file extension** (not `.json`), but must still be served as `application/json`.
- **Paths (`/<YOUR_PATH>/*`)**: This array tells iOS exactly which URL paths should open your app instead of the Safari browser. The `*` acts as a wildcard. For example, if your link is `https://h5.play.works/dev/pavlou/mrc_engine/index.html`, your path should be `"/dev/pavlou/mrc_engine/*"`.
- **Format Example**:
  ```json
  {
    "applinks": {
      "apps": [],
      "details": [
        {
          "appID": "<TEAM_ID>.com.playworks.mrcengine",
          "paths": [ "/<YOUR_PATH>/*" ]
        }
      ]
    }
  }
  ```

### 4. App Configuration (`app.json` / Manifest)
Ensure the scheme, host, and paths in `app.json` match your deployment environment:
```json
{
  "android": {
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "data": [
          { "scheme": "https", "host": "<YOUR_DOMAIN>", "pathPrefix": "/<YOUR_PATH>/" }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```
*Note: After any changes to `app.json` intent filters, you must rebuild the app (`npx expo prebuild` and generate a new APK/IPA).*
