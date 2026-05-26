/**
 * src/constants.ts
 * Global project settings
 */

// Your WebSocket server URL
// WARNING: "localhost" does not work on a real Android/iOS device.

export const HOST_SERVER_URL = "https://multiplayer.play.works";

export const PWMP_CLIENT_URL = "https://service.play.works/service/sdk/libs/pwmp_client.min.js";

export const TRANSPORT = ["websocket", "polling"];

// Key for storing the device ID in the phone's memory
export const DEVICE_ID_STORAGE_KEY = "mp_rc_device_id";

// Connection timeout (ms)
export const CONNECTION_TIMEOUT_DURATION = 60000;

// Development mode (enables additional logs or mock data)
export const DEV_MODE = true;

// Current engine version — must match or exceed layout's minClientVersion
export const ENGINE_VERSION = "1.0.0";

// Screen IDs
export const SCREEN = {
    HOME:       'HOME_SCREEN',
    TRANSITION: 'TRANSITION_SCREEN',
    DEV:        'CONTROL_SCREEN', // Default screen for web/debug
} as const;

// Safety timeout: auto-unlock if SET_SCREEN never arrives (e.g. network drop, server bug).
// Prevents the controller from being permanently frozen.
export const LOCK_SAFETY_TIMEOUT_MS = 5000;

// Base design dimensions for scaling the UI. All positions and sizes in layouts are based on these dimensions.
//Why 844 and 390? Because they are the dimensions of the iPhone 14 Pro, which is the smallest screen we support. This way we ensure that the UI will fit on all supported devices without scaling up (which can cause blurriness). On larger screens, the UI will be scaled up proportionally, maintaining the aspect ratio and ensuring a consistent look across devices.
//What if the scree has less than iPhone 14 Pro dimensions? In that case, the UI will be scaled down proportionally, which may cause some elements to be smaller than ideal, but it will still be functional and fit within the screen. We chose to optimize for the smallest supported device to ensure that all users have a good experience, even if it means that on larger screens the UI is not as large as it could be.
// Note: If you change these, make sure to update the corresponding values in the layout JSON files and adjust the scaling logic in the code if necessary.
//Values in config are not the actual pixel values, but rather the "design units" that are used in the layout files. The engine will handle scaling these design units to fit the actual screen size of the device, based on these base design dimensions. This allows us to create layouts that are resolution-independent and look good on a variety of screen sizes and densities.
//Wgy not pixels? Using design units instead of pixels allows us to create a more flexible and scalable UI. If we used fixed pixel values, the UI might look good on one device but could be too small or too large on another device with a different screen size or resolution. By using design units and scaling them based on the base design dimensions, we can ensure that the UI maintains its proportions and looks consistent across all supported devices, regardless of their actual pixel density or screen size.
export const BASE_DESIGN_WIDTH = 844;
export const BASE_DESIGN_HEIGHT = 390;

