import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
    HOST_SERVER_URL, 
    DEVICE_ID_STORAGE_KEY, 
    CONNECTION_TIMEOUT_DURATION, 
    DEV_MODE 
} from '../utils/constants';
import { ServerMessage, ClientMessage } from '../types/ProtocolTypes';

// Interface for the application controller (NetworkContext)
interface AppController {
    handleMessage: (msg: ServerMessage) => void;
    onConnectionEstablished?: () => void;
}

export default class ClientManager {
    private appController: AppController;
    private client: WebSocket | null = null;
    private isConnected: boolean = false;
    private deviceUid: string | null = null;
    private connectionTimeout: NodeJS.Timeout | null = null;
    private hostUrl: string;

    constructor(appController: AppController) {
        this.appController = appController;
        this.hostUrl = HOST_SERVER_URL;

        // Device ID initialization
        this.getDeviceId();

        // --- MOCK DATA SIMULATION (For testing without a server) ---
        if (DEV_MODE) {
            this.runSimulation();
        }
    }

    private runSimulation() {
        console.log("⚠️ DEV_MODE: Running simulation sequences...");

        // Simulation 1: Switch to the connection screen after 0.5 sec
        setTimeout(() => {
            console.log("Simulating SET_SCREEN -> CONNECT_SCREEN");
            this.appController.handleMessage({
                type: "SET_SCREEN",
                data: {
                    screenId: "CONTROL_SCREEN",
                    // Initial state of components
                    components: {
                        "back_icon": { "texture": "https://service.play.works/shared/assets/avatars/8_ball.png" },
                        "btn_text": { "content": 200 },
                        "custom_back_btn": { "disabled": true, "visible": true },
                        "back_btn": { "disabled": false }
                    }
                }
            } as ServerMessage);
        }, 500);

        // Simulation 2: Update text after 2.5 sec
       /* setTimeout(() => {
            console.log("Simulating UPDATE_DATA");
            this.appController.handleMessage({
                type: "UPDATE_DATA",
                data: {
                    components: {
                        "tap_to_connect": { "content": "READY TO PAIR" },
                        "custom_back_btn": { "disabled": false, "style": { "opacity": 1 } }
                    }
                }
            } as ServerMessage);
        }, 2500);*/
    }

    public connect() {
        if (this.client && (this.client.readyState === WebSocket.OPEN || this.client.readyState === WebSocket.CONNECTING)) {
            console.log("WebSocket already connecting or open");
            return;
        }

        console.log(`Connecting to ${this.hostUrl}...`);
        
        try {
            this.client = new WebSocket(this.hostUrl);
            this.setListeners();
            this.setErrorConnectionTimeout();
        } catch (e) {
            console.error("WebSocket creation failed:", e);
        }
    }

    private setListeners() {
        if (!this.client) return;

        this.client.onopen = () => {
            console.log("WebSocket Connected");
            this.isConnected = true;
            this.clearErrorConnectionTimeout();
            
            // Send handshake or ID if needed
            // this.sendMessage("HANDSHAKE", { deviceId: this.deviceUid });

            if (this.appController.onConnectionEstablished) {
                this.appController.onConnectionEstablished();
            }
        };

        this.client.onmessage = (e: WebSocketMessageEvent) => {
            try {
                // e.data can be a string
                const msg = JSON.parse(e.data as string);
                this.appController.handleMessage(msg);
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        this.client.onclose = () => {
            console.log("WebSocket Disconnected");
            this.isConnected = false;
            // Reconnect logic can be added here
        };

        this.client.onerror = (e) => {
            console.error("WebSocket Error:", e);
        };
    }

    public sendMessage(type: string, data?: any) {
        if (this.client && this.isConnected) {
            const payload: ClientMessage = { type, data };
            this.client.send(JSON.stringify(payload));
        } else {
            console.warn("Cannot send message: WebSocket is not connected");
        }
    }

    // --- Helpers ---

    private async getDeviceId() {
        try {
            const savedId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
            if (savedId) {
                this.deviceUid = savedId;
            } else {
                this.deviceUid = this.uuidv4();
                await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, this.deviceUid);
            }
            console.log("Device ID:", this.deviceUid);
        } catch (e) {
            console.error("Error accessing AsyncStorage:", e);
        }
    }

    private uuidv4(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private setErrorConnectionTimeout() {
        this.clearErrorConnectionTimeout();
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                console.warn("Connection timeout reached");
                // Can notify the UI about an error
                this.appController.handleMessage({ 
                    type: "CONNECTION_ERROR_SCREEN",
                    data: { message: "Server not responding" }
                } as ServerMessage);
            }
        }, CONNECTION_TIMEOUT_DURATION);
    }

    private clearErrorConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    public disconnect() {
        if (this.client) {
            this.client.close();
            this.client = null;
            this.isConnected = false;
        }
    }
}