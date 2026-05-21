/**
 * src/utils/constants.ts
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
    DEV:        'JOIN_PLAYER_SCREEN', // Default screen for web/debug
} as const;

export const BASE_DESIGN_WIDTH = 844;
export const BASE_DESIGN_HEIGHT = 390;
