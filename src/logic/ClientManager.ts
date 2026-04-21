import AsyncStorage from '@react-native-async-storage/async-storage';
import * as pwmpLib from '../libs/pwmp_client.min.js';
import {
    HOST_SERVER_URL, 
    TRANSPORT,
    DEVICE_ID_STORAGE_KEY,
    CONNECTION_TIMEOUT_DURATION, 
    DEV_MODE 
} from '../utils/constants';
import { ServerMessage } from '../types/ProtocolTypes';

// UMD-bundle: PWMP is like named-field in module.exports
const PWMP = (pwmpLib as any).PWMP;


// Interface for the application controller (NetworkContext)
interface AppController {
    handleMessage: (msg: ServerMessage) => void;
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

    constructor(appController: AppController) {
        this.appController = appController;
        this._hostUrl = HOST_SERVER_URL;

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
                        "custom_back_btn": { "disabled": false, "visible": true },
                        "back_btn": { "disabled": false }
                    }
                }
            } as ServerMessage);
        }, 5);

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
        if (this.isConnected) {
            //this.sendMessage("request_current_game_state");
            return;
        }

        console.log(`Connecting to ${this._hostUrl}...`);
        try {
            this.setListeners();
            this.setErrorConnectionTimeout();
            this.setConnection();
        } catch (e) {
            console.error("WebSocket creation failed:", e);
        }
    }

    private setListeners() {
        if (!this.client) return;
    }

    public sendMessage(type: string, data?: any) {
        if (this.client && this.isConnected) {
            this.client.sendMessage({ type, data });
        } else {
            console.warn("Cannot send message: client is not connected");
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
            this.client.disconnect();
            this.client = null;
            this.isConnected = false;
        }
    }

    public createClient() {
        if (this._socketCreated) return;
        this._socketCreated = true;
        this.client = PWMP.Api.createRemoteControllerClient({
            connectionSettings: {
                host: HOST_SERVER_URL,
                transports: TRANSPORT
            },
            uuid: this.deviceUid
        });
    };

    public locationGetParam(key: string) {
        let query = location.search.substr(1);
        let data = query.split("&");
        for (let i = 0; i < data.length; i++) {
            let items = data[i].split("=");
            if (items.length === 2 && items[0] === key) {
                return items[1];
            }
        }
        return null;
    };
    
    public setConnection() {
        let eParams = this.locationGetParam("p");
        if (!eParams) {
            console.error("Connection parameter 'p' is missing from URL.");
            return;
        }
        let params = this.client.decrypt(eParams);
        this.client.connectRemoteController(params.host, {
            roomId: params.roomId,
            userSharedData: {},
        });
    };
}