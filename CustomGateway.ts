import EventEmitter from 'events'
import { GatewayOpcodes, ActivityType, PresenceUpdateStatus, GatewayCloseCodes } from 'discord-api-types/v10';
import type { GatewayReceivePayload, GatewayIdentifyData, GatewayResumeData, GatewayActivity, GatewayPresenceUpdateData } from 'discord-api-types/v10'
class MyGateway extends EventEmitter {
    private ws!: WebSocket;
    private seq: number = 0;
    public sessId: string | undefined = '';
    public resumeUrl: string = '';
    private interval: Timer | undefined = undefined;
    private statusInterval: Timer | undefined = undefined;
    private ack: boolean = false;
    private readonly startedAt: number = Date.now();
    private isReconnecting: boolean = false
    constructor() { super(); this.connect(); }
    private connect() {
        if (this.ws) { this.ws.onopen = this.ws.onclose = this.ws.onmessage = this.ws.onerror = null; this.ws.close(); }
        this.ws = new WebSocket(this.sessId ? `${this.resumeUrl}/?v=10&encoding=json` : 'wss://gateway.discord.gg/?v=10&encoding=json');
        this.ws.onmessage = ({ data }) => { this.packet(JSON.parse(data.toString())); };
        this.ws.onclose = (event) => this.reconnect(event.code);
        this.ws.onerror = (err: Event) => console.error(`[WS Error]: ${JSON.stringify(err)}\n`);
    }
    private packet(pkg: GatewayReceivePayload) {
        const { op, d, s, t } = pkg;
        if (s !== null) this.seq = s;
        switch (op) {
            case GatewayOpcodes.Hello: // HELLO
                this.heartbeat(d.heartbeat_interval);
                this.identify();
                break;
            case GatewayOpcodes.HeartbeatAck:
                this.ack = true; // HEARTBEAT ACK
                break;
            case GatewayOpcodes.Heartbeat:
                this.op(GatewayOpcodes.Heartbeat, this.seq); // HEARTBEAT REQUESTED
                break;
            case GatewayOpcodes.Reconnect: // RECONNECT
                console.log('[Gateway] Discord requested a reconnect. Closing and resuming...');
                this.terminateAndReconnect(4000);
                break;
            case GatewayOpcodes.InvalidSession: // INVALID SESSION
                const resumable = d as boolean;
                console.log(`[Gateway] Invalid Session. Resumable: ${resumable}`);
                if (!resumable) {
                    this.sessId = '';
                    this.seq = 0;
                }
                // Random backoff between 1-5 secs recommended by Discord before an identify
                this.terminateAndReconnect(4000, resumable ? 1000 : 2500);
                break;
            case GatewayOpcodes.Dispatch: // DISPATCH
                this.emit(t, d);
                break;
        }
    }
    private terminateAndReconnect(code: number, delay: number = 0) {
        if (this.isReconnecting) return;
        this.isReconnecting = true;

        clearInterval(this.interval);
        if (this.statusInterval) clearInterval(this.statusInterval);

        if (this.ws) {
            this.ws.onopen = this.ws.onclose = this.ws.onmessage = this.ws.onerror = null;
            try { this.ws.close(code); } catch { }
        }

        setTimeout(() => this.connect(), delay);
    }
    public startStatusLoop() {
        if (this.statusInterval) clearInterval(this.statusInterval);
        this.updateStatus();
        this.statusInterval = setInterval(() => this.updateStatus(), 5000);
    }
    private op(op: GatewayOpcodes, d: GatewayIdentifyData | number | GatewayResumeData | GatewayActivity | GatewayPresenceUpdateData) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op, d })); }
    private heartbeat(ms: number | undefined) {
        if (this.interval) clearInterval(this.interval);
        this.ack = true;
        this.interval = setInterval(() => {
            if (!this.ack) {
                console.log('[Gateway] Heartbeat ACK missed. Zombied connection. \n');
                return this.ws.close(4000);
            }
            this.ack = false; this.op(GatewayOpcodes.Heartbeat, this.seq);;
        }, ms);
    }
    private identify() {
        this.sessId ? this.op(GatewayOpcodes.Resume, { token: Bun.env.TOKEN!, session_id: this.sessId, seq: this.seq })
            : this.op(GatewayOpcodes.Identify, {
                token: Bun.env.TOKEN!, intents: 34494, properties: { os: 'windows', browser: 'bun', device: 'bot' }, activities: [{
                    name: `for 0d 0h 0m 0s`, type: ActivityType.Watching,
                }]
            } as GatewayIdentifyData);
    }
    private reconnect(code: number) {
        clearInterval(this.interval);
        if (this.statusInterval) clearInterval(this.statusInterval);
        const seqsession = [GatewayCloseCodes.InvalidSeq, GatewayCloseCodes.SessionTimedOut]
        const badconfig = [GatewayCloseCodes.AuthenticationFailed, GatewayCloseCodes.InvalidShard, GatewayCloseCodes.ShardingRequired, GatewayCloseCodes.InvalidAPIVersion, GatewayCloseCodes.InvalidIntents, GatewayCloseCodes.DisallowedIntents]
        if (seqsession.includes(code)) { this.sessId = ''; this.seq = 0; }
        if (badconfig.includes(code)) return console.error(`Fatal Error (${code}).`), process.exit(1);
        setTimeout(() => this.connect(), 5000);
    }
    public updateStatus() {
        const uptimeMs = Date.now() - this.startedAt;
        this.op(GatewayOpcodes.PresenceUpdate, {
            since: null,
            activities: [{
                name: `for ${Math.floor(uptimeMs / (86400000))}d ${Math.floor((uptimeMs / (3600000)) % 24)}h ${Math.floor((uptimeMs / (60000)) % 60)}m ${Math.floor((uptimeMs / 1000) % 60)}s`,
                type: ActivityType.Watching,
            }],
            status: PresenceUpdateStatus.Online,
            afk: false
        } as GatewayPresenceUpdateData)
    }
}
export const client = new MyGateway()
