import AsyncStorage from '@react-native-async-storage/async-storage';
import * as pwmpLib from '../libs/pwmp_client.min.js';
import {
    HOST_SERVER_URL, 
    TRANSPORT,
    DEVICE_ID_STORAGE_KEY,
    CONNECTION_TIMEOUT_DURATION, 
    DEV_MODE 
} from '../constants';
import {MessageTypes, ServerMessage} from '../types/ProtocolTypes';
import {loadPwmpClient} from '../utils/ClientLibLoader';

// UMD-bundle: PWMP is like named-field in module.exports
const PWMP = (pwmpLib as any).PWMP;

// Interface for the application controller (NetworkContext)
interface AppController {
    dispatch: (msg: ServerMessage | any) => void;
    onConnectionEstablished?: () => void;
}

export default class ClientManager {
    public appController: AppController;
    public client: any = null;
    public isConnected: boolean = false;
    public deviceUid: string | null = null;
    public connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    private _hostUrl: string;
    private _socketCreated: boolean;
    private _lastConnectionParam: string | null = null; // Stored for manual reconnection

    constructor(appController: AppController) {
        this.appController = appController;
        this._hostUrl = HOST_SERVER_URL;

        // Device ID initialization
        this.getDeviceId();

        // --- MOCK DATA SIMULATION (For testing without a server) ---
        if (DEV_MODE) {
           // this.runSimulation();
        }
    }

    private runSimulation() {
        console.log("⚠️ DEV_MODE: Running simulation sequences...");

        // Simulation 1: Switch to the connection screen after 0.5 sec
        setTimeout(() => {
            console.log("Simulating SET_SCREEN -> CONNECT_SCREEN");
            this.appController.dispatch({
                type: MessageTypes.SET_SCREEN,
                data: {
                    data: {
                        screenId: "WAIT_SCREEN",
                        // Initial state of components
                        components: {
                            money: {content: "1000"},
                            avatar: {texture: "https://service.play.works/shared/assets/avatars/8_ball.png"},
                            name: {content: "JOHN"},
                            avatar_group: {visible: true},
                            player_bg: {texture: `player${1}.png`},
                            money_val: {content: "500$"},
                        }
                    }
                }
            } as any);
        }, 5);
       /* setTimeout(() => {
            console.log("Simulating SET_SCREEN -> CONNECT_SCREEN");
            this.appController.dispatch({
                type: MessageTypes.UPDATE_COMPONENTS,
                data: {
                    data: {
                        screenId: "VOWEL_SCREEN",
                        // Initial state of components
                        components: {
                            money: {content: "3000"},
                            avatar: {texture: "https://service.play.works/shared/assets/avatars/8_ball.png"},
                            name: {content: "JOHN"},
                            avatar_group: {visible: true},
                            player_bg: {texture: `player${1}.png`},
                            money_val: {content: "5100$"},
                        }
                    }
                }
            } as ServerMessage);
        }, 2000);*/

    }

    public async connect(p_param: string) {
        // If a client already exists or is connected, cleanly destroy it before attempting a new connection
        if (this.client || this.isConnected) {
            console.log("Cleaning up existing connection before starting a new one...");
            this.disconnect();
        }

        this._lastConnectionParam = p_param;

        // Clear any prior connection errors in the UI
        this.appController.dispatch({
            type: MessageTypes.CLEAR_CONNECTION_ERROR
        });

        console.log(`Connecting to ${this._hostUrl}...`);
        try {
            await this.createClient(); // Ensure client is created before connecting
            this.setListeners();
            this.setErrorConnectionTimeout();
            this.setConnection(p_param);
        } catch (e) {
            console.error("Connection setup failed:", e);
            this._socketCreated = false;
            this.appController.dispatch({
                type: MessageTypes.CONNECTION_TIMEOUT,
                data: { message: "Failed to load client library. Please check your internet connection and try again." }
            });
        }
    }

    private setListeners() {
        if (!this.client) return;

        this.client.addEventListener("connected", this.onConnected);
        this.client.addEventListener("userMessage", this.onUserMessage);
        this.client.addEventListener("userDisconnected", this.onUserDisconnected);
        this.client.addEventListener("userReconnected", this.onUserReconnected);
        this.client.addEventListener("roomUpdated", this.onRoomUpdated);
    }

