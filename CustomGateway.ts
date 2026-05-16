import EventEmitter from 'events'
import { appendFile } from 'fs/promises';
const now = Date.now()
interface DataObject {
    heartbeat_interval?: number,
    session_id?: string,
    resume_gateway_url?: string,
    token?: string,
    intents?: number,
    properties?: { os: string, browser: string, device: string },
    seq?: number,
    since?: number,
    activities?: [{ name: string, type: number, created_at: number, timestamps: { start: number } }],
    status?: string,
    afk?: boolean
}
function getUptime() {
    const uptimeMs = Date.now() - now;
    return `${Math.floor(uptimeMs / (1000 * 60 * 60 * 24))}d ${Math.floor((uptimeMs / (1000 * 60 * 60)) % 24)}h ${Math.floor((uptimeMs / (1000 * 60)) % 60)}m ${Math.floor((uptimeMs / 1000) % 60)}s`;
}
class MyGateway extends EventEmitter {
    private ws!: WebSocket;
    private seq: number = 0;
    private sessId: string | undefined = '';
    private resumeUrl: string = '';
    private interval: Timer | null = null;
    private ack: boolean = true;
    constructor() {
        super();
        this.connect();
    }
    private connect() {
        if (this.ws) {
            this.ws.onopen = this.ws.onclose = this.ws.onmessage = this.ws.onerror = null;
            try { this.ws.close(); } catch { /* empty */ }
        }
        this.ws = new WebSocket(this.sessId !== '' ? this.resumeUrl : 'wss://gateway.discord.gg/?v=10&encoding=json');
        this.ws.onopen = () => { };
        this.ws.onmessage = (event) => {
            const data: { op: number, s: number, t: string, d: DataObject } = JSON.parse(event.data.toString());
            this.packet(data);
        };
        this.ws.onclose = (event) => this.reconnect(event.code);
        this.ws.onerror = (err: Event) => appendFile('bot_error.log', `[WS Error]: ${JSON.stringify(err)}\n`);
    }
    private packet(pkg: { op: number, s: number, t: string, d: DataObject }) {
        const { op, d, s, t } = pkg;
        if (s !== null) this.seq = s;
        switch (op) {
            case 10: // HELLO
                this.heartbeat(d.heartbeat_interval);
                this.identify();
                break;
            case 11: this.ack = true; // HEARTBEAT ACK
                break;
            case 1: this.sendHb(); // HEARTBEAT REQUESTED
                break;
            case 7: // RECONNECT
            case 9: // INVALID SESSION
                if (!d) { this.sessId = ''; this.seq = 0; }
                this.ws.close(4000);
                break;
            case 0: // DISPATCH
                if (t === 'READY') {
                    this.sessId = d.session_id;
                    this.resumeUrl = d.resume_gateway_url || this.resumeUrl;
                    this.updateStatus();
                }
                this.emit(t, d);
                break;
        }
    }
    private op(op: number, d: DataObject) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op, d })); }
    private sendHb() { this.op(1, { seq: this.seq }); }
    private heartbeat(ms: number | undefined) {
        if (this.interval) clearInterval(this.interval);
        this.ack = true;
        this.interval = setInterval(() => { if (!this.ack) { appendFile('bot_error.log', '[Gateway] Heartbeat ACK missed. Zombied connection. \n'); return this.ws.close(4000); } this.ack = false; this.sendHb(); }, ms);
    }
    private identify() {
        if (this.sessId && this.seq !== null) this.op(6, { token: process.env.TOKEN, session_id: this.sessId, seq: this.seq });
        else this.op(2, { token: process.env.TOKEN, intents: 2 | 4 | 64 | 128 | 512 | 1024 | 32768, properties: { os: 'windows', browser: 'bun', device: 'bot' } });
    }
    private reconnect(code: number) {
        if (this.interval) clearInterval(this.interval);
        const sessionInvalidCodes = [4007, 4009];
        if (sessionInvalidCodes.includes(code)) { this.sessId = ''; this.seq = 0; }
        const fatal = [4004, 4010, 4011, 4012, 4013, 4014];
        if (fatal.includes(code)) { appendFile('bot_error.log', `[Gateway] Fatal Error (${code}).\n`); process.exit(1); }
        setTimeout(() => this.connect(), 5000);
    }
    public updateStatus() {
        this.op(3, {
            since: Date.now(),
            activities: [{ name: getUptime(), type: 3, created_at: Date.now(), timestamps: { start: Date.now() } }],
            status: 'online',
            afk: false
        })
    }
}
export const client = new MyGateway()
