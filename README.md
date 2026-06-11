# Welcome to your Expo app

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

> 📋 **Build history & release notes** → [`RELEASES.md`](./RELEASES.md)

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

## How to run on iPhone device

> **Prerequisites**: An Apple ID, [Expo Go](https://apps.apple.com/app/expo-go/id982107779) installed on the iPhone, and both the iPhone and your machine on the same Wi-Fi network.

### Option A — Expo Go (fastest, no build required)

1. Install **Expo Go** from the App Store on your iPhone.
2. Start the development server:
   ```bash
   npx expo start
   ```
3. In the Expo CLI output, press **`i`** to print the QR code in the terminal, or it will appear in the browser. Open the **Camera** app on your iPhone and scan it. The app opens directly in Expo Go.

   > If the device is on a different network segment, press **`e`** in the Expo CLI to send the link by email, or enter the `exp://` URL manually inside Expo Go.

### Option B — Development build on device (requires macOS + Xcode)

1. On a Mac, install **Xcode** from the Mac App Store and accept the license:
   ```bash
   sudo xcode-select --install
   ```
2. Connect your iPhone via USB and **trust this computer** on the device.
3. Generate the native `ios/` project (run once, or after native dependency changes):
   ```bash
   npx expo prebuild --clean
   ```
4. Run the app on the connected device:
   ```bash
   npx expo run:ios --device
   ```
   Alternatively, open `ios/MRCEngine.xcworkspace` in Xcode, select your iPhone as the run target, and press **▶ Run**.

### Option C — EAS Build development client (cloud build, works from any OS including Windows)

1. Install the EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log in with your Expo account:
   ```bash
   eas login
   ```
3. Initialise EAS configuration if not present:
   ```bash
   eas build:configure
   ```
4. Build a development client for iOS:
   ```bash
   eas build --profile development --platform ios
   ```
5. After the build completes, download the `.ipa` from the [Expo dashboard](https://expo.dev) and install it on your device via **TestFlight** or a direct install tool such as **Apple Configurator 2**.

---

## How to build release IPA

> An **Apple Developer Program** membership ($99/year) is required to distribute or archive a release IPA.

### Option A — Xcode Archive (requires macOS)

1. Generate the native `ios/` project:
   ```bash
   npx expo prebuild --clean
   ```
2. Open the workspace in Xcode:
   ```bash
   open ios/MRCEngine.xcworkspace
   ```
3. In Xcode, select **Any iOS Device (arm64)** as the run destination.
4. Set the **Active Scheme** to `Release` via **Product → Scheme → Edit Scheme → Run → Build Configuration: Release**.
5. Archive the app:
   **Product → Archive**
6. When the Organizer opens, click **Distribute App** and follow the wizard to export to **App Store Connect** or as an **Ad Hoc** IPA.

### Option B — EAS Build production (cloud build, works from Windows)

1. Install EAS CLI and log in (skip if already done):
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Build the production IPA in the cloud:
   ```bash
   eas build --profile production --platform ios
   ```
3. Download the signed `.ipa` from the [Expo dashboard](https://expo.dev) once the build succeeds.
4. Submit directly to **TestFlight / App Store Connect**:
   ```bash
   eas submit --platform ios
   ```

   > For ad-hoc or enterprise distribution, configure a matching provisioning profile in your `eas.json` under the `production` profile before building.

---

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

---

## Server → Controller Protocol Reference

All messages sent from the **game server** to the **mobile controller** follow this envelope:

```json
{ "type": "<MESSAGE_TYPE>", "data": { ... } }
```

### `LOAD_SCREEN`
Switches the controller to a different screen and hydrates its state atomically.
The input guard (screen lock) is **automatically released** when the new screen renders —
even if `screenId` is the same as the current screen.

```json
{
  "type": "LOAD_SCREEN",
  "data": {
    "screenId": "CONTROL_SCREEN",
    "state": {
      "player_name": { "text": "John" },
      "health_bar":  { "value": 0.8 }
    }
  }
}
```

| Field | Type | Description |
|---|---|---|
| `screenId` | `string` | ID of the screen defined in `config.json` |
| `state` | `object` | Optional. Component states to merge on load |

---

### `PATCH_STATE`
Merges partial state into the current screen without switching screens.
Does **not** release the input guard.

```json
{
  "type": "PATCH_STATE",
  "data": {
    "state": {
      "money_label": { "text": "3000" },
      "ok_btn":      { "disabled": true }
    }
  }
}
```

| Field | Type | Description |
|---|---|---|
| `state` | `object` | Map of component IDs → state overrides |
| `patches` | `array` | Optional. Patch protocol for bulk updates by target group |

---

### `UNLOCK_SCREEN`
Releases the input guard (screen lock) **without switching screens**.

Use this when the game handles a controller action (e.g. opens a popup, confirms a move)
but the controller layout stays the same — no `LOAD_SCREEN` will follow.

```json
{ "type": "UNLOCK_SCREEN" }
```

> **No `data` field needed.**

**Input guard unlock paths — summary:**

| Situation | What game sends | How it unlocks |
|---|---|---|
| Controller switches screen | `LOAD_SCREEN` | `ScreenRenderer` effect on render |
| Same screen reloaded | `LOAD_SCREEN` (same `screenId`) | `ScreenRenderer` effect on `loadScreenSignal` |
| No screen change (popup, etc.) | `UNLOCK_SCREEN` | `NetworkProvider` calls `unlockInput()` directly |
| Server never responds | — | Safety timeout (`lockSafetyTimeout` in config, default `3000ms`) |

**Typical popup flow:**
```json
{ "type": "PATCH_STATE",   "data": { "state": { "ok_btn": { "disabled": true } } } }
{ "type": "UNLOCK_SCREEN" }
```

**Why two messages instead of one?**
`PATCH_STATE` arrives constantly (timers, score updates, health changes) — not only in response
to a locked button press. Auto-unlocking on every `PATCH_STATE` would release the lock
prematurely on any background update. `UNLOCK_SCREEN` is an **explicit, intentional** signal
from the game that the locked action was acknowledged.

---

### `TRIGGER_HAPTICS`
Triggers a haptic vibration pattern on the device.

```json
{
  "type": "TRIGGER_HAPTICS",
  "data": {
    "duration": 100,
    "pattern": [0, 100, 50, 100]
  }
}
```

---

### `SHOW_ERROR`
Displays a transient error toast on the controller.

```json
{
  "type": "SHOW_ERROR",
  "data": { "message": "Not your turn!" }
}
```

---

### Client → Server messages

| Type | Sent when |
|---|---|
| `appBackground` | App moves to background |
| `appForeground` | App returns to foreground |
| Custom action type | Button / joystick / touchpad interaction |

## Build Description
