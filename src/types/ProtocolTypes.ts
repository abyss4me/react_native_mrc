/**
 * src/types/ProtocolTypes.ts
 * Defines the shape of data exchanged between the Game Server and the Controller.
 */

// ==========================================
// COMPONENT STATE
// ==========================================

/**
 * Represents the dynamic state of a single UI element (Button, Text, Image).
 * These properties override the initial JSON config.
 */
export interface ComponentState {
    // Visibility & Interaction
    visible?: boolean;      // Replaces hideButtons/showButtons arrays
    disabled?: boolean;     // Replaces disableButtons/enableButtons arrays
    
    // Content & Appearance
    text?: string | number; // For Text/Button components
    texture?: string;       // For Image/Button components
    src?: string;           // Alias for texture

    // Dynamic Styles (Optional)
    style?: Record<string, string | number>; 
    
    // Allow any other props
    [key: string]: unknown;
}

// ==========================================
// GAME STATE (The Data Payload)
// ==========================================

/**
 * The main data object.
 * Represents the state of the game/UI at any given moment.
 */
export interface GameState {
    // --- UI Component State Map ---
    // Direct manipulation of specific UI elements by their ID.
    // e.g. "back_btn": { "disabled": false }
    state?: Record<string, ComponentState>;
    patches?: { target?: { ids?: string[] }; props?: Record<string, unknown> }[];

    // Allow any other root-level keys
    [key: string]: unknown;
}


// ==========================================
// PROTOCOL MESSAGE TYPE CONSTANTS
// ==========================================

/**
 * All server <-> client message type identifiers in one place.
 * Use these instead of raw strings to prevent typos and ease future refactoring.
 */
export const MessageTypes = {
    // Server -> Client
    LOAD_SCREEN:            "LOAD_SCREEN",
    PATCH_STATE:            "PATCH_STATE",
    TRIGGER_HAPTICS:        "TRIGGER_HAPTICS",
    SHOW_ERROR:             "SHOW_ERROR",
    GAME_STATE:             "gameState",

    // Internal (ClientManager -> App)
    CONNECTION_STATUS:      "CONNECTION_STATUS",
    CONNECTION_TIMEOUT:     "CONNECTION_TIMEOUT",
    CLEAR_CONNECTION_ERROR: "CLEAR_CONNECTION_ERROR",

    // Client -> Server (app lifecycle)
    APP_BACKGROUND:         "appBackground",
    APP_FOREGROUND:         "appForeground",
} as const;


// ==========================================
// INCOMING MESSAGES ( Server -> Client )
// ==========================================

/**
 * Message: LOAD_SCREEN
 * Instruction to switch layout and hydrate state immediately.
 */
export interface LoadScreenMessage {
    type: typeof MessageTypes.LOAD_SCREEN;
    data: GameState & {
        /** The ID of the screen to load from config.json */
        screenId: string; 
    };
}

/**
 * Message: PATCH_STATE
 * Instruction to merge new data into the current state.
 */
export interface PatchStateMessage {
    type: typeof MessageTypes.PATCH_STATE;
    data: GameState;
}

/**
 * Message: gameState
 */
export interface GameStateMessage {
    type: typeof MessageTypes.GAME_STATE;
    data?: {
        languageCode: string;
        state: {
            controllerConfigURL: string;
            data?: GameState
        },
    };
}

/**
 * If a player takes damage, shoots a gun, or wins, the game can tell the phone to vibrate.
 */
export interface TriggerHapticsMessage {
    type: typeof MessageTypes.TRIGGER_HAPTICS;
    data?: {
        pattern?: number[];
        duration?: number;
    };
}

/**
 * A lightweight way for the server to flash a quick error at the top/bottom of the phone
 * (e.g., "Not your turn!") without writing a full PATCH_STATE layout change.
 */
export interface ShowErrorToastMessage {
    type: typeof MessageTypes.SHOW_ERROR;
    data?: {
        message: string;
    };
}


// ==========================================
// INTERNAL COMMUNICATION MESSAGES
// ==========================================

/**
 * Message: CONNECTION_STATUS, internal message to trigger the disconnect overlay on the client
 */
export interface ConnectionErrorMessage {
    type: typeof MessageTypes.CONNECTION_STATUS;
    data?: {
        isConnected?: boolean;
    };
}

/**
 * Message: CONNECTION_TIMEOUT, internal message to trigger the timeout screen after failed reconnection
 */
export interface ConnectionTimeoutErrorMessage {
    type: typeof MessageTypes.CONNECTION_TIMEOUT;
    data?: {
        message: string;
    };
}

/**
 * Message: CLEAR_CONNECTION_ERROR, internal message to clear connection errors and return to normal screen
 */
export interface ClearConnectionErrorMessage {
    type: typeof MessageTypes.CLEAR_CONNECTION_ERROR;
}


export type ServerMessage =
    | LoadScreenMessage
    | PatchStateMessage
    | ConnectionErrorMessage
    | GameStateMessage
    | TriggerHapticsMessage
    | ShowErrorToastMessage
    | ConnectionTimeoutErrorMessage
    | ClearConnectionErrorMessage;

// ==========================================
// OUTGOING MESSAGES ( Client -> Server )
// ==========================================

export interface ClientMessage {
    type: string;
    data?: unknown;
}