    private removeListeners() {
        if (!this.client) return;

        this.client.removeEventListener("connected", this.onConnected);
        this.client.removeEventListener("userMessage", this.onUserMessage);
        this.client.removeEventListener("userDisconnected", this.onUserDisconnected);
        this.client.removeEventListener("userReconnected", this.onUserReconnected);
        this.client.removeEventListener("roomUpdated", this.onRoomUpdated);
    }

    public onUserDisconnected = () => {
        if (!this.client) return;
        this.isConnected = false;
        console.log("User disconnected");
        this.appController.dispatch({
            type: MessageTypes.CONNECTION_STATUS,
            data: { isConnected: false }
        } as ServerMessage);
    }

    public onUserReconnected = () => {
        if (!this.client) return;
        this.isConnected = true;
        console.log("User reconnected");
        this.appController.dispatch({
            type: MessageTypes.CONNECTION_STATUS,
            data: { isConnected: true }
        } as ServerMessage);
    }

    public onRoomUpdated = () => {
        if (!this.client) return;
    }

    public onUserMessage = (data: any, payload?: any) => {
        if (!this.client) return;
        this.isConnected = true;
        this.appController.dispatch({
            ...data,
            ...payload
        } as ServerMessage);
    }

    public onConnected = () => {
        if (!this.client) return;
        this.isConnected = true;
        this.clearErrorConnectionTimeout();
        console.log("Connection established!");
        if (this.appController.onConnectionEstablished) {
            this.appController.onConnectionEstablished();
        }
        this.appController.dispatch({
            type: MessageTypes.CONNECTION_STATUS,
            data: { isConnected: true }
        } as ServerMessage);
    }

    public sendMessage = (type: string, data?: any) => {
        console.log(`[ClientManager] Attempting to send message. isConnected: ${this.isConnected}, client exists: ${!!this.client}`);
        if (this.client && this.isConnected) {
            this.client.sendMessage({ type, data });
        } else {
            console.warn(`Cannot send message: client is ${this.client ? 'present' : 'null'}, isConnected is ${this.isConnected}`);
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
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private setErrorConnectionTimeout() {
        this.clearErrorConnectionTimeout();
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                console.warn("Connection timeout reached");
                this.appController.dispatch({
                    type: MessageTypes.CONNECTION_TIMEOUT,
                    data: { message: "Unable to connect, please try again" }
                });
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
            this.removeListeners();
            try {
                this.client.disconnect();
                console.log("Client disconnected successfully.");
            }
            catch (e) {
                console.error("Error during client disconnect:", e);
            }
            this.client = null;
            this.isConnected = false;
            this._socketCreated = false; // Fix: Allow client to be recreated!
        }
    }

    public reconnect() {
        if (this._lastConnectionParam) {
            console.log("Attempting manual reconnect...");
            this.disconnect();
            this.connect(this._lastConnectionParam);
        } else {
            console.warn("No previous connection parameter available for reconnect.");
        }
    }

    public async createClient() {
        if (this._socketCreated) return;
        this._socketCreated = true;

        const PWMP = await loadPwmpClient();

        this.client = PWMP.Api.createRemoteControllerClient({
            connectionSettings: {
                host: HOST_SERVER_URL,
                transports: TRANSPORT
            },
            uuid: this.deviceUid
        });

        if (!this.client) {
             console.error("Critical Error: PWMP.Api.createRemoteControllerClient returned null or undefined!");
        }
    };

    public setConnection(p_param: string) {
        if (!p_param) {
            console.error("Connection parameter 'p_param' is missing.");
            return;
        }

        let targetHost = HOST_SERVER_URL;
        let finalRoomId = "";

        try {
            if (this.client.decrypt) {
                let params = this.client.decrypt(p_param);
                if (params && params.roomId) {
                    targetHost = params.host || targetHost;
                    finalRoomId = params.roomId;
                    console.log("Decrypted hash payload:", params);
                }
            }
        } catch (error) {
            console.error("Failed to decrypt the provided connection hash:", error);
        }

        if (finalRoomId) {
            this.client.connectRemoteController(targetHost, {
                roomId: finalRoomId,
                userSharedData: {},
            });
        } else {
            console.error("Could not determine room ID from the provided parameter.");
        }
    };
}