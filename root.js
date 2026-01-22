import { WebSocket } from 'undici';
import EventEmitter from 'node:events';
import { config } from 'dotenv';
import { LRUCache } from 'lru-cache';
import db, { editinvites, editembedIDs, getembedIDs, getUser, remove, getPunishments, getinvites, getblacklist, getstate, initialize, increment, incrementUserProgress, performLevelUp, addTracker, updateTracker } from './Database/databaseAndFunctions.js';
import punishUser from './punishUser.js';
import guildChannelMap from './guildconfiguration.json' with {type: 'json'}
config();
const recentBans = new Map();
const memberCache = new LRUCache({ max: 50, ttl: 2 * 60 * 1000, ttlAutopurge: true });
const messageCache = new LRUCache({ max: 500, ttl: 5 * 60 * 1000, updateAgeOnGet: false, ttlAutopurge: true });
const autoModCache = new Map();
const staffroles = ['1235295120665088030', '1409208962091585607']
const reasonsandweights = {
    hasInvite: { reason: 'Discord invite', Weight: 2 },
    everyonePing: { reason: 'Mass pinging', Weight: 2 },
    generalspam: { reason: 'Spamming', Weight: 1 },
    duplicateSpam: { reason: 'Spamming the same message', Weight: 1 },
    mediaViolation: { reason: 'Media violation', Weight: 1 },
    ForbiddenWords: { reason: "`NSFW word`", weight: 1 },
    BannedWords: { reason: "Saying a slur", weight: 2 },
    capSpam: { reason: 'Spamming Caps', Weight: 1 },
    maskedLinks: { reason: 'Posting masked links', Weight: 1 }
};
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
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function clearExpiredWarns(usersCollection) {
    await usersCollection.updateMany(
        { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
        { $set: { "punishments.$[elem].active": 0 } },
        { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
    ).catch(err => console.error('❌ An error occurred during warn clearance:', err));
}
function getComparableEmbed(embedData) {
    if (!embedData) return null; const normalizeText = (text) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    return JSON.stringify({
        title: normalizeText(embedData.title), description: normalizeText(embedData.description), url: normalizeText(embedData.url),
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    });
}
class MyGateway extends WebSocket {
    constructor(intents, client) {
        super('wss://gateway.discord.gg/?v=10&encoding=json');
        this.intents = intents;
        this.ws = null;
        this.client = client
        this.sequence = null;
        this.sessionId = null;
        this.heartbeatInterval = null;
        this.onEvent = null;
        this.onopen = () => console.log('[Gateway] Connected.');
        this.onmessage = (raw) => (this.packet(JSON.parse(raw.data)));
        this.onclose = (event) => (this.reconnect(event.code));
        this.onerror = (err) => (console.error(`[WS Error]`, err));
    }
    packet({ op, d, s, t }) {
        if (s) this.seq = s;
        switch (op) {
            case 10: // Hello
                this.heartbeat(d.heartbeat_interval);
                this.sessId ? this.op(6, { token: process.env.TOKEN, session_id: this.sessId, seq: this.seq })
                    : this.op(2, { token: process.env.TOKEN, intents: this.intents, properties: { os: 'linux', browser: 'bot', device: 'bot' } });
                break;
            case 11: this.ack = true; break; // Heartbeat ACK
            case 1: this.sendHb(); break;   // Heartbeat requested
            case 7: case 9: this.close(4000); break; // Reconnect/Invalid
            case 0: // Event
                if (t === 'READY') {
                    this.sessId = d.session_id;
                    this.updateStatus()
                }
                this.client.emit(t, d);
                break;
        }
    }
    op(op, d) { this.send(JSON.stringify({ op, d })); }
    sendHb() { this.op(1, this.seq); }
    heartbeat(ms) {
        if (this.interval) clearInterval(this.interval);
        this.ack = true;
        this.interval = setInterval(() => {
            if (!this.ack) return this.close(4000);
            this.ack = false;
            this.sendHb();
        }, ms);
    }
    reconnect(code) {
        clearInterval(this.interval);
        if ([4004, 4010, 4011, 4014].includes(code)) {
            console.error("Critical error, check your token and intents.");
            process.exit(1);
        }
        console.log(`[Gateway] Closed (${code}). Reconnecting...`);
        setTimeout(() => new MyGateway(this.intents), 5000);
        this.close()
    }
    updateStatus() {
        this.op(3, {
            since: null,
            activities: [{
                name: "The Server",
                type: 3,
                created_at: Date.now(),
                timestamps: { start: Date.now() }
            }],
            status: 'online',
            afk: false
        })
    }
}
async function response(method, endpoint, body = null, reason = null) {
    const headers = { 'Authorization': `Bot ${process.env.TOKEN}`, 'User-Agent': 'Discord Bot (https://github.com/SaltyTheLab/Bot, 1.0.0)' };
    if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
    let finalBody = body;
    const isForm = body instanceof FormData;
    if (body && !isForm) { headers['Content-Type'] = 'application/json'; finalBody = JSON.stringify(body); }
    const res = await fetch(`https://discord.com/api/v10/${endpoint}`, { method, headers, body: finalBody });
    if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        console.warn(`Rate limited! Retrying after ${retryAfter}s`);
        await new Promise(res => setTimeout(res, retryAfter * 1000));
        await response(method, endpoint, body, reason); // Retry
    }
    if (res.ok) return res.status === 204 ? true : await res.json();

    const err = await res.json().catch(() => ({}));
    const msgs = { 50001: "Missing Access.", 50013: "Missing Permissions.", 10008: "Unknown Message.", 40001: "Unauthorized." };
    console.error(`[REST ERROR] ${res.status} | ${msgs[err.code] || err.message || "Unknown"}`);
    return null;
}
async function get(endpoint) { return await response('GET', endpoint); }
async function pull(endpoint) { return await response('DELETE', endpoint); }
async function post(endpoint, body) { return await response('POST', endpoint, body); }
async function put(endpoint, body, reason) { return await response('PUT', endpoint, body, reason); }
async function patch(endpoint, body, reason) { return await response('PATCH', endpoint, body, reason); }
class BotClient extends EventEmitter {
    constructor() { super(); this.gateway = null }
    async start() {
        const intents = 2 | 4 | 64 | 512 | 1024 | 32768;
        this.gateway = new MyGateway(intents, this);
        this.setupListeners();
    }
    async fetchGateway() { return await get('gateway/bot'); }
    setStatus() {
        if (this.gateway) {
            this.gateway.updateStatus();
        }
    }
    setupListeners() {
        this.addListener("READY", async () => {
            const commands = [
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
                    name: 'games', description: 'Play a game', type: 1, contexts: [0], options: [{ name: 'tictactoe', description: 'Play Tictactoe', type: 1, options: [{ name: 'opponent', description: 'Your Opponent', required: true, type: 6 }] }, { name: 'rps', description: 'Play Rock, Paper, Scissors', type: 1, options: [{ name: 'choice', description: 'Your move', type: 3, choices: [{ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' },] }] }, { name: 'logos', description: 'Play the Logo Game', type: 1 }, { name: 'bet', description: 'bet coins', type: 1, options: [{ name: 'amount', description: 'The amount', required: true, type: 4 }] }, { name: 'highlow', description: 'Guess a number between 1 and 100', type: 1 }],

                }, {
                    name: 'leaderboard', description: `Show the top ten users`, contexts: [0]
                }, {
                    name: 'member', description: 'Warn/Mute/Ban/kick/unwarn/unmute a member', default_member_permission: "1099511627776", contexts: [0], options: [{ name: 'warn', description: 'Warn a member', type: 1, options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'The reason', required: true, type: 3 }] }, { name: 'mute', description: 'Mute a user', type: 1, options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'Reason', required: true, type: 3 }, { name: 'duration', description: 'Duration', required: true, type: 4 }, { name: 'unit', description: 'Unit', required: true, type: 3, choices: [{ name: 'Minute', value: 'min' }, { name: 'Hour', value: 'hour' }, { name: 'Day', value: 'day' }] }] }, { name: 'ban', description: 'Ban a user', type: 1, options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'Reason', required: true, type: 3 }] }, { name: 'kick', description: 'Kick a user', type: 1, options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'Reason', required: true, type: 3 }] }, { name: 'unwarn', description: 'Removes a user\'s warn', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }] }, { name: 'unmute', description: 'Unmute a user', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }] }]
                }, {
                    name: 'modlogs', description: 'View a user’s moderation history.', default_member_permission: "1099511627776", contexts: [0], options: [{ name: 'target', description: 'The user to view', required: true, type: 6 }]
                }, {
                    name: 'note', description: 'add/show a user\'s notes', default_member_permission: "1099511627776", contexts: [0], options: [{ name: 'show', description: 'Display a users notes', type: 1, options: [{ name: 'target', description: 'target User', required: true, type: 6 }] }, { name: 'add', description: 'Add note to a user', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }, { name: 'note', description: 'note to add', required: true, type: 3 }] }]
                }, {
                    name: 'user', description: 'check your Rank or Profile', contexts: [0], options: [{ name: 'rank', description: 'See your xp and Level', type: 1, options: [{ name: 'member', description: 'The Member', type: 6 }] }, { name: 'profile', description: 'See your coins and totalmessages', type: 1, options: [{ name: 'member', description: 'The Member', type: 6 }] }]
                }, {
                    name: 'refresh', description: 'Refreshes the Posted embeds', default_member_permission: "8", contexts: [0]
                }]
            await put(`applications/1420927654701301951/commands`, commands)
            await clearExpiredWarns(db.collection('users'));
            console.log(await client.fetchGateway());
        })
        this.addListener("AUTO_MODERATION_ACTION_EXECUTION", async (action) => {
            const { guild_id, user_id, name, channel_id, message_id } = action
            let triggeredKey = '';
            switch (name) {
                case 'Forbidden Words': triggeredKey = 'ForbiddenWords'
                    break;
                case 'Banned Words': triggeredKey = 'BannedWords'
                    break;
                case 'No Invites': triggeredKey = 'hasInvite';
                    break;
                case 'Masked Links': triggeredKey = 'Maskedlinks'
            }
            if (!autoModCache.has(message_id)) {
                autoModCache.set(message_id, {
                    keys: [triggeredKey], timeout: setTimeout(async () => {
                        const finalData = autoModCache.get(message_id);
                        autoModCache.delete(message_id);
                        const { userData } = await getUser({ userId: user_id, guildId: guild_id, modflag: true });
                        const punishments = userData.punishments.filter(entry => entry.active == 1);
                        const activeReasons = finalData.keys.map(key => reasonsandweights[key]).filter(Boolean);
                        await pull(`channels/${channel_id}/messages/${message_id}`).catch(() => { });
                        let totalWeight = activeReasons.reduce((acc, check) => acc + (check.Weight || check.weight), 0);
                        let reasonStrings = activeReasons.map(check => check.reason);
                        let reason = `AutoMod: ${reasonStrings.join('; ')}`;
                        if (userData.level < 3) { totalWeight += 1; reason += ' while new to the server.'; }
                        const commoninputs = {
                            guildId: guild_id,
                            target: user_id,
                            moderatorUser: { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' },
                            reason: reason,
                            channelId: channel_id,
                            isAutomated: true
                        };
                        if (userData.level < 3 && (totalWeight >= 3 || punishments.length > 2)) await punishUser({ ...commoninputs, banflag: true });
                        else await punishUser({ ...commoninputs, currentWarnWeight: totalWeight });
                    }, 200)
                })
            } else
                autoModCache.get(message_id).keys.push(triggeredKey);
        })
        this.addListener("GUILD_CREATE", async (guild) => {
            const guildinvites = await get(`guilds/${guild.id}/invites`)
            const invites = guildinvites.map(invite => { return { code: invite.code, uses: invite.uses } })
            await editinvites({ guildId: guild.id, data: invites })
            let messageIDs = await getembedIDs({ guildId: guild.id })
            const messageconfigs = guildChannelMap[guild.id].messageConfigs ?? null
            if (!messageconfigs) { console.log(`No config found for guild ID: ${guild.id}`); return; }
            for (const [embedName, config] of Object.entries(messageconfigs)) {
                const { channelid, embeds, components, reactions } = config;
                const embed = embeds.map(e => { if (typeof e.color === 'string') e.color = parseInt(e.color.replace('#', ''), 16); return e; });
                try {
                    const existingdata = messageIDs.find(m => m.name === embedName)
                    const message = await get(`channels/${channelid}/messages/${existingdata.messageId}`)
                    const different = message.embeds.map(embed => getComparableEmbed(embed)).join('|||') !== embed.map(embed => getComparableEmbed(embed)).join('|||')
                    if (different) { await patch(`channels/${channelid}/messages/${message.id}`, { embeds: embed, ...components }) }
                } catch {
                    const msg = await post(`channels/${channelid}/messages`, { embeds: embed, components: components })
                    messageIDs = messageIDs.filter((message) => message.name !== embedName);
                    if (reactions)
                        for (const reaction of reactions) {
                            await put(`channels/${channelid}/messages/${msg.id}/reactions/${reaction}/@me`);
                            await sleep(750)
                        }
                    console.log(`📝 Sent '${embedName}'. Message ID: `, msg.id);
                    messageIDs.push({ name: embedName, messageId: msg.id })
                    await editembedIDs({ guildId: guild.id, data: messageIDs })
                }
            }
        })
        this.addListener("GUILD_MEMBER_ADD", async (member) => {
            const { guild_id, user } = member;
            const welcomeChannel = guildChannelMap[guild_id].modChannels.welcomeChannel;
            const muteChannel = guildChannelMap[guild_id].modChannels.mutelogChannel
            const generalchannel = guildChannelMap[guild_id].publicChannels.generalChannel
            const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${user.id % 5}.png`;
            const currentInvites = await get(`guilds/${guild_id}/invites`)
            let invitesCache = await getinvites({ guildId: guild_id })
            const oldInvitesMap = new Map(invitesCache.map(item => [item.code, item.uses]));
            let invite = currentInvites.find(i => i.uses > (oldInvitesMap.get(i.code) || 0));
            let inviter = invite?.inviter;
            invitesCache = currentInvites.map(i => ({ code: i.code, uses: i.uses }));
            await editinvites({ guildId: guild_id, data: invitesCache })
            const createdTimestamp = (BigInt(user.id) >> 22n) + 1420070400000n;
            const welcomeEmbed = {
                color: 0x00FF99,
                description: `<@${user.id}> joined the Server!`,
                thumbnail: { url: avatarURL },
                fields: [{ name: 'Discord Join Date:', value: `<t:${Math.floor(Date.parse(createdTimestamp) / 1000)}>`, inline: true }],
                timestamp: new Date().toISOString()
            };

            if (inviter) welcomeEmbed.footer = { text: `Invited by: ${inviter.username} | ${invite.code}` };

            const originalMessage = await post(`channels/${welcomeChannel}/messages`, {
                embeds: [welcomeEmbed],
                components: [{
                    type: 1, components: [{
                        type: 2,
                        custom_id: invite ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                        label: invite ? '🔨 Ban User & Delete Invite' : '🔨 Ban',
                        style: 4
                    }]
                }]
            })
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
                const dmChannel = await post(`users/@me/channels`, { recipient_id: user.id })
                await post(`channels/${dmChannel.id}/messages`, {
                    embeds: [{
                        description: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.`,
                        thumbnail: { url: avatarURL }
                    }]
                })
            }
            await getUser({ userId: user.id, guildId: guild_id })
            if (guild_id == "1231453115937587270")
                await put(`guilds/${guild_id}/members/${user.id}/roles/1463354464747524136`)
            setTimeout(async () => {
                await patch(`channels/${originalMessage.channel.id}/messages/${originalMessage.id}`, {
                    embeds: [welcomeEmbed],
                    components: [{
                        type: 1, components: [{
                            type: 2,
                            custom_id: invite ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                            label: invite ? '🔨 Ban User & Delete Invite' : '🔨 Ban',
                            style: 4,
                            disabled: true
                        }]
                    }]
                })
            }, 15 * 60 * 1000)
        })
        this.addListener("GUILD_MEMBER_REMOVE", async (member) => {
            const { user, guild_id } = member;
            const userData = await getUser({ userId: user.id, guildId: guild_id, modflag: true })
            const welcomeChannel = guildChannelMap[guild_id].modChannels.welcomeChannel;
            const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${user.id % 5}.png`;
            await post(`channels/${welcomeChannel}/messages`, {
                embeds: [{ description: `<@${user.id}> left the server.`, thumbnail: { url: avatarURL }, fields: [{ name: 'Server Join Date:', value: `<t:${Math.floor(Date.parse(userData.joinedTime) / 1000)}>`, inline: true }] }]
            })

        })
        this.addListener("GUILD_BAN_ADD", async (ban) => {
            const { user, guild_id } = ban;
            if (await remove(user.id)) return;
            else {
                const auditLog = await get(`guilds/${guild_id}/audit-logs?limit=1&user_id=${user.id}&action_type=22`)
                const entry = auditLog.audit_log_entries[0];
                const { executorId, reason } = entry;
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
                                description: `**Moderator <@${executorId}> banned ${banCount} users:**\n` + existingEntry.bans.map(b => `- <@${b.user.id}>: ${b.reason}`).join('\n'),
                                timestamp: new Date().toISOString()
                            }]
                    });
                    recentBans.delete(executorId);
                }, 3000);
            }
        })
        this.addListener("GUILD_BAN_REMOVE", async (ban) => {
            const { user, guild_id } = ban
            const banlogChannel = guildChannelMap[guild_id].modChannels.banlogChannel;
            const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${user.id % 5n}.png`;
            const punishments = await getPunishments(user.id, guild_id)
            const entry = punishments.filter(ban => ban.type == 'Ban')
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
        this.addListener("INVITE_CREATE", async (invite) => {
            const invites = await getinvites({ guildId: invite.guild_id })
            await editinvites({ guild: invite.guild_id, data: invites })
        })
        this.addListener("INVITE_DELETE", async (invite) => {
            let invites = await getinvites({ guildId: invite.guild_id })
            invites = invites.filter(inv => inv.code !== `${invite.code}`)
            await editinvites({ guildId: invite.guild_id, data: invites })
        })
        this.addListener("MESSAGE_REACTION_ADD", async (reaction) => {
            const { guild_id, user_id, message_id, emoji } = reaction;
            const guildEmbeds = await getembedIDs({ guildId: guild_id })
            if (!guildEmbeds || !guildEmbeds.some(info => info.messageId === message_id)) return;
            const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
            console.log(roleID)
            if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
            const blacklist = await getblacklist(user_id, guild_id)
            if (blacklist.length > 0 && blacklist.find(r => r === roleID)) return;
            if (Array.isArray((roleID)))
                await Promise.all(roleID.map(role =>
                    put(`guilds/${guild_id}/members/${user_id}/roles/${role}`)
                ));
            else
                await put(`guilds/${guild_id}/members/${user_id}/roles/${roleID}`);
        })
        this.addListener("MESSAGE_REACTION_REMOVE", async (reaction) => {
            const { guild_id, user_id, message_id, emoji } = reaction;
            const guildEmbeds = await getembedIDs({ guildId: guild_id })
            if (!guildEmbeds || !guildEmbeds.some(info => info.messageId === message_id)) return;
            const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
            if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
            const blacklist = await getblacklist(user_id, guild_id)
            if (blacklist.length > 0 && blacklist.find(r => r === roleID)) return;
            if (Array.isArray(roleID))
                await Promise.all(roleID.map(role =>
                    put(`guilds/${guild_id}/members/${user_id}/roles/${role}`)
                ));
            else
                await pull(`guilds/${guild_id}/members/${user_id}/roles/${roleID}`);
        })
        this.addListener(" GUILD_MEMBER_UPDATE", async (member) => {
            const { guild_id, user, nick } = member;
            const oldMember = memberCache.get(`${guild_id}-${user.id}`);
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
        this.addListener("MESSAGE_DELETE", async (deletedData) => {
            const { id, channel_id, guild_id } = deletedData;
            const message = messageCache.get(id)
            if (!message) return;
            const { author, content, attachments } = message;
            const logchannel = guildChannelMap[guild_id].modChannels.deletedlogChannel
            const mainEmbed = {
                color: 0xf03030,
                description: `Message by <@${author.id}> was deleted in <#${channel_id}>\n\n${content || ''}\n\n[Event Link](${`https://discord.com/channels/${guild_id}/${channel_id}/messages/${id}`})\n\n`,
                url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`,
                thumbnail: { url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
                footer: { text: `ID: ${id}` },
                timestamp: new Date().toISOString(),
            };
            const imageAttachments = attachments.filter(att => att.content_type.startsWith('image/')).map(att => att.proxy_url);
            const additionalEmbeds = imageAttachments.slice(0, imageAttachments.length).map(url => ({ url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`, image: { url: url } }));
            if (additionalEmbeds.length > 0) {
                mainEmbed.image = additionalEmbeds[0].image;
                additionalEmbeds.shift();
            }
            await post(`channels/${logchannel}/messages`, { embeds: [mainEmbed, ...additionalEmbeds] })
        })
        this.addListener("MESSAGE_UPDATE", async (newMessage) => {
            const oldMessage = messageCache.get(newMessage.id);
            if (!oldMessage) return;
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
        this.addListener("MESSAGE_CREATE", async (message) => {
            const { id, mention_everyone, guild_id, author, member, content, channel_id, attachments, flags, type, embeds } = message;
            if (author.bot == true || !guild_id || type == 20 || type == 7) return;
            if (channel_id == guildChannelMap[guild_id].publicChannels.countingChannel) {
                const state = await getstate(guild_id);
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
            let messageWords = null;
            let text;
            if (content.length >= 1) {
                // eslint-disable-next-line no-useless-escape
                messageWords = content.replace(/<a?:\w+:\d+>/g, '').replace(/[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '')
                text = messageWords.toLowerCase();
            } else
                text = content.toLowerCase();
            const isStaff = member.roles.some(roleId => staffroles.includes(roleId)) || author.id === "521404063934447616";
            const { Duplicatespamthreshold, mediathreshold, messagethreshold } = guildChannelMap[guild_id].automodsettings;
            const embedcheck = embeds.some(embed => { { return embed.type == 'image' || embed.type == "video" || embed.type == "gifv" || embed.type == "rich" } })
            const result = await incrementUserProgress({ userId: author.id, guildId: guild_id })
            const isNewUser = Date.now() - Date.parse(member.joined_at) < 2 * 24 * 60 * 60 * 1000 && result.level < 3
            const xpNeeded = Math.round(((result.level - 1) ** 1.5 * 52 + 40) / 20) * 20
            for (const [trigger, response] of Object.entries(replies))
                if (text.includes(trigger))
                    await post(`channels/${channel_id}/messages`, { content: response, message_reference: { message_id: id } })
            if (text.includes('<@857445139416088647>')) {
                const emoji = 'SaltyEyes:1257522749635563561'
                await put(`channels/${channel_id}/messages/${id}/reactions/${encodeURIComponent(emoji)}/@me`)
            }
            if (text.includes('bad') && text.includes('bot')) await put(`channels/${channel_id}/messages/${id}/reactions/😡/@me`)
            if (result.xp >= xpNeeded) {
                const { level } = await performLevelUp(author.id, guild_id);
                const { rank: rank } = await getUser({ userId: author.id, guildId: guild_id, modflag: true })
                await post(`channels/${channel_id}/messages`, {
                    embeds: [{
                        author: { name: `${author.username} you reached level ${level}!`, icon_url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
                        color: 0x00AE86,
                        footer: { text: `You are now #${rank} in the server!` }
                    }]
                })
                if (result.level >= 3 && !member.roles.includes("1334238580914131026") && guild_id == "1231453115937587270")
                    await put(`guilds/${guild_id}/members/${author.id}/roles/1334238580914131026`)
            }
            messageCache.set(id, {
                author: { id: author.id, username: author.username, avatar: author.avatar },
                content: content,
                attachments: attachments.map(a => ({ filename: a.filename, proxy_url: a.proxy_url }))
            });
            if (isStaff) return;
            const tracker = await addTracker(author.id, guild_id)
            let { total, mediaCount, duplicateCounts, timestamps } = tracker
            const currentcount = (duplicateCounts[messageWords] || 0) + 1;
            timestamps.push(Date.now())
            total += 1;
            if ((attachments.length > 0 || embedcheck) && (flags & 8192) === 0 && !Object.values(guildChannelMap[guild_id].mediaexclusions).some(id => id === channel_id))
                mediaCount += 1;
            const recentMessages = timestamps.filter(stamp => Date.now() - stamp < 1000 * 8)
            const activemarks = { everyonePing: mention_everyone, duplicateSpam: currentcount >= Duplicatespamthreshold, mediaViolation: mediaCount > mediathreshold, generalspam: recentMessages.length >= 4, capSpam: false };
            if (messageWords) {
                duplicateCounts[messageWords] = currentcount;
                if (messageWords.length >= 20) { const caps = messageWords.match(/[A-Z]/g); if (caps) activemarks.capSpam = (caps.length / messageWords.length) > 0.7; }
            }
            if (activemarks.everyonePing) await pull(`channels/${channel_id}/messages/${id}`)
            if (activemarks.duplicateSpam) duplicateCounts = {};
            if (activemarks.mediaViolation) mediaCount = 0;
            if (activemarks.generalspam) timestamps = [];
            if (total >= messagethreshold) { total = 0; mediaCount = 0; duplicateCounts = {}; timestamps = [] }
            await updateTracker(author.id, guild_id, total, duplicateCounts, mediaCount, timestamps)
            const activeChecks = Object.keys(reasonsandweights).filter(key => activemarks[key]).map(key => reasonsandweights[key].Weight)
            let totalWeight = activeChecks.reduce((acc, check) => { return acc + check.Weight }, 0);
            if (totalWeight == 0) return;
            let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
            if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
            const commoninputs = { guildId: guild_id, target: author.id, moderatorUser: { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reason: reasonText, channelId: channel_id, isAutomated: true }
            if (isNewUser && (totalWeight >= 3 || activemarks.everyonePing)) await punishUser({ ...commoninputs, banflag: true });
            else await punishUser({ ...commoninputs, currentWarnWeight: totalWeight })
        })
    }
}
const client = new BotClient()
await client.start();
export { get, pull, post, put, patch }