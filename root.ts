import EventEmitter from 'events'
import { LRUCache } from 'lru-cache'
import { EmbedObject, messageObject, guildEmbedIds, Invite, channelObject, memberObject, guildObject, options, GuildBan, reactionObject, AuditLogEntryObject, AuditLogObject, error, Punishment, userObject } from './types';
import db, { editinvites, editembedIDs, getembedIDs, getUser, remove, getPunishments, getinvites, getblacklist, getstate, initialize, increment, incrementUserProgress, performLevelUp, addTracker, updateTracker, insertUser, setMessage, } from './databaseAndFunctions.js';
import punishUser from './punishUser.js';
import { Collection, Document, ObjectId, WithId } from 'mongodb';
import guildChannelMap from './guildconfiguration'
const recentBans = new Map();
const memberCache = new LRUCache({ max: 50, ttl: 2 * 60 * 1000, ttlAutopurge: true });
const messageCache = new LRUCache({ max: 500, ttl: 5 * 60 * 1000, updateAgeOnGet: false, ttlAutopurge: true });
const autoModCache = new Map();
const staffroles = ['1235295120665088030', '1409208962091585607']
const now = Date.now()
const reasonsandweights = {
    hasInvite: { reason: 'Discord invite', Weight: 2 },
    everyonePing: { reason: 'Mass pinging', Weight: 2 },
    generalspam: { reason: 'Spamming', Weight: 1 },
    duplicateSpam: { reason: 'Spamming the same message', Weight: 1 },
    mediaViolation: { reason: 'Media violation', Weight: 1 },
    ForbiddenWords: { reason: "`NSFW word`", Weight: 1 },
    BannedWords: { reason: "Saying a slur", Weight: 2 },
    capSpam: { reason: 'Spamming Caps', Weight: 1 },
    maskedLinks: { reason: 'Posting masked links', Weight: 1 }
} as FlagsMap
const replies = {
    "bark at you": "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark",
    "say the line": 'stay frosty :3',
    "execute order 66": 'Not the Padawans!!!',
    "hello there": 'general Kenobi',
    "bark": 'bark',
    "cute": 'You\'re Cute',
    "adorable": 'You\'re adorable',
    "grr": 'Don\'t you growl at me',
    '<@364089951660408843>': 'awooooooooo'
};
async function clearExpiredWarns(usersCollection: Collection) {
    await usersCollection.updateMany(
        { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
        { $set: { "punishments.$[elem].active": 0 } },
        { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
    ).catch(err => console.error('❌ An error occurred during warn clearance:', err));
}
function getComparableEmbed(embedData: EmbedObject) {
    if (!embedData) return null; const normalizeText = (text: string | null) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    return JSON.stringify({
        title: embedData.title ? normalizeText(embedData.title) : null,
        description: embedData.description ? normalizeText(embedData.description) : null,
        url: embedData.url ? normalizeText(embedData.url) : null,
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    });
}
function getUptime() {
    const uptimeMs = Date.now() - now;
    const seconds = Math.floor((uptimeMs / 1000) % 60);
    const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
    const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
interface countingstate {
    _id: ObjectId,
    guildId: string,
    count: number,
    lastuser: string
}
interface DataObject {
    heartbeat_interval?: number | null,
    session_id?: string,
    resume_gateway_url?: string,
    token?: string,
    intents?: number,
    properties?: { os: string, browser: string, device: string },
    seq?: number,
    since?: number,
    activities?: [{
        name: string,
        type: number,
        created_at: number,
        timestamps: { start: number }
    }],
    status?: string,
    afk?: boolean
}
interface gateWayData {
    op: number,
    s: number,
    t: string,
    d: DataObject
}
interface bans {
    [userid: string]: {
        user: userObject,
        reasons: string
    }
}
class MyGateway extends EventEmitter {
    private ws!: WebSocket;
    private seq: number = 0;
    private sessId: string = '';
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
            try { this.ws.close(); } catch { }
        }
        this.ws = new WebSocket(this.sessId !== '' ? this.resumeUrl : 'wss://gateway.discord.gg/?v=10&encoding=json');
        this.ws.onopen = () => console.log('[Gateway] Socket opened.');
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data.toString()) as gateWayData;
                this.packet(data);
            } catch (e) {
                console.error("[Gateway] Failed to parse packet", e);
            }
        };
        this.ws.onclose = (event) => this.reconnect(event.code);
        this.ws.onerror = (err) => console.error(`[WS Error]`, err);
    }
    private packet(pkg: gateWayData) {
        const { op, d, s, t } = pkg;
        if (s !== null) this.seq = s;
        switch (op) {
            case 10: // HELLO
                this.heartbeat(d.heartbeat_interval);
                this.identify();
                break;

            case 11: // HEARTBEAT ACK
                this.ack = true;
                break;

            case 1: // HEARTBEAT REQUESTED
                this.sendHb();
                break;

            case 7: // RECONNECT
            case 9: // INVALID SESSION
                if (!d) {
                    this.sessId = '';
                    this.seq = 0;
                }
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
    private op(op: number, d: DataObject) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN)
            this.ws.send(JSON.stringify({ op, d }));
        else
            console.warn(`[Gateway] Attempted to send OP ${op} while socket was not open.`);
    }
    private sendHb() { this.op(1, { seq: this.seq }); }
    private heartbeat(ms: number) {
        if (this.interval) clearInterval(this.interval);
        this.ack = true;
        this.interval = setInterval(() => {
            if (!this.ack) {
                console.warn("[Gateway] Heartbeat ACK missed. Zombied connection.");
                return this.ws.close(4000);
            }
            this.ack = false;
            this.sendHb();
        }, ms);
    }
    private identify() {
        if (this.sessId && this.seq !== null) {
            console.log("[Gateway] Attempting to Resume...");
            this.op(6, {
                token: process.env.TOKEN,
                session_id: this.sessId,
                seq: this.seq
            });
        } else {
            console.log("[Gateway] Identifying...");
            this.op(2, {
                token: process.env.TOKEN,
                intents: 2 | 4 | 64 | 512 | 1024 | 32768,
                properties: { os: 'windows', browser: 'bun', device: 'bot' }
            });
        }
    }
    private reconnect(code: number) {
        if (this.interval) clearInterval(this.interval);
        // 4007: Invalid sequence, 4009: Session timed out
        const sessionInvalidCodes = [4007, 4009];

        if (sessionInvalidCodes.includes(code)) {
            console.warn(`[Gateway] Session invalid (${code}). Resetting.`);
            this.sessId = '';
            this.seq = 0;
        }

        // Fatal Discord Errors
        const fatal = [4004, 4010, 4011, 4012, 4013, 4014];
        if (fatal.includes(code)) {
            console.error(`[Gateway] Fatal Error (${code}). Manual intervention required.`);
            process.exit(1);
        }

        console.log(`[Gateway] Connection lost (${code}). Reconnecting in 5s...`);
        setTimeout(() => this.connect(), 5000);
    }
    public updateStatus() {
        this.op(3, {
            since: Date.now(),
            activities: [{
                name: getUptime(),
                type: 3,
                created_at: Date.now(),
                timestamps: { start: Date.now() }
            }],
            status: 'online',
            afk: false
        })
    }
}
async function response(method: string, endpoint: string, body: object | null = null, reason: string | null = null) {
    const url = endpoint.startsWith('https://cdn.discordapp.com') ? endpoint : `https://discord.com/api/v10/${endpoint}`;
    const headers = new Headers({ 'Authorization': `Bot ${process.env.TOKEN}`, 'User-Agent': 'Discord Bot (https://github.com/SaltyTheLab/Bot, 1.0.0)' });
    const options: RequestInit = { method, headers }
    if (reason) headers.set('X-Audit-Log-Reason', encodeURIComponent(reason));
    if (body) {
        if (body instanceof FormData) options.body = body
        else { headers.set('Content-Type', 'application/json'); options.body = JSON.stringify(body); }
    }
    const res: Response = await Bun.fetch(url, options)
    if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') as string;
        console.warn(`Rate limited! Retrying after ${retryAfter}s`);
        await new Promise(res => setTimeout(res, parseInt(retryAfter) * 1000));
        await response(method, endpoint, body, reason); // Retry
    }
    if (res.ok) {
        if (res.status === 204) return true;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('image')) { return res; }
        return await res.json();
    }
    const err = await res.json().catch(() => ({})) as error;
    console.error(`[REST ERROR] Status: ${res.status} | ${err.message} | ${JSON.stringify(err.errors, null, 2)}`);
    return null;
}
async function get(endpoint: string) { return await response('GET', endpoint); }
async function pull(endpoint: string) { return await response('DELETE', endpoint); }
async function post(endpoint: string, body: object) { return await response('POST', endpoint, body); }
async function put(endpoint: string, body: object | null = null, reason: string | null = null) { return await response('PUT', endpoint, body, reason); }
async function patch(endpoint: string, body: object, reason: string | null = null) { return await response('PATCH', endpoint, body, reason); }
const client = new MyGateway()
export { get, put, pull, patch, post };
interface keyMap {
    [rule: string]: string
}
interface FlagsMap {
    [flag: string]: { Weight: number, reason: string }
}
client.on("READY", async () => {
    const commands: options[] = [
        { name: 'appeal', description: 'appeal a ban', contexts: [1], type: 1 }, {
            name: 'applications', description: 'Open/close applications', options: [{ name: 'open', description: 'Open applications', type: 1 }, { name: 'close', description: 'Close Applications', type: 1 }], contexts: [0], default_member_permission: "8",
        }, {
            name: 'apply', description: 'Apply to be on the mod team', type: 1
        }, {
            name: 'blacklist', description: 'edit/show a users blacklist', contexts: [0], default_member_permission: "1099511627776", options: [{ name: 'add', description: 'add a role ', type: 1, options: [{ name: 'target', description: 'User', required: true, type: 6 }, { name: 'role', description: 'role', required: true, type: 8 }] }, { name: 'show', description: 'show blacklist', type: 1, options: [{ name: 'target', description: 'user to show', required: true, type: 6 }] }, { name: 'remove', description: 'remove a role', type: 1, options: [{ name: 'target', description: 'User', required: true, type: 6 }, { name: 'role', description: 'Role', required: true, type: 8 }] }]
        }, {
            name: 'dnd', description: 'Roll DND dice', contexts: [0],
            options: [{ name: 'd4', description: 'Roll a D4', type: 1 }, { name: 'd6', description: 'Roll a D6', type: 1 }, { name: 'd8', description: 'Roll a D8', type: 1 }, { name: 'd10', description: 'Roll a D10', type: 1 }, { name: 'd12', description: 'Roll a D12', type: 1 }, { name: 'd20', description: 'Roll a D20', type: 1 }, { name: 'd100', description: 'Roll a D100', type: 1 }],
        }, {
            name: 'games', description: 'Play a game', type: 1, contexts: [0], options: [{ name: 'tictactoe', description: 'Play Tictactoe', type: 1, options: [{ name: 'opponent', description: 'Your Opponent', required: true, type: 6 }] }, { name: 'rps', description: 'Play Rock, Paper, Scissors', type: 1, options: [{ name: 'choice', description: 'Your move', type: 3, required: true, choices: [{ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' }] }] }, { name: 'logos', description: 'Play the Logo Game', type: 1 }, { name: 'bet', description: 'bet coins', type: 1, options: [{ name: 'amount', description: 'The amount', required: true, type: 4 }] }, { name: 'highlow', description: 'Guess a number between 1 and 100', type: 1 }],

        }, {
            name: 'leaderboard', description: `Show the top ten users`, contexts: [0]
        }, {
            name: 'member', description: 'Warn/Mute/Ban/kick/unwarn/unmute a member', default_member_permission: "1099511627776", contexts: [0], options: [
                {
                    name: 'warn', description: 'Warn a member', type: 1,
                    options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'The reason', required: true, type: 3 }]
                },
                {
                    name: 'mute', description: 'Mute a user', type: 1,
                    options: [
                        { name: 'target', description: 'The user', required: true, type: 6 },
                        { name: 'reason', description: 'Reason', required: true, type: 3 },
                        { name: 'duration', description: 'Duration', required: true, type: 4 },
                        { name: 'unit', description: 'Unit', required: true, type: 3, choices: [{ name: 'Minute', value: 'min' }, { name: 'Hour', value: 'hour' }, { name: 'Day', value: 'day' }] }]
                },
                {
                    name: 'ban', description: 'Ban a user', type: 1,
                    options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'Reason', required: true, type: 3 }]
                },
                {
                    name: 'kick', description: 'Kick a user', type: 1,
                    options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'Reason', required: true, type: 3 }]
                },
                { name: 'unwarn', description: 'Removes a user\'s warn', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }] },
                { name: 'unmute', description: 'Unmute a user', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }] }]
        }, {
            name: 'modlogs', description: 'View a user’s moderation history.', default_member_permission: "1099511627776", contexts: [0], options: [{ name: 'target', description: 'The user to view', required: true, type: 6 }]
        }, {
            name: 'note', description: 'add/show a user\'s notes', default_member_permission: "1099511627776", contexts: [0], options: [{ name: 'show', description: 'Display a users notes', type: 1, options: [{ name: 'target', description: 'target User', required: true, type: 6 }] }, { name: 'add', description: 'Add note to a user', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }, { name: 'note', description: 'note to add', required: true, type: 3 }] }]
        }, {
            name: 'user', description: 'check your Rank or Profile', contexts: [0], options: [{ name: 'rank', description: 'See your xp and Level', type: 1, options: [{ name: 'member', description: 'The Member', type: 6 }] }]
        }, {
            name: 'refresh', description: 'Refreshes the Posted embeds', default_member_permission: "8", contexts: [0]
        }]
    await put(`applications/1420927654701301951/commands`, commands)
    await clearExpiredWarns(db.collection('users'));
    setInterval(() => client.updateStatus(), 15000)
    console.log('Febot is awake!');
})
client.on("GUILD_AUDIT_LOG_ENTRY_CREATE", async (action: AuditLogEntryObject) => {
    if (action.action_type !== 144) return;
    const { guild_id, user_id, message_id, options: { channel_id, auto_moderation_rule_name } } = action
    const keyMap: Record<string, string> = { 'Forbidden Words': 'ForbiddenWords', 'Banned Words': 'BannedWords', 'No Invites': 'hasInvite', 'Masked Links': 'Maskedlinks' } as keyMap;
    const triggeredKey = keyMap[auto_moderation_rule_name];
    if (!autoModCache.has(message_id) && triggeredKey) {
        autoModCache.set(message_id, {
            keys: [triggeredKey], timeout: setTimeout(async () => {
                const finalData = autoModCache.get(message_id);
                autoModCache.delete(message_id);
                const Data = await getUser(user_id, guild_id);
                const punishments = await getPunishments(user_id, guild_id, true);
                const activeReasons = finalData.keys.map((key: string) => reasonsandweights[key]).filter(Boolean);
                interface active {
                    reason: string,
                    Weight: number
                }
                await pull(`channels/${channel_id}/messages/${message_id}`).catch(() => { });
                let totalWeight = activeReasons.map((entry: active) => entry.Weight).reduce((acc: number, Weight: number) => acc + (Weight), 0);
                const reasonStrings = activeReasons.map((check: active) => check.reason);
                let reason = `AutoMod: ${reasonStrings.join('; ')}`;
                if (Data?.userData.level < 3) { totalWeight += 1; reason += ' while new to the server.'; }
                if (Data?.userData.level < 3 && (totalWeight >= 3 || punishments.length > 2))
                    await punishUser(guild_id, user_id, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reason, channel_id, true, null, 1, true, message_id, false);
                else
                    await punishUser(guild_id, user_id, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reason, channel_id, true, null, totalWeight, false, message_id, false);
            }, 200)
        })
    } else
        autoModCache.get(message_id).keys.push(triggeredKey);
})
client.on("GUILD_CREATE", async (guild: guildObject) => {
    const guildinvites = await get(`guilds/${guild.id}/invites`) as Invite[];
    const invites = guildinvites.map((invite: Invite) => { return { code: invite.code, uses: invite.uses } })
    await editinvites(guild.id, invites)
    let messageIDs = await getembedIDs(guild.id) as Array<guildEmbedIds>
    const messageconfigs = guildChannelMap[guild.id].messageConfigs;
    if (!messageconfigs) { console.log(`No config found for guild ID: ${guild.id}`); return; }
    for (const [embedName, config] of Object.entries(messageconfigs)) {
        const { channelid, embeds, components, reactions } = config;
        try {
            const existingdata = messageIDs.find((m) => m.name === embedName) as guildEmbedIds
            const message = await get(`channels/${channelid}/messages/${existingdata.messageId}`) as messageObject
            const different = message.embeds.map((embed: EmbedObject) => getComparableEmbed(embed)).join('|||') !== embeds.map(embed => getComparableEmbed(embed)).join('|||')
            if (different) { await patch(`channels/${channelid}/messages/${message.id}`, { embeds: embeds, ...components }) }
        } catch {
            const msg = await post(`channels/${channelid}/messages`, { embeds: embeds, components: components }) as messageObject
            messageIDs = messageIDs.filter((message) => message.name !== embedName);
            if (reactions)
                for (const reaction of reactions) {
                    await put(`channels/${channelid}/messages/${msg.id}/reactions/${reaction}/@me`);
                    await Bun.sleep(750)
                }
            console.log(`📝 Sent '${embedName}'. Message ID: `, msg.id);
            messageIDs.push({ name: embedName, messageId: msg.id })
            await editembedIDs(guild.id, messageIDs)
        }
    }
})
client.on("GUILD_MEMBER_ADD", async (member: memberObject) => {
    const { guild_id, user } = member;
    const welcomeChannel = guildChannelMap[guild_id].modChannels.welcomeChannel;
    const muteChannel = guildChannelMap[guild_id].modChannels.mutelogChannel
    const generalchannel = guildChannelMap[guild_id].publicChannels.generalChannel
    const avatarURL: string = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
    const currentInvites = await get(`guilds/${guild_id}/invites`) as Invite[]
    const staffroles = ['1306337128426377296', '1235295120665088030', '1409208962091585607', '1388113570369372181']
    let invitesCache = await getinvites(guild_id);
    const oldInvitesMap = invitesCache.map((item: Invite) => [item.code, item.uses])
    const invite = currentInvites.find((i: Invite) => i.uses > (oldInvitesMap.get(i.code) || 0)) as Invite;
    const inviter = await get(`guilds/${guild_id}/members/${invite.inviter}`) as memberObject;
    invitesCache = currentInvites.map((i: Invite) => ({ code: i.code, uses: i.uses }));
    await editinvites(guild_id, invitesCache)
    const createdTimestamp = String((BigInt(user.id) >> 22n) + 1420070400000n);
    const welcomeEmbed: EmbedObject = {
        color: 0x00FF99,
        description: `<@${user.id}> joined the Server!`,
        thumbnail: { url: avatarURL },
        fields: [{ name: 'Discord Join Date:', value: `<t:${Math.floor(Date.parse(createdTimestamp) / 1000)}>`, inline: true }],
        timestamp: new Date().toISOString()
    }

    if (inviter) welcomeEmbed.footer = { text: `Invited by: ${inviter.user.username} | ${invite.code}` };

    const originalMessage = await post(`channels/${welcomeChannel}/messages`, {
        embeds: [welcomeEmbed],
        components: [{
            type: 1, components: [{
                type: 2,
                custom_id: invite && !inviter.roles.some(role => staffroles.includes(role)) ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                label: invite ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                style: 4
            }]
        }]
    }) as messageObject;
    if (Date.now() - Number(createdTimestamp) < 172800000) {
        await pull(`guilds/members/${user.id}`,)
        await post(`channels/${muteChannel}/messages`,
            {
                embeds: [{
                    title: 'A member was auto-kicked', thumbnail: { url: avatarURL }, description: `**User:** <@${user.id}>\n**Reason:** New Account\n**Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`
                }]
            })
        return;
    }
    await post(`channels/${generalchannel}/messages`,
        {
            embeds: [{
                thumbnail: { url: avatarURL },
                description: `Welcome <@${user.id}> to the server!\n\n**Account Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`,
                timestamp: new Date().toISOString()
            }]
        })

    if (!user.bot) {
        const dmChannel = await post(`users/@me/channels`, { recipient_id: user.id }) as channelObject;
        await post(`channels/${dmChannel.id}/messages`, {
            embeds: [{
                description: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.`,
                thumbnail: { url: avatarURL }
            }]
        })
    }
    await insertUser(user.id, guild_id)
    await addTracker(user.id, guild_id);
    if (guild_id == "1231453115937587270")
        await put(`guilds/${guild_id}/members/${user.id}/roles/1463354464747524136`)
    setTimeout(async () => {
        await patch(`channels/${originalMessage.channel_id}/messages/${originalMessage.id}`, {
            embeds: [welcomeEmbed],
            components: [{
                type: 1, components: [{
                    type: 2,
                    custom_id: invite ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                    label: invite ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                    style: 4,
                    disabled: true
                }]
            }]
        })
    }, 15 * 60 * 1000)
})
client.on("GUILD_MEMBER_REMOVE", async (member: memberObject) => {
    const { user, guild_id } = member;
    const Data = await getUser(user.id, guild_id);
    const welcomeChannel = guildChannelMap[guild_id].modChannels.welcomeChannel;
    const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
    await post(`channels/${welcomeChannel}/messages`, {
        embeds: [{ description: `<@${user.id}> left the server.`, thumbnail: { url: avatarURL }, fields: [{ name: 'Server Join Date:', value: `<t:${Math.floor(Date.parse(Data?.userData.joinedTime) / 1000)}>`, inline: true }] }]
    })

})
client.on("GUILD_MEMBER_UPDATE", async (member: memberObject) => {
    const { guild_id, user, nick } = member;
    const oldMember = memberCache.get(`${guild_id}-${user.id}`) as memberObject;
    memberCache.set(`${guild_id}-${user.id}`, member);
    if (!oldMember || nick === oldMember.nick) return;
    await post(`channels/${guildChannelMap[guild_id].modChannels.namelogChannel}/messages`, {
        embeds: [{
            thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
            color: 0x4e85b6,
            description: `<@${user.id}> **changed their nickname**\n\n` +
                `**Before:**\n${oldMember?.nick ?? oldMember?.user?.username}\n\n` +
                `**After:**\n${nick ?? user.username}`,
            timestamp: new Date().toISOString()
        }]
    })
})
client.on("GUILD_BAN_ADD", async (ban: GuildBan) => {
    const { user, guild_id } = ban;
    if (await remove(user.id)) return;
    else {
        const auditLog = await get(`guilds/${guild_id}/audit-logs?limit=1&user_id=${user.id}&action_type=22`) as AuditLogObject;
        const entry = auditLog?.audit_log_entries?.[0] ?? null;
        const executorId = entry?.user_id ?? null;
        const reason = entry?.reason ?? null;
        // 2. Mass Ban Logic (Buffer)
        let existingEntry = recentBans.get(executorId);
        if (existingEntry) { clearTimeout(existingEntry.timeout); existingEntry.bans.push({ user, reason }); }
        else existingEntry = { executorId, bans: [{ user, reason }] };
        existingEntry.timeout = setTimeout(async () => {
            const banlog = guildChannelMap[guild_id].modChannels.banlogChannel;
            const banCount = existingEntry.bans.length;
            await post(`channels/${banlog}/messages`, {
                embeds:
                    [{
                        color: 0xff3030,
                        title: 'Mass Ban Detected',
                        description: `**Moderator <@${executorId}> banned ${banCount} users:**\n` + existingEntry.bans.map((b: Record<string, bans>) => `- <@${b.user.id}>: ${b.reason}`).join('\n'),
                        timestamp: new Date().toISOString()
                    }]
            });
            recentBans.delete(executorId);
        }, 3000);
    }
})
client.on("GUILD_BAN_REMOVE", async (ban: GuildBan) => {
    const { user, guild_id } = ban
    const banlogChannel = guildChannelMap[guild_id].modChannels.banlogChannel;
    const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${BigInt(user.id) % 5n}.png`;
    const punishments = await getPunishments(user.id, guild_id)
    const entry = punishments.filter((ban: Punishment) => ban.type == 'Ban')
    await post(`https://discord.com/api/v10/channels/${banlogChannel}/messages`, {
        embeds: [{
            color: 0x309eff,
            title: 'A member was unbanned',
            thumbnail: { url: avatarURL },
            description: `**User**: <@${user.id}>\n**Tag**: \`${user.username}\`\n**Id**: \`${user.id}\`\n**Reason**: \`${entry[0].reason}\``,
            timestamp: new Date().toISOString()
        }]
    })

})
client.on("INVITE_CREATE", async (invite: Invite) => {
    const invites = await getinvites(invite.guild_id)
    await editinvites(invite.guild_id, invites)
})
client.on("INVITE_DELETE", async (invite: Invite) => {
    let invites = await getinvites(invite.guild_id)
    invites = invites.filter((inv: Invite) => inv.code !== `${invite.code}`)
    await editinvites(invite.guild_id, invites)
})
client.on("MESSAGE_REACTION_ADD", async (reaction: reactionObject) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const guildEmbeds = await getembedIDs(guild_id) as guildEmbedIds[];
    if (!guildEmbeds || !guildEmbeds.some((info: guildEmbedIds) => info.messageId === message_id)) return;
    const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
    if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
    const blacklist = await getblacklist(user_id, guild_id)
    if (blacklist.length > 0 && blacklist.find((r: unknown) => r === roleID)) return;
    if (Array.isArray((roleID)))
        await Promise.all(roleID.map(role =>
            put(`guilds/${guild_id}/members/${user_id}/roles/${role}`)
        ));
    else
        await put(`guilds/${guild_id}/members/${user_id}/roles/${roleID}`);
})
client.on("MESSAGE_REACTION_REMOVE", async (reaction: reactionObject) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const guildEmbeds = await getembedIDs(guild_id) as guildEmbedIds[];
    if (!guildEmbeds || !guildEmbeds.some((info: guildEmbedIds) => info.messageId === message_id)) return;
    const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
    if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
    const blacklist = await getblacklist(user_id, guild_id);
    if (blacklist.length > 0 && blacklist.find((r: string) => r === roleID)) return;
    if (Array.isArray(roleID))
        await Promise.all(roleID.map(role =>
            pull(`guilds/${guild_id}/members/${user_id}/roles/${role}`)
        ));
    else
        await pull(`guilds/${guild_id}/members/${user_id}/roles/${roleID}`);
})
client.on("MESSAGE_DELETE", async (deletedData: messageObject) => {
    const { id, channel_id, guild_id } = deletedData;
    const message = messageCache.get(id) as messageObject
    if (!message) return;
    const { author, content, attachments } = message;
    const logchannel = guildChannelMap[guild_id].modChannels.deletedlogChannel
    const imageAttachments = attachments.map((att) => att.proxy_url);
    const additionalEmbeds = imageAttachments.slice(1, imageAttachments.length).map(url => ({ url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`, image: { url: url } }));
    const mainEmbed: EmbedObject = {
        color: 0xf03030,
        description: `Message by <@${author.id}> was deleted in <#${channel_id}>\n\n${content || ''}\n\n[Event Link](${`https://discord.com/channels/${guild_id}/${channel_id}/messages/${id}`})\n\n`,
        url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`,
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
        footer: { text: `ID: ${id}` },
        timestamp: new Date().toISOString(),
        image: { url: imageAttachments[0] }
    }
    console.log(mainEmbed)
    await post(`channels/${logchannel}/messages`, { embeds: [mainEmbed, ...additionalEmbeds] })
})
client.on("MESSAGE_UPDATE", async (newMessage: messageObject) => {
    const oldMessage = messageCache.get(newMessage.id) as messageObject;
    if (!oldMessage || oldMessage.content == newMessage.content) return;
    await post(`channels/${guildChannelMap[newMessage.guild_id].modChannels.updatedlogChannel}/messages`, {
        embeds: [{
            description: `<@${oldMessage.author.id}> edited a message in <#${newMessage.channel_id}>\n\n **Before:**\n${oldMessage.content || ''}\n\n **After:**\n${newMessage.content || ''}\n\n[Jump to Message](https://discordapp.com/channels/${newMessage.guild_id}/${newMessage.channel_id}/messages/${newMessage.id})`,
            color: 0x309eff,
            thumbnail: { url: `https://cdn.discordapp.com/avatars/${oldMessage.author.id}/${oldMessage.author.avatar}.png` },
            footer: { text: `ID: ${newMessage.id}` },
            timestamp: new Date().toISOString()
        }]
    })
    oldMessage.content = newMessage.content
    messageCache.set(newMessage.id, oldMessage);
})
client.on("MESSAGE_CREATE", async (message: messageObject) => {
    const { id, mention_everyone, guild_id, author, member, content, channel_id, attachments, flags, type, embeds } = message;
    if (author.bot == true || !guild_id || type == 20 || type == 7) return;
    if (channel_id == guildChannelMap[guild_id].publicChannels.countingChannel) {
        const state = await getstate(guild_id) as countingstate;
        if (!parseInt(content)) return;
        if (state.count + 1 == parseInt(content) && state.lastuser !== author.id) {
            await increment(guild_id, author.id);
            return await put(`channels/${channel_id}/messages/${id}/reactions/%E2%9C%85/@me`)
        }
        else {
            await initialize(guild_id);
            return await post(`channels/${channel_id}/messages`, { content: `<@${author.id}> missed or already counted!(Number Reset!)`, message_reference: { message_id: id } })
        }
    }
    let messageWords: string = ''
    let text: string = '';
    let isNewUser = null
    if (content.length >= 1) {
        messageWords = content.replace(/<a?:\w+:\d+>/g, '').replace(/[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '')
        text = messageWords.toLowerCase();
    } else
        text = content.toLowerCase();
    for (const [trigger, response] of Object.entries(replies))
        if (text.includes(trigger))
            await post(`channels/${channel_id}/messages`, { content: response, message_reference: { message_id: id } })
    if (text.includes('<@857445139416088647>')) {
        const emoji = 'SaltyEyes:1257522749635563561'
        await put(`channels/${channel_id}/messages/${id}/reactions/${encodeURIComponent(emoji)}/@me`)
    }
    if (text.includes('bad') && text.includes('bot')) await put(`channels/${channel_id}/messages/${id}/reactions/😡/@me`)
    const isStaff = member.roles.some((roleId: string) => staffroles.includes(roleId)) || author.id === "521404063934447616";
    const { Duplicatespamthreshold, mediathreshold, messagethreshold, spamthreshold } = guildChannelMap[guild_id].automodsettings;
    const embedcheck = embeds.some((embed: EmbedObject) => { { return embed.type == 'image' || embed.type == "video" || embed.type == "gifv" || embed.type == "rich" } })
    try {
        const result = await incrementUserProgress(author.id, guild_id) as WithId<Document>
        isNewUser = Date.now() - Date.parse(member.joined_at) < 2 * 24 * 60 * 60 * 1000 && result.level < 3
        const xpNeeded = Math.round(((result.level - 1) ** 1.5 * 52 + 40) / 20) * 20
        if (result.xp >= xpNeeded) {
            const level = await performLevelUp(author.id, guild_id);
            const Data = await getUser(author.id, guild_id)
            await post(`channels/${channel_id}/messages`, {
                embeds: [{
                    author: { name: `${author.username} you reached level ${level?.level}!`, icon_url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
                    color: 0x00AE86,
                    footer: { text: `You are now #${Data?.rank} in the server!` }
                }]
            })
            if (result.level >= 3 && !member.roles.includes("1334238580914131026") && guild_id == "1231453115937587270")
                await put(`guilds/${guild_id}/members/${author.id}/roles/1334238580914131026`)
        }
    } catch (err) {
        console.warn(`Missing/incomplete Database entry for ${author.username}: `, err)
    }
    messageCache.set(id, {
        author: { id: author.id, username: author.username, avatar: author.avatar },
        content: content,
        attachments: attachments.map(a => ({ filename: a.filename, proxy_url: a.proxy_url }))
    });
    if (isStaff) return;
    const mediaexclusions = guildChannelMap[guild_id].mediaexclusions as Record<string, string>
    const hasMedia = (attachments.length > 0 || embedcheck) && (flags & 8192) === 0 && !Object.values(mediaexclusions).some(id => id === channel_id)
    const { generalSpam, mediaviolation } = await updateTracker(author.id, guild_id, mediathreshold, hasMedia, messagethreshold, spamthreshold);
    let duplicateCounts = false;
    let capspam = false;
    if (messageWords) {
        duplicateCounts = await setMessage(author.id, guild_id, messageWords, Duplicatespamthreshold) as boolean;
        if (messageWords.length >= 20) { const caps = messageWords.match(/[A-Z]/g); if (caps) capspam = (caps.length / messageWords.length) > 0.7; }
    }
    const activemarks = { everyonePing: mention_everyone, duplicateSpam: duplicateCounts, mediaViolation: mediaviolation, generalspam: generalSpam, capSpam: capspam } as Record<string, boolean>;
    if (activemarks.everyonePing) await pull(`channels/${channel_id}/messages/${id}`)
    const activeChecks = Object.keys(reasonsandweights).filter((key: string) => activemarks[key]).map(key => ({ ...reasonsandweights[key] }));
    let totalWeight = activeChecks.reduce((acc, check) => { return acc + check.Weight }, 0) as number;
    if (totalWeight == 0) return;
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    if (isNewUser && (totalWeight >= 3 || activemarks.everyonePing)) await punishUser(guild_id, author.id, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reasonText, channel_id, true, null, 1, true, id, false);
    else await punishUser(guild_id, author.id, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reasonText, channel_id, true, null, totalWeight, false, id, false)
});
