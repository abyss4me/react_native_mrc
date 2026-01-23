/**
 * src/types/ProtocolTypes.ts
 * Defines the shape of data exchanged between the Game Server and the Controller.
 */

// ==========================================
// 1. COMPONENT STATE
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
// 2. GAME STATE (The Data Payload)
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
// 3. INCOMING MESSAGES ( Server -> Client )
// ==========================================

/**
 * Message: SET_SCREEN
 * Instruction to switch layout and hydrate state immediately.
 */
export interface SetScreenMessage {
    type: "SET_SCREEN";
    data: GameState & { 
        /** The ID of the screen to load from main_layout.json */
        screenId: string; 
    };
}

/**
 * Message: UPDATE_DATA
 * Instruction to merge new data into the current state.
 */
export interface UpdateDataMessage {
    type: "UPDATE_DATA";
    data: GameState; // Just the state data, no screenId required
}

/**
 * Message: CONNECTION_ERROR
 */
export interface ConnectionErrorMessage {
    type: "CONNECTION_ERROR_SCREEN";
    data?: {
        message?: string;
    };
}

export type ServerMessage = 
    | SetScreenMessage 
    | UpdateDataMessage 
    | ConnectionErrorMessage;

// ==========================================
// 4. OUTGOING MESSAGES ( Client -> Server )
// ==========================================

export interface ClientMessage {
    type: string;
    data?: any;
}