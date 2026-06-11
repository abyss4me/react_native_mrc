# Build History

All notable changes to this project are documented here.

Format: `[vX.Y.Z] - YYYY-MM-DD: <Short Summary>` followed by categorised bullet points.
Versioning follows [Semantic Versioning](https://semver.org): **MAJOR** (breaking) · **MINOR** (feat) · **PATCH** (fix).

---

## [v1.0.0] - 2026-06-10: Initial release

### Added
- Core engine: `ScreenRenderer`, `LayoutContext`, `ComponentStateResolver`, `LayoutUtils`
- Network layer: `ClientManager`, `NetworkContext`, WebSocket protocol (LOAD_SCREEN, PATCH_STATE, UNLOCK_SCREEN, TRIGGER_HAPTICS, SHOW_ERROR)
- Input system: `InputGuard`, `InputGuardContext`, `throttledSend`, cooldown per component
- Components: `Button`, `Joystick`, `Touchpad`, `Dpad`, `ProgressBar`, `Image`, `Text`, `Container`, `Keyboard`, `Template`
- Overlays: `DisconnectOverlay`, `RotateDeviceOverlay`, `LoadingIndicator`
- Hooks: `useAppLifecycle`, `useUIScale`
- Services: `FeedbackService` (haptics), `AssetsLoader`, `FontLoader`, `ClientLibLoader`
- Screen flow: `HomeScreen`, `TransitionScreen`
- Orientation handling: `resolveOrientationState`, `AndroidBackHandler`
- Deep linking: App Links (Android) + Universal Links (iOS) via `apple-app-site-association` & `assetlinks.json`
- Full unit test suite (`jest`) for core engine utilities
- Debug APK build pipeline via Gradle; iOS run instructions via Expo Go / Xcode / EAS

