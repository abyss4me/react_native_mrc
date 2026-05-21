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
    content?: string | number; // For Text components
    texture?: string;          // For Image/Button components
    src?: string;              // Alias for texture
    
    // Dynamic Styles (Optional)
    style?: Record<string, string | number>; 
    
    // Allow any other props
    [key: string]: any; 
}

// ==========================================
// GAME STATE (The Data Payload)
// ==========================================

/**
 * The main Data Payload.
 * Represents the state of the game/UI at any given moment.
 */
export interface GameState {
    // --- PART A: Component Map (UI State) ---
    // Direct manipulation of specific UI elements by their ID.
    // Logic: "back_btn": { "disabled": false }
    components?: Record<string, ComponentState>;

    // Allow any other root-level keys
    [key: string]: any; 
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
    SET_SCREEN:             "SET_SCREEN",
    UPDATE_COMPONENTS:      "UPDATE_COMPONENTS",
    TRIGGER_HAPTICS:        "TRIGGER_HAPTICS",
    SHOW_ERROR:             "SHOW_ERROR",
    GAME_STATE:             "gameState",

    // Internal (ClientManager -> App)
    CONNECTION_STATUS:      "CONNECTION_STATUS",
    CONNECTION_TIMEOUT:     "CONNECTION_TIMEOUT",
    CLEAR_CONNECTION_ERROR: "CLEAR_CONNECTION_ERROR",
} as const;


// ==========================================
// INCOMING MESSAGES ( Server -> Client )
// ==========================================

/**
 * Message: SET_SCREEN
 * Instruction to switch layout and hydrate state immediately.
 */
export interface SetScreenMessage {
    type: typeof MessageTypes.SET_SCREEN;
    data: GameState & {
        /** The ID of the screen to load from layout.json */
        screenId: string; 
    };
}

/**
 * Message: UPDATE_COMPONENTS
 * Instruction to merge new data into the current state.
 */
export interface UpdateDataMessage {
    type: typeof MessageTypes.UPDATE_COMPONENTS;
    data: GameState; // Just the state data, no screenId required
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
        pattern?: number[]; // React Native Vibration pattern is an array of numbers (e.g. [0, 200, 100, 200])
        duration?: number;
    };
}

/**
 * A lightweight way for the server to flash a quick error at the top/bottom of the phone (e.g., "Not your turn!") without writing a full UPDATE_COMPONENTS layout change
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
 * Message: CONNECTION_ERROR, internal message to trigger the disconnect overlay on the client
 */
export interface ConnectionErrorMessage {
    type: typeof MessageTypes.CONNECTION_STATUS;
    data?: {
        isConnected?: boolean;
    };
}

/**
 * Message: CONNECTION_TIMEOUT, internal message to trigger the timeout screen on the client after failed reconnection attempts
 */
export interface ConnectionTimeoutErrorMessage {
    type: typeof MessageTypes.CONNECTION_TIMEOUT;
    data?: {
        message: string;
    };
}

/**
 * Message: CLEAR_CONNECTION_ERROR, internal message to clear any connection error messages and return to the normal game screen
 */
export interface ClearConnectionErrorMessage {
    type: typeof MessageTypes.CLEAR_CONNECTION_ERROR;
}


export type ServerMessage =
    | SetScreenMessage 
    | UpdateDataMessage 
    | ConnectionErrorMessage
    | GameStateMessage
    | TriggerHapticsMessage
    | ShowErrorToastMessage
    | ConnectionTimeoutErrorMessage
    | ClearConnectionErrorMessage;

// ==========================================
// 4. OUTGOING MESSAGES ( Client -> Server )
// ==========================================

export interface ClientMessage {
    type: string;
    data?: any;
}