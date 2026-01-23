/**
 * src/utils/constants.ts
 * Глобальні налаштування проекту
 */

// URL вашого WebSocket сервера
// УВАГА: На реальному Android/iOS пристрої "localhost" не працює.
// Використовуйте IP адресу вашого ПК, наприклад: "ws://192.168.1.5:8080"
export const HOST_SERVER_URL = "ws://192.168.0.100:8080"; //TODO:

// Ключ для збереження ID пристрою в пам'яті телефону
export const DEVICE_ID_STORAGE_KEY = "mp_rc_device_id";

// Час очікування з'єднання (мс)
export const CONNECTION_TIMEOUT_DURATION = 3000;

// Режим розробки (вмикає додаткові логи або мок-дані)
export const DEV_MODE = true;

// Версія протоколу або додатку
export const APP_VERSION = "1.0.0";