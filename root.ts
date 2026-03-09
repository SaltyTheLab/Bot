import EventEmitter from 'events'
import { LRUCache } from 'lru-cache'
import { EmbedObject, messageObject, guildEmbedIds, Invite, channelObject, memberObject, guildObject, options, reactionObject, AuditLogEntryObject, AuditLogObject, Err, Punishment, userObject } from './types';
import { usersCollection, userTrackers, embedIDs, Invites, bans, counting } from './Database.js';
import punishUser from './punishUser.js';
import { Document, ObjectId, WithId } from 'mongodb';
import guildChannelMap from './guildconfiguration'
import { appendFile } from 'fs/promises';
const recentBans = new Map();
const memberCache = new LRUCache({ max: 50, ttl: 2 * 60 * 1000, ttlAutopurge: true });
const messageCache = new LRUCache({ max: 50, ttl: 2 * 60 * 1000, updateAgeOnGet: false, ttlAutopurge: true });
const VcCache: Record<string, string> = {}
const autoModCache = new Map();
const now = Date.now()
const reasonsandweights: Record<string, { reason: string, Weight: number }> = {
    hasInvite: { reason: 'Discord invite', Weight: 2 },
    everyonePing: { reason: 'Mass pinging', Weight: 2 },
    generalspam: { reason: 'Spamming', Weight: 1 },
    duplicateSpam: { reason: 'Spamming the same message', Weight: 1 },
    mediaViolation: { reason: 'Media violation', Weight: 1 },
    ForbiddenWords: { reason: "`NSFW word`", Weight: 1 },
    BannedWords: { reason: "Saying a slur", Weight: 2 },
    capSpam: { reason: 'Spamming Caps', Weight: 1 },
    maskedLinks: { reason: 'Posting masked links', Weight: 1 }
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
interface DataObject {
    heartbeat_interval?: number,
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
        this.ws.onopen = () => appendFile('bot_error.log', '[Gateway] Socket opened.\n');
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
        appendFile('bot_error.log', `Rate limited! Retrying after ${retryAfter}s \n`);
        await new Promise(res => setTimeout(res, parseInt(retryAfter) * 1000));
        await response(method, endpoint, body, reason);
    }
    if (res.ok) {
        if (res.status === 204) return true;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('image')) { return res; }
        return await res.json();
    }
    const err = await res.json().catch(() => ({})) as Err;
    appendFile('bot_error.log', `[REST ERROR] @ ${Date.toLocaleString()} | Status: ${res.status} | ${err.message} | ${JSON.stringify(err.errors, null, 2)}\n`);
    return null;
}
async function get(endpoint: string) { return await response('GET', endpoint); }
async function pull(endpoint: string) { return await response('DELETE', endpoint); }
async function post(endpoint: string, body: object) { return await response('POST', endpoint, body); }
async function put(endpoint: string, body: object | null = null, reason: string | null = null) { return await response('PUT', endpoint, body, reason); }
async function patch(endpoint: string, body: object, reason: string | null = null) { return await response('PATCH', endpoint, body, reason); }
const client = new MyGateway()
export { get, put, pull, patch, post };
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
                        {
                            name: 'unit', description: 'Unit', required: true, type: 3, choices: [
                                { name: 'Minute', value: 'min' },
                                { name: 'Hour', value: 'hour' },
                                { name: 'Day', value: 'day' }
                            ]
                        }]
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
        }, {
            name: 'restart', description: 'Restart the bot', default_member_permission: '8', contexts: [0]
        }]
    await put(`applications/1420927654701301951/commands`, commands)
    await usersCollection.updateMany(
        { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
        { $set: { "punishments.$[elem].active": 0 } },
        { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
    );
    setInterval(() => client.updateStatus(), 15000)
    appendFile('bot_error.log', 'Febot is awake! \n');
})
client.on("GUILD_AUDIT_LOG_ENTRY_CREATE", async (action: AuditLogEntryObject) => {
    appendFile("bot_error.log", JSON.stringify(action))
    if (action.action_type !== 143) return;
    const { guild_id, user_id, target_id, options: { channel_id, auto_moderation_rule_name } } = action
    const keyMap: Record<string, string> = { 'Forbidden Words': 'ForbiddenWords', 'Banned Words': 'BannedWords', 'No Invites': 'hasInvite', 'Masked Links': 'MaskedLinks' };
    const triggeredKey = keyMap[auto_moderation_rule_name];
    if (!autoModCache.has(user_id)) {
        autoModCache.set(user_id, {
            keys: [triggeredKey], timeout: setTimeout(async () => {
                const finalData = autoModCache.get(user_id);
                autoModCache.delete(user_id);
                const userData = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { xp: 1, level: 1, coins: 1, totalmessages: 1, joinedTime: 1, punishments: 1 } }) as Document;
                const punishments = userData.punishments.sort((a: Punishment, b: Punishment) => b.timestamp - a.timestamp)
                const activeReasons = finalData.keys.map((key: string) => reasonsandweights[key]).filter(Boolean);
                await pull(`channels/${channel_id}/messages/${target_id}`).catch(() => { });
                let totalWeight = activeReasons.map((entry: { reason: string, Weight: number }) => entry.Weight).reduce((acc: number, Weight: number) => acc + (Weight), 0);
                let reason = `AutoMod: ${activeReasons.map((check: { reason: string, Weight: number }) => check.reason).join('; ')}`;
                console.log(reason)
                if (userData.level < 3) { totalWeight += 1; reason += ' while new to the server.'; }
                const bannable = userData.level < 3 && (totalWeight >= 3 || punishments.length > 2);
                await punishUser(guild_id, user_id, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reason, channel_id, true, undefined, bannable ? 1 : totalWeight, bannable, false);
            }, 200)
        })
    } else
        autoModCache.get(user_id).keys.push(triggeredKey);
})
client.on("GUILD_CREATE", async (guild: guildObject) => {
    const guildinvites = await get(`guilds/${guild.id}/invites`) as Invite[];
    const invites = guildinvites.map((invite: Invite) => { return { code: invite.code, uses: invite.uses } })
    await Invites.updateOne({}, { $set: { [guild.id]: invites } }, { upsert: true })
    let messageIDs = await embedIDs.findOne({ guildId: guild.id }) as WithId<Document>
    const messageconfigs = guildChannelMap[guild.id].messageConfigs;
    if (!messageconfigs) { appendFile('bot_error.log', `[GuildConfig] No config found for guild ID: ${guild.id}\n`); return; }
    for (const [embedName, config] of Object.entries(messageconfigs)) {
        const { channelid, embeds, components, reactions } = config;
        try {
            const existingdata = messageIDs.find((m: guildEmbedIds) => m.name === embedName);
            const message = await get(`channels/${channelid}/messages/${existingdata.messageId}`) as messageObject
            const different = message.embeds.map((embed: EmbedObject) => getComparableEmbed(embed)).join('|||') !== embeds.map(embed => getComparableEmbed(embed)).join('|||')
            if (different) { await patch(`channels/${channelid}/messages/${message.id}`, { embeds: embeds, ...components }) }
        } catch {
            const msg = await post(`channels/${channelid}/messages`, { embeds: embeds, components: components }) as messageObject
            messageIDs = messageIDs.filter((message: guildEmbedIds) => message.name !== embedName);
            if (reactions)
                for (const reaction of reactions) {
                    await put(`channels/${channelid}/messages/${msg.id}/reactions/${reaction}/@me`);
                    await Bun.sleep(750)
                }
            appendFile('bot_error.log', `📝 Sent '${embedName}'. Message ID: ${msg.id} \n`);
            messageIDs.push({ name: embedName, messageId: msg.id })
            await embedIDs.updateOne({ guildId: guild.id }, { $set: { Data: messageIDs } })
        }
    }
})
client.on("GUILD_MEMBER_ADD", async (member: memberObject) => {
    const { guild_id, user } = member;
    const avatarURL: string = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
    const currentInvites = await get(`guilds/${guild_id}/invites`) as Invite[]
    const DatabaseInvites = await Invites.findOne({}, { projection: { _id: 0, [guild_id]: 1 } }) as Document;
    const guildInvitesmap = new Map<string, number>(DatabaseInvites[guild_id].map((i: Invite) => [i.code, i.uses]));
    const invite = currentInvites.find((i: Invite) => i.uses > (guildInvitesmap.get(i.code) || 0)) as Invite;
    const inviter = await get(`guilds/${guild_id}/members/${invite.inviter}`) as memberObject;
    await Invites.updateOne({}, { $set: { [guild_id]: currentInvites.map((i: Invite) => ({ code: i.code, uses: i.uses })) } }, { upsert: true })
    const createdTimestamp = String((BigInt(user.id) >> 22n) + 1420070400000n);
    const welcomeEmbed: EmbedObject = {
        color: 0x00FF99,
        description: `<@${user.id}> joined the Server!`,
        thumbnail: { url: avatarURL },
        fields: [{ name: 'Discord Join Date:', value: `<t:${Math.floor(Date.parse(createdTimestamp) / 1000)}>`, inline: true }],
        timestamp: new Date().toISOString(),
        footer: inviter ? { text: `Invited by: ${inviter.user.username} | ${invite.code}` } : undefined
    }
    const originalMessage = await post(`channels/${guildChannelMap[guild_id].modChannels.welcomeChannel}/messages`, {
        embeds: [welcomeEmbed],
        components: [{
            type: 1, components: [{
                type: 2,
                custom_id: invite && (!inviter.roles.some(role => guildChannelMap[guild_id].staffroles.includes(role)) || inviter.roles.includes(guildChannelMap[guild_id].jrrole)) ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                label: invite ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                style: 4
            }]
        }]
    }) as messageObject;
    if (Date.now() - Number(createdTimestamp) < 172800000) {
        await pull(`guilds/members/${user.id}`,)
        await post(`channels/${guildChannelMap[guild_id].modChannels.mutelogChannel}/messages`,
            {
                embeds: [{
                    title: 'A member was auto-kicked', thumbnail: { url: avatarURL }, description: `**User:** <@${user.id}>\n**Reason:** New Account\n**Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`
                }]
            })
        return;
    }
    memberCache.set(`${guild_id}-${user.id}`, member);
    if (!user.bot) {
        const dmChannel = await post(`users/@me/channels`, { recipient_id: user.id }) as channelObject;
        await post(`channels/${dmChannel.id}/messages`, {
            embeds: [{
                description: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.`,
                thumbnail: { url: avatarURL }
            }]
        })
        if (!(await usersCollection.findOne({ userId: user.id, guildId: guild_id })))
            await usersCollection.insertOne({ _id: new ObjectId(), userId: user.id, guildId: guild_id, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], joinedTime: Date.now(), blacklist: [] })
        if (!(await userTrackers.findOne({ userId: user.id, guildId: guild_id })))
            await userTrackers.insertOne({ userId: user.id, guild_id: guild_id, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [] })
    }
    setTimeout(async () => {
        await patch(`channels/${originalMessage.channel_id}/messages/${originalMessage.id}`, {
            embeds: [welcomeEmbed],
            components: [{
                type: 1, components: [{
                    type: 2,
                    custom_id: invite ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                    label: invite && (!inviter.roles.some(role => guildChannelMap[guild_id].staffroles.includes(role)) || inviter.roles.includes(guildChannelMap[guild_id].jrrole)) ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                    style: 4,
                    disabled: true
                }]
            }]
        })
    }, 15 * 60 * 1000)
})
client.on("GUILD_MEMBER_REMOVE", async (member: memberObject) => {
    const { user, guild_id } = member;
    const { joinedTime } = await usersCollection.findOne({ userId: user.id, guildId: guild_id }, { projection: { xp: 1, level: 1, coins: 1, totalmessages: 1, joinedTime: 1 } }) as Document;
    const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
    await post(`channels/${guildChannelMap[guild_id].modChannels.welcomeChannel}/messages`, {
        embeds: [{ description: `<@${user.id}> left the server.`, thumbnail: { url: avatarURL }, fields: [{ name: 'Server Join Date:', value: `<t:${Math.floor(Date.parse(joinedTime) / 1000)}>`, inline: true }] }]
    })

})
client.on("GUILD_MEMBER_UPDATE", async (member: memberObject) => {
    const { guild_id, user, nick } = member;
    const avatarURL: string = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
    const oldMember = memberCache.get(`${guild_id}-${user.id}`) as memberObject;
    const createdTimestamp = String((BigInt(user.id) >> 22n) + 1420070400000n);
    if (oldMember && oldMember.pending && !member.pending) {
        if (guild_id == "1231453115937587270")
            await put(`guilds/${guild_id}/members/${user.id}/roles/1463354464747524136`)
        console.log(`${member.user.username} has finished verification!`);
        await post(`channels/${guildChannelMap[guild_id].publicChannels.generalChannel}/messages`,
            {
                embeds: [{
                    thumbnail: { url: avatarURL },
                    description: `Welcome <@${user.id}> to the server!\n\n**Account Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`,
                    timestamp: new Date().toISOString()
                }]
            })
    }
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
client.on("GUILD_BAN_ADD", async (ban: { guild_id: string, user: userObject }) => {
    const { user, guild_id } = ban;
    if (await bans.findOne({ userId: user.id })) { await bans.deleteOne({ userId: user.id }); return; }
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
                        description: `**Moderator <@${executorId}> banned ${banCount} users:**\n ${existingEntry.bans.map((b: { user: userObject, reasons: string }) =>
                            `- <@${b.user.id}>: ${b.reasons}`).join('\n')}`,
                        timestamp: new Date().toISOString()
                    }]
            });
            recentBans.delete(executorId);
        }, 3000);
    }
})
client.on("GUILD_BAN_REMOVE", async (ban: { guild_id: string, user: userObject }) => {
    const { user, guild_id } = ban
    const banlogChannel = guildChannelMap[guild_id].modChannels.banlogChannel;
    const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${BigInt(user.id) % 5n}.png`;
    const entry = (await usersCollection.findOne({ userId: user.id, guildId: guild_id }, { projection: { punishments: 1 } }) as Document).filter((ban: Punishment) => ban.type == 'Ban').sort((a: Punishment, b: Punishment) => b.timestamp - a.timestamp)
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
    const invites = await Invites.findOne({}) as WithId<Document>
    await invites.updateOne({}, { $set: { [invite.guild_id]: invites } }, { upsert: true })
})
client.on("INVITE_DELETE", async (invite: Invite) => {
    const guildinvites = (await Invites.findOne({}) as WithId<Document>)[invite.guild_id].filter((inv: Invite) => inv.code !== `${invite.code}`)
    await Invites.updateOne({}, { $set: { [invite.guild_id]: guildinvites } }, { upsert: true })
})
client.on("MESSAGE_REACTION_ADD", async (reaction: reactionObject) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const embeds = await embedIDs.findOne({}) as WithId<Document>
    const guildEmbeds = embeds[guild_id] as guildEmbedIds[];
    if (!guildEmbeds || !guildEmbeds.some((info: guildEmbedIds) => info.messageId === message_id)) return;
    const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
    if (!roleID) { appendFile('bot_error.log', `⚠️ No role mapped to emoji: ${roleID}\n`); return; }
    const blacklist = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { blacklist: 1 } }) as WithId<Document>
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
    const embeds = await embedIDs.findOne({}) as WithId<Document>;
    const guildEmbeds = embeds[guild_id] as guildEmbedIds[];
    if (!guildEmbeds || !guildEmbeds.some((info: guildEmbedIds) => info.messageId === message_id)) return;
    const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
    if (!roleID) { appendFile('bot_error.log', `⚠️ No role mapped to emoji: ${roleID}\n`); return; }
    const blacklist = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { blacklist: 1 } }) as Document
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
        const state = await counting.findOne({ guildId: guild_id }, { projection: { lastuser: 1, count: 1 } }) as { _id: ObjectId, guildId: string, count: number, lastuser: string };
        if (!parseInt(content)) return;
        if (state.count + 1 == parseInt(content) && state.lastuser !== author.id) {
            await counting.findOneAndUpdate({ guildId: guild_id }, { $inc: { count: 1 }, $set: { lastuser: state.lastuser } })
            return await put(`channels/${channel_id}/messages/${id}/reactions/%E2%9C%85/@me`)
        }
        else {
            await counting.updateOne({ guildId: guild_id }, { $set: { count: 0, lastuser: null } }, { upsert: true });
            return await post(`channels/${channel_id}/messages`, { content: `<@${author.id}> missed or already counted!(Number Reset!)`, message_reference: { message_id: id } })
        }
    }
    let messageWords: string = '';
    let text: string = '';
    let isNewUser = null
    if (content.length >= 1) { messageWords = content.replace(/<a?:\w+:\d+>/g, '').replace(/[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, ''); text = messageWords.toLowerCase(); }
    for (const [trigger, response] of Object.entries(guildChannelMap[guild_id].responses))
        if (text.includes(trigger)) await post(`channels/${channel_id}/messages`, { content: response, message_reference: { message_id: id } })
    if (text.includes('<@857445139416088647>')) {
        const emoji = 'SaltyEyes:1257522749635563561';
        await put(`channels/${channel_id}/messages/${id}/reactions/${encodeURIComponent(emoji)}/@me`)
    }
    if (text.includes('bad') && text.includes('bot')) await put(`channels/${channel_id}/messages/${id}/reactions/😡/@me`)
    try {
        const { xp, level } = await usersCollection.findOneAndUpdate({ userId: author.id, guildId: guild_id }, { $inc: { xp: 20, totalmessages: 1 } }, { returnDocument: 'after', projection: { xp: 1, level: 1, userId: 1 } }) as WithId<Document>
        isNewUser = Date.now() - Date.parse(member.joined_at) < 2 * 24 * 60 * 60 * 1000 && level < 3
        if (xp >= guildChannelMap[guild_id].xp(level)) {
            const { level, xp } = await usersCollection.findOneAndUpdate({ userId: author.id, guildId: guild_id }, { $inc: { level: 1 }, $set: { xp: 0 } }, { returnDocument: 'after', projection: { level: 1, xp: 1 } }) as Document
            const rank = await usersCollection.countDocuments({ guildId: guild_id, $or: [{ level: { $gt: level } }, { level: level, xp: { $gt: xp } }] });
            await post(`channels/${channel_id}/messages`, {
                embeds: [{
                    author: { name: `${author.username} you reached level ${level}!`, icon_url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
                    color: 0x00AE86,
                    footer: { text: `You are now #${rank} in the server!` }
                }]
            })
            if (level >= 3 && !member.roles.includes("1334238580914131026") && guild_id == "1231453115937587270")
                await put(`guilds/${guild_id}/members/${author.id}/roles/1334238580914131026`)
        }
    } catch {
        appendFile('bot_error.log', `[Database] Missing/incomplete Database entry for ${author.id}.\n`)
        await usersCollection.insertOne({ _id: new ObjectId(), userId: author.id, guildId: guild_id, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], joinedTime: Date.now(), blacklist: [] })
    }
    messageCache.set(id, { author: { id: author.id, username: author.username, avatar: author.avatar }, content: content, attachments: attachments.map(a => ({ filename: a.filename, proxy_url: a.proxy_url })) });
    const staffroles = guildChannelMap[guild_id].staffroles
    const jrrole = guildChannelMap[guild_id].jrrole
    const isStaff = member.roles.some((roleId: string) => staffroles.includes(roleId)) || member.roles.includes(jrrole) || author.id === "521404063934447616";
    if (isStaff) return;
    const embedcheck = embeds.some((embed: EmbedObject) => { { return embed.type == 'image' || embed.type == "video" || embed.type == "gifv" || embed.type == "rich" } })
    const hasMedia = (attachments.length > 0 || embedcheck) && (flags & 8192) === 0 && !Object.values(guildChannelMap[guild_id].mediaexclusions as Record<string, string>).some(id => id === channel_id)
    if (!(await userTrackers.findOne({ userId: author.id, guildId: guild_id })))
        await userTrackers.insertOne({ userId: author.id, guildId: guild_id, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [] })
    const { Duplicatespamthreshold, mediathreshold, messagethreshold, spamthreshold } = guildChannelMap[guild_id].automodsettings;
    const { total, mediaCount, timestamps, duplicateCounts } = await userTrackers.findOneAndUpdate({ userId: author.id, guildId: guild_id },
        [{
            $set: {
                total: { $cond: [{ $gt: ["$total", messagethreshold] }, 1, { $add: ["$total", 1] }] },
                mediaCount: { $cond: [{ $gte: ["$total", messagethreshold] }, (hasMedia ? 1 : 0), { $add: ["$mediaCount", hasMedia ? 1 : 0] }] },
                timestamps: { $slice: [{ $concatArrays: ["$timestamps", [Date.now().toString()]] }, -15] },
                ...(messageWords.length > 1 ? { [`duplicateCounts.${messageWords}`]: { $add: [{ $ifNull: [`$duplicateCounts.${messageWords}`, 0] }, 1] } } : {})
            }
        }], { returnDocument: 'after', projection: { total: 1, mediaCount: 1, timestamps: 1, duplicateCounts: 1 } }) as Document;
    if (duplicateCounts[messageWords] >= Duplicatespamthreshold || mediaCount > mediathreshold && total < mediathreshold || total == 1)
        await userTrackers.updateOne({ userId: author.id, guildId: guild_id }, { $set: { duplicateCounts: {}, mediaCount: 0 } });
    let capspam = false;
    if (messageWords.length > 20 && (messageWords.match(/[A-Z]/g)?.length ?? 0) > 0) { const caps = messageWords.match(/[A-Z]/g) as string[]; capspam = (caps.length / messageWords.length) > 0.7; }
    const activemarks: Record<string, boolean> = {
        everyonePing: mention_everyone,
        duplicateSpam: duplicateCounts[messageWords] >= Duplicatespamthreshold,
        mediaViolation: mediaCount > mediathreshold && total < mediathreshold,
        generalspam: timestamps.filter((stamp: string) => Date.now() - parseInt(stamp) < 8000).length > spamthreshold,
        capSpam: capspam
    };
    if (mention_everyone) await pull(`channels/${channel_id}/messages/${id}`)
    const activeChecks = Object.keys(reasonsandweights).filter((key: string) => activemarks[key]).map(key => ({ ...reasonsandweights[key] }));
    let totalWeight = activeChecks.reduce((acc, check) => { return acc + check.Weight }, 0) as number;
    if (totalWeight == 0) return;
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const bannable = (isNewUser && (totalWeight >= 3 || activemarks.everyonePing)) ?? false
    await punishUser(guild_id, author.id, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reasonText, channel_id, true, undefined, bannable ? 1 : totalWeight, bannable, false);
});
client.on('shardDisconnect', (event) => {
    appendFile('bot_error.log', `Disconnected from Discord: ${event}\n`);
    process.exit(1);
});
client.on('VOICE_STATE_UPDATE', async (event) => {
    const { guild_id, channel_id, user_id, member } = event;
    const logchannel = guildChannelMap[guild_id].modChannels.voicelogChannel
    const oldChannelId = VcCache[user_id];
    if (oldChannelId === channel_id) return;
    VcCache[user_id] = channel_id;
    await post(`channels/${logchannel}/messages`, {
        embeds: [{
            author: { name: member.user.username, icon_url: `https://cdn.discordapp.com/avatars/${user_id}/${member.user.avatar}.png` },
            description: channel_id !== null ? `<@${user_id}> joined <#${channel_id}>.` : `<@${user_id}> left a voice channel.`,
            color: channel_id !== null ? 0x305830 : 0x8b0000,
            timestamp: new Date().toISOString()
        }]
    })
})
client.on('error', async (error) => appendFile('bot_error.log', `ERROR: ${error} \n`))