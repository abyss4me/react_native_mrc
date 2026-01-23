/**
 * src/utils/constants.ts
 * Global project settings
 */

// Your WebSocket server URL
// WARNING: "localhost" does not work on a real Android/iOS device.
// Use your PC's IP address, for example: "ws://192.168.1.5:8080"
export const HOST_SERVER_URL = "ws://192.168.0.100:8080"; //TODO:

// Key for storing the device ID in the phone's memory
export const DEVICE_ID_STORAGE_KEY = "mp_rc_device_id";

// Connection timeout (ms)
export const CONNECTION_TIMEOUT_DURATION = 3000;

// Development mode (enables additional logs or mock data)
export const DEV_MODE = true;

// Protocol or application version
export const APP_VERSION = "1.0.0";