import EventEmitter from 'events'
import { LRUCache } from 'lru-cache'
import type { APIEmbed, APIMessage, GatewayAutoModerationActionExecutionDispatchData, GatewayGuildBanAddDispatchData, GatewayGuildBanRemoveDispatchData, GatewayGuildMemberAddDispatchData, GatewayGuildMemberRemoveDispatchData, GatewayGuildMemberUpdateDispatchData, GatewayInviteCreateDispatchData, GatewayInviteDeleteDispatchData, GatewayMessageCreateDispatchData, GatewayMessageDeleteDispatchData, GatewayMessageReactionAddDispatchData, GatewayMessageReactionRemoveDispatchData, GatewayMessageUpdateDispatchData, GatewayReadyDispatchData, GatewayVoiceStateUpdateDispatchData, GatewayGuildMembersChunkDispatchData, GatewayReceivePayload, GatewayIdentifyData, GatewayResumeData, GatewayPresenceUpdateData, GatewayActivityUpdateData, GatewayRequestGuildMembersData } from 'discord-api-types/v10'
import { GatewayDispatchEvents, ComponentType, ButtonStyle, MessageType, GatewayOpcodes, MessageFlags, ActivityType, PresenceUpdateStatus, GatewayCloseCodes } from 'discord-api-types/v10'
import { usersCollection, guildconfigs } from './Database';
import punishUser from './punishUser';
import { type Document, type WithId } from 'mongodb';
import { response } from './rest'
interface op {
    op: GatewayOpcodes,
    d: GatewayIdentifyData | number | GatewayResumeData | GatewayActivityUpdateData | GatewayPresenceUpdateData | GatewayRequestGuildMembersData
}
class MyGateway extends EventEmitter {
    public ws!: WebSocket | null;
    private seq: number = 0;
    public sessId: string | undefined = '';
    public resumeUrl: string = '';
    private interval: Timer | undefined = undefined;
    private statusInterval: Timer | undefined = undefined;
    private ack: boolean = false;
    private readonly startedAt: number = Date.now();
    constructor() { super(); this.connect(); }
    private connect() {
        if (this.ws) { this.ws = null }
        this.ws = new WebSocket(this.sessId ? `${this.resumeUrl}/?v=10&encoding=json` : 'wss://gateway.discord.gg/?v=10&encoding=json');
        this.ws.onmessage = ({ data }) => { this.packet(JSON.parse(data.toString())); };
        this.ws.onclose = (event) => {
            clearInterval(this.interval);
            if (this.statusInterval) clearInterval(this.statusInterval);
            const badconfig = [GatewayCloseCodes.AuthenticationFailed, GatewayCloseCodes.InvalidShard, GatewayCloseCodes.ShardingRequired, GatewayCloseCodes.InvalidAPIVersion, GatewayCloseCodes.InvalidIntents, GatewayCloseCodes.DisallowedIntents]
            if ([GatewayCloseCodes.InvalidSeq, GatewayCloseCodes.SessionTimedOut].includes(event.code)) { this.sessId = ''; this.seq = 0; }
            if (badconfig.includes(event.code)) return console.error(`Fatal Error (${event.code}).`), process.exit(1);
            setTimeout(() => this.connect(), 5000);
        };
        this.ws.onerror = (err: Event) => console.error(`[WS Error]: ${JSON.stringify(err)}\n`);
    }
    private packet(pkg: GatewayReceivePayload) {
        const { op, d, s, t } = pkg;
        if (s !== null) this.seq = s;
        switch (op) {
            case GatewayOpcodes.Hello:
                if (this.interval) clearInterval(this.interval);
                this.ack = true
                this.interval = setInterval(() => {
                    if (!this.ack) { console.log('[Gateway] Heartbeat ACK missed. Zombied connection. \n'); return this.ws!.close(4000); }
                    this.ack = false;
                    this.op({ op: GatewayOpcodes.Heartbeat, d: this.seq });
                }, d.heartbeat_interval);
                if (this.sessId) { this.op({ op: GatewayOpcodes.Resume, d: { token: `${Bun.env.token}`, session_id: this.sessId, seq: this.seq } }) }
                else
                    this.op({
                        op: GatewayOpcodes.Identify, d: { token: Bun.env.TOKEN!, intents: 34494, properties: { os: 'windows', browser: 'bun', device: 'bot' }, activities: [{ name: `for 0d 0h 0m 0s`, type: ActivityType.Watching, }] }
                    })
                break;
            case GatewayOpcodes.HeartbeatAck:
                this.ack = true;
                break;
            case GatewayOpcodes.Heartbeat:
                this.op({ op: GatewayOpcodes.Heartbeat, d: this.seq });
                break;
            case GatewayOpcodes.Reconnect:
                this.ws?.close(4000);
                break;
            case GatewayOpcodes.InvalidSession:
                console.log(`[Gateway] Invalid Session. Resumable: ${d}`);
                if (!d) { this.sessId = ''; this.seq = 0; }
                this.ws?.close(4000);
                break;
            case GatewayOpcodes.Dispatch:
                this.emit(t, d);
                break;
        }
    }
    public startStatusLoop() {
        if (this.statusInterval) clearInterval(this.statusInterval);
        const uptimeMs = Date.now() - this.startedAt;
        this.op({
            op: GatewayOpcodes.PresenceUpdate,
            d: {
                since: null,
                activities: [{
                    name: `for ${Math.floor(uptimeMs / (86400000))}d ${Math.floor((uptimeMs / (3600000)) % 24)}h ${Math.floor((uptimeMs / (60000)) % 60)}m ${Math.floor((uptimeMs / 1000) % 60)}s`,
                    type: ActivityType.Watching,
                }],
                status: PresenceUpdateStatus.Online,
                afk: false
            }
        })
        this.statusInterval = setInterval(() => {
            const uptimeMs = Date.now() - this.startedAt;
            this.op({
                op: GatewayOpcodes.PresenceUpdate,
                d: {
                    since: null,
                    activities: [{
                        name: `for ${Math.floor(uptimeMs / (86400000))}d ${Math.floor((uptimeMs / (3600000)) % 24)}h ${Math.floor((uptimeMs / (60000)) % 60)}m ${Math.floor((uptimeMs / 1000) % 60)}s`,
                        type: ActivityType.Watching,
                    }],
                    status: PresenceUpdateStatus.Online,
                    afk: false
                }
            })
        }, 5000);
    }
    public op({ op, d }: op) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op, d })); }
}
const messageCache = new LRUCache({ max: 250, ttl: 20 * 60 * 1000, updateAgeOnGet: false, ttlAutopurge: true });
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
let massban = 0;
function getComparableEmbed(embedData: APIEmbed) {
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
async function inactiveusers() {
    const list = await usersCollection.find({ level: 1, totalmessages: 0, guildId: '1231453115937587270' }, { projection: { userId: 1, _id: 0 } }).toArray()
    const userIds: string[] = list.map(doc => doc.userId);
    client.op({ op: GatewayOpcodes.RequestGuildMembers, d: { guild_id: '1231453115937587270', user_ids: userIds } })
}
const client = new MyGateway()
client.on(GatewayDispatchEvents.Ready, async (ready: GatewayReadyDispatchData) => {
    client.sessId = ready.session_id;
    client.resumeUrl = ready.resume_gateway_url;
    console.log(`[Gateway] Ready! Session ID: ${client.sessId}`);
    client.startStatusLoop();
    await usersCollection.updateMany(
        { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
        { $set: { "punishments.$[elem].active": 0 } },
        { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
    );
    Bun.cron("* * * * 0", async () => { await inactiveusers() })
    const guildIds = ready.guilds.map((guild) => (guild.id))
    for (const guildId of guildIds) {
        const guild = await response({ method: "GET", endpoint: `guilds/${guildId}` }) as any;
        await guildconfigs.updateOne({ guildId: guildId }, { $set: { icon: guild.icon, name: guild.name } })
        const guildinvites = await response({ method: "GET", endpoint: `guilds/${guildId}/invites` });
        const invites = guildinvites.map((invite: any) => { return { code: invite.code, uses: invite.uses } })
        await guildconfigs.findOneAndUpdate({ guildId: guildId }, { $set: { Invites: invites } }, { upsert: true })
        const { Data, messageConfigs } = await guildconfigs.findOne({ guildId: guildId }, { projection: { Data: 1, messageConfigs: 1 } }) as Document;
        let data = Data
        for (const [embedName, config] of Object.entries(messageConfigs as Document)) {
            const { channelid, embeds, components, reactions } = config;
            try {
                const existingdata = Data.find((m: any) => m.name === embedName) as { name: string, messageId: string };
                const message = await response({ method: "GET", endpoint: `channels/${channelid}/messages/${existingdata.messageId}` }) as any;
                const different = message.embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||') !== embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||')
                if (different) { await response({ method: "PATCH", endpoint: `channels/${channelid}/messages/${message.id}`, body: { embeds: embeds, ...components } }) }
            } catch {
                const msg = await response({ method: "POST", endpoint: `channels/${channelid}/messages`, body: { embeds: embeds, components: components } }) as any
                data = Data.filter((message: any) => message.name !== embedName);
                if (reactions)
                    for (const reaction of reactions) {
                        await response({ method: "PUT", endpoint: `channels/${channelid}/messages/${msg.id}/reactions/${reaction}/@me` });
                        await Bun.sleep(750)
                    }
                console.log(`📝 Sent '${embedName}'. Message ID: ${msg.id} \n`);
                data.push({ name: embedName, messageId: msg.id })
                await guildconfigs.updateOne({ guildId: guildId }, { $set: { Data: data } })
            }
        }
    }
})
client.on(GatewayDispatchEvents.GuildMembersChunk, async (data: GatewayGuildMembersChunkDispatchData) => {
    const userlist = data.members.filter(member => member.roles.length == 0).map(member => member.user.id)
    for (const userId of userlist)
        try { await response({ method: "DELETE", endpoint: `guilds/'${data.guild_id}'/members/${userId}` }) } catch { console.log(`User ${userId} has already left the guild`) }
    await usersCollection.deleteMany({ guildId: data.guild_id, userId: { $in: userlist } })
})
client.on(GatewayDispatchEvents.AutoModerationActionExecution, async (action: GatewayAutoModerationActionExecutionDispatchData) => {
    const { guild_id, user_id, channel_id, rule_id } = action
    const { level, punishments, } = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { xp: 1, level: 1, punishments: 1 } }) as Document;
    const { reasonsandweights } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { reasonsandweights: 1 } }) as Document
    let totalWeight = reasonsandweights[rule_id].Weight;
    let reason = `AutoMod: ${reasonsandweights[rule_id].reason}`
    if (level < 3) { totalWeight += 2; reason += ' while new to the server.'; }
    const bannable = level < 3 && (totalWeight >= 3 || punishments.length > 2);
    await punishUser({ guildId: guild_id, target: user_id, moderatorUser: { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc', discriminator: '0000', global_name: null }, reason: reason, channelId: channel_id!, currentWarnWeight: !bannable ? totalWeight : 1, banflag: bannable });
})
client.on(GatewayDispatchEvents.GuildMemberAdd, async (member: GatewayGuildMemberAddDispatchData) => {
    const { guild_id, user } = member;
    const { modChannels, staffroles, jrrole, publicChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, staffroles: 1, jrrole: 1, publicChannels: 1 } }) as Document
    const avatarURL: string = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
    const currentInvites = await response({ method: "GET", endpoint: `guilds/${guild_id}/invites` })
    const { Invites } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Invites: 1 } }) as Document;
    const guildInvitesmap = new Map<string, number>(Invites.map((i: any) => [i.code, i.uses]));
    const invite = currentInvites.find((i: any) => i.uses > (guildInvitesmap.get(i.code) || 0));
    const inviter = await response({ method: "GET", endpoint: `guilds/${guild_id}/members/${invite.inviter!.id}` }) ?? null;
    await guildconfigs.updateOne({ guildId: guild_id }, { $set: { Invites: currentInvites.map((i: any) => ({ code: i.code, uses: i.uses })) } }, { upsert: true })
    const createdTimestamp = ((BigInt(member.user.id) >> 22n) + 1420070400000n) / 1000n;
    const welcomeEmbed: APIEmbed = {
        color: 0x00FF99,
        description: `<@${user.id}> joined the Server!`,
        thumbnail: { url: avatarURL },
        fields: [{ name: 'Discord Join Date:', value: `<t:${createdTimestamp}>`, inline: true }],
        timestamp: new Date().toISOString(),
        footer: invite ? { text: `Invited by: ${inviter!.user.username} | ${invite.code}`, icon_url: `https://cdn.discordapp.com/avatars/${inviter!.user.id}/${inviter!.user.avatar}.png` } : undefined
    }
    const originalMessage = await response({
        method: "POST",
        endpoint: `channels/${modChannels.welcomeChannel}/messages`, body: {
            embeds: [welcomeEmbed],
            components: [{
                type: ComponentType.ActionRow,
                components: [{
                    type: ComponentType.Button,
                    custom_id: `ban_${user.id}_${invite && inviter && !inviter.roles.some((role: string) => staffroles.includes(role)) && !inviter.roles.includes(jrrole) ? invite.code : 'none'}`,
                    label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}`,
                    style: ButtonStyle.Danger
                }]
            }]
        }
    }) as APIMessage;
    if (Date.now() - Number(createdTimestamp) < 172800000) {
        await response({ method: "DELETE", endpoint: `guilds/${guild_id}/members/${user.id}` })
        await response({
            method: "POST",
            endpoint: `channels/${modChannels.mutelogChannel}/messages`,
            body:
                {
                    embeds: [{
                        title: 'A member was auto-kicked', thumbnail: { url: avatarURL },
                        fields: [
                            { name: `**User:**`, value: `<@${user.id}>` },
                            { name: '**Reason:**', value: `New Account\n** Created:** <t: ${Math.floor(Number(createdTimestamp) / 1000)}: R > ` },
                            { name: '**Created on:**', value: `<t:${Math.floor(Number(createdTimestamp) / 1000)}:R>` }
                        ]
                    }]
                } as APIMessage
        })
        return;
    }
    if (!user.bot) {
        const dmChannel = await response({ method: "POST", endpoint: `users/@me/channels`, body: { recipient_id: user.id } });
        await response({
            method: "POST",
            endpoint: `channels/${dmChannel.id}/messages`, body: {
                embeds: [{
                    description: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.  Click on the invite: https://discord.gg/qMjjyXyYbr for the bot's key incase he cannot dm you.`,
                }],
                components: []
            }
        }) as APIMessage
        const persistentdata: WithId<Document> | null = await usersCollection.findOne({ userId: user.id, guildId: guild_id })
        if (!persistentdata) {
            await usersCollection.insertOne({ userId: user.id, guildId: guild_id, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], joinedTime: Date.now(), blacklist: [], avatar: member.user.avatar, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [], nick: member.user.username, lastmessage: null })
        } else {
            if (guild_id == "1231453115937587270")
                await response({ method: "PUT", endpoint: `guilds/${guild_id}/members/${member!.user.id}/roles/1463354464747524136` });
            await response({ method: "POST", endpoint: `channels/${publicChannels.generalChannel}/messages`, body: { embeds: [{ description: `Everyone, Welcome <@${member?.user.id}> back to the server!\n\n`, thumbnail: { url: `https://cdn.discordapp.com/avatars/${member!.user.id}/${member!.user.avatar}.png` }, fields: [{ name: 'Discord Join Date:', value: `<t:${Number(((BigInt(member!.user.id) >> 22n) + 1420070400000n) / 1000n)}>`, inline: true }] }] } as APIMessage });
        }
        setTimeout(async () => {
            await response({
                method: "PATCH",
                endpoint: `channels/${originalMessage.channel_id}/messages/${originalMessage.id}`, body: {
                    embeds: [welcomeEmbed],
                    components: [{
                        type: 1, components: [{
                            type: ComponentType.Button,
                            custom_id: `ban_${user.id}_${invite && inviter && !inviter.roles.some((role: string) => staffroles.includes(role)) && !inviter.roles.includes(jrrole) ? invite.code : 'none'}`,
                            label: invite && inviter && !inviter.roles.some((role: string) => staffroles.includes(role)) && !inviter.roles.includes(jrrole) ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                            style: ButtonStyle.Danger,
                            disabled: true
                        }],
                    }],
                } as APIMessage
            })
        }, 15 * 60 * 1000)
    }
})
client.on(GatewayDispatchEvents.GuildMemberRemove, async (member: GatewayGuildMemberRemoveDispatchData) => {
    const { user, guild_id } = member;
    if (user.bot) { return }
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const { joinedTime } = await usersCollection.findOne({ userId: user.id, guildId: guild_id }, { projection: { joinedTime: 1 } }) as Document;
    await response({
        method: "POST",
        endpoint: `channels/${modChannels.welcomeChannel}/messages`, body: {
            embeds: [{ description: `<@${user.id}> left the server.`, thumbnail: { url: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png` }, fields: [{ name: 'Server Join Date:', value: `<t:${Math.floor(joinedTime / 1000)}>`, inline: true }] }]
        }
    })
})
client.on(GatewayDispatchEvents.GuildMemberUpdate, async (member: GatewayGuildMemberUpdateDispatchData) => {
    const { guild_id, user, nick } = member;
    const oldMember = await usersCollection.findOne({ guildId: guild_id, userId: user.id }) as Document;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    await usersCollection.updateOne({ guildId: guild_id, userId: user.id }, { $set: { nick: nick ? nick : user.username } });
    if (!oldMember || nick === oldMember.nick || member.user.username == oldMember.nick) return;
    await response({
        method: "POST",
        endpoint: `channels/${modChannels.namelogChannel}/messages`, body: {
            embeds: [{
                thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
                color: 0x4e85b6,
                description: `<@${user.id}> **changed their nickname**\n\n` +
                    `**Before:**\n${oldMember?.nick}\n\n` +
                    `**After:**\n${nick ?? user.username}`,
                timestamp: new Date().toISOString()
            }]
        }
    })
})
client.on(GatewayDispatchEvents.GuildBanAdd, async (ban: GatewayGuildBanAddDispatchData) => {
    const { user, guild_id } = ban;
    const { Ban } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Ban: 1 } }) as Document
    if (Ban === user.id) { await guildconfigs.updateOne({ guildId: guild_id }, { $set: { ban: '' } }); return; }
    else {
        massban += 1;
        const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
        const auditLog = await response({ method: "GET", endpoint: `guilds/${guild_id}/audit-logs?limit=1&user_id=${user.id}&action_type=22` });
        const executorId = auditLog.audit_log_entries[0]?.user_id ?? null;
        const reason = auditLog.audit_log_entries[0]?.reason ?? null;
        const guild = await response({ method: "GET", endpoint: `guilds/${guild_id}` });
        const logEmbed: APIEmbed = {
            color: 0xd10000,
            author: { name: `${user.username}`, icon_url: user.avatar ?? undefined },
            thumbnail: { url: `https://cdn.discordapp.com/icons/${guild_id}/${guild.icon}.png` },
            description: `<@${user.id}>, ${`you were banned from [${guild.name}](https://discord.com/channels/${guild_id}).\n\n\nTo appeal this decision, please join our dedicated appeal server using the button below.`}`,
            fields: [{ name: 'Reason:', value: `\`${reason}\``, inline: false }],
            timestamp: new Date().toISOString(),
            footer: { text: 'User DMed ✅' }
        }
        await Bun.sleep(massban * 1000)
        const dmchannel = await response({ method: "POST", endpoint: `users/@me/channels`, body: { recipient_id: user.id } });
        if (!dmchannel) logEmbed.footer = { text: 'User DMed 🚫' }
        else
            await response({
                method: "POST",
                endpoint: `channels/${dmchannel.id}/messages`, body: {
                    embeds: [logEmbed],
                    components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }]
                }
            })
        await response({
            method: "POST",
            endpoint: `channels/${modChannels.banlogChannel}/messages`, body: {
                embeds:
                    [{
                        color: 0xff3030,
                        title: 'Mass Ban Detected',
                        thumbnail: { url: `https://cdn.discordapp.com/users/${user.id}/${user.avatar}.png` },
                        description: `**Moderator <@${executorId}> banned <@${user.id}>:**`,
                        fields: [{ name: '`ID:', value: `<@${user.id}>`, inline: true },
                        { name: `**TAG:**`, value: `${user.username}`, inline: true },
                        { name: `**Reason:**`, value: `\`${reason}\`` }
                        ],
                        timestamp: new Date().toISOString()
                    }] as APIEmbed[]
            }
        });
        massban -= 1;
    }
})
client.on(GatewayDispatchEvents.GuildBanRemove, async (ban: GatewayGuildBanRemoveDispatchData) => {
    const { user, guild_id } = ban
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const { bans } = (await usersCollection.findOne({ userId: user.id, guildId: guild_id }, { projection: { punishments: 1 } }) as Document).filter((ban: any) => ban.type == 'Ban').sort((a: any, b: any) => b.timestamp - a.timestamp)
    await response({
        method: "POST",
        endpoint: `https://discord.com/api/v10/channels/${modChannels.banlogChannel}/messages`, body: {
            embeds: [{
                color: 0x309eff,
                title: 'A member was unbanned',
                thumbnail: { url: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${BigInt(user.id) % 5n}.png` },
                fields: [
                    { name: '**User**', value: `<@${user.id}>` },
                    { name: '**Tag**', value: `\`${user.username}\`` },
                    { name: '**Reason**:', value: ` \`${bans[0].reason}\`` }
                ],
                timestamp: new Date().toISOString()
            }]
        } as APIMessage
    })

})
client.on(GatewayDispatchEvents.InviteCreate, async (invite: GatewayInviteCreateDispatchData) => {
    await guildconfigs.findOneAndUpdate({ guildId: invite.guild_id }, { $addToSet: { Invites: { code: invite.code, uses: invite.uses } } });
})
client.on(GatewayDispatchEvents.InviteDelete, async (invite: GatewayInviteDeleteDispatchData) => {
    await guildconfigs.findOneAndUpdate({ guildId: invite.guild_id }, { $pull: { Invites: { code: invite.code } } as any })
})
client.on(GatewayDispatchEvents.MessageReactionAdd, async (reaction: GatewayMessageReactionAddDispatchData) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const { reactions, Data } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { reactions: 1, Data: 1 } }) as Document
    if (!Data || !Data.some((info: { name: string, messageId: string }) => info.messageId === message_id)) return;
    const roleID = reactions[emoji.id! || emoji.name!];
    if (!roleID) return;
    const { blacklist } = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { blacklist: 1 } }) as WithId<Document>;
    if (blacklist && blacklist.length > 0 && blacklist.includes(roleID)) return;
    if (Array.isArray((roleID)))
        await Promise.all(roleID.map(role => response({ method: "PUT", endpoint: `guilds/${guild_id}/members/${user_id}/roles/${role}` })));
    else
        await response({ method: "PUT", endpoint: `guilds/${guild_id}/members/${user_id}/roles/${roleID}` });
})
client.on(GatewayDispatchEvents.MessageReactionRemove, async (reaction: GatewayMessageReactionRemoveDispatchData) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const { Data, reactions } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Data: 1, reactions: 1 } }) as WithId<Document>;
    if (!Data || !Data.some((info: { name: string, messageId: string }) => info.messageId === message_id)) return;
    const roleID = reactions[emoji.id! || emoji.name!];
    if (!roleID) return;
    if (Array.isArray(roleID))
        await Promise.all(roleID.map(role => response({ method: "DELETE", endpoint: `guilds/${guild_id}/members/${user_id}/roles/${role}` })));
    else
        await response({ method: "DELETE", endpoint: `guilds/${guild_id}/members/${user_id}/roles/${roleID}` });
})
client.on(GatewayDispatchEvents.MessageDelete, async (deletedData: GatewayMessageDeleteDispatchData) => {
    const { id, channel_id, guild_id } = deletedData;
    const message = messageCache.get(id) as APIMessage;
    if (!message) return;
    const { author, content, attachments } = message;
    const imageAttachments = attachments.map((att) => att.proxy_url);
    const additionalEmbeds = imageAttachments.slice(1, imageAttachments.length).map(url => ({ url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`, image: { url: url } }));
    const mainEmbed: APIEmbed = {
        color: 0xf03030,
        description: `Message by <@${author.id}> was deleted in <#${channel_id}>\n\n${content || ''}\n\n[Event Link](${`https://discord.com/channels/${guild_id}/${channel_id}/messages/${id}`})\n\n`,
        url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`,
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
        footer: { text: `ID: ${id}` },
        timestamp: new Date().toISOString(),
        image: imageAttachments[0] ? { url: imageAttachments[0] } : undefined
    }
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    await response({ method: "POST", endpoint: `channels/${modChannels.deletedlogChannel}/messages`, body: { embeds: [mainEmbed, ...additionalEmbeds] } })
})
client.on(GatewayDispatchEvents.MessageUpdate, async (newMessage: GatewayMessageUpdateDispatchData) => {
    const oldMessage = messageCache.get(newMessage.id) as APIMessage;
    if (!oldMessage || oldMessage.content == newMessage.content) return;
    const { modChannels } = await guildconfigs.findOne({ guildId: newMessage.guild_id }, { projection: { modChannels: 1 } }) as Document
    await response({
        method: "POST",
        endpoint: `channels/${modChannels.updatedlogChannel}/messages`, body: {
            embeds: [{
                description: `<@${oldMessage.author.id}> edited a message in <#${newMessage.channel_id}>\n\n **Before:**\n${oldMessage.content || ''}\n\n **After:**\n${newMessage.content || ''}\n\n[Jump to Message](https://discordapp.com/channels/${newMessage.guild_id}/${newMessage.channel_id}/messages/${newMessage.id})`,
                color: 0x309eff,
                thumbnail: { url: `https://cdn.discordapp.com/avatars/${oldMessage.author.id}/${oldMessage.author.avatar}.png` },
                footer: { text: `ID: ${newMessage.id}` },
                timestamp: new Date().toISOString()
            }]
        } as APIMessage
    })
    oldMessage.content = newMessage.content
    messageCache.set(newMessage.id, oldMessage);
})
client.on(GatewayDispatchEvents.MessageCreate, async (message: GatewayMessageCreateDispatchData) => {
    const { id, mention_everyone, guild_id, author, member, content, channel_id, attachments, flags, type } = message;
    if (author.bot == true || !guild_id || type == MessageType.ChatInputCommand || type == MessageType.UserJoin) return;
    const { publicChannels, responses, staffroles, jrrole, generalchannels, automodsettings: { messagethreshold, Duplicatespamthreshold, mediathreshold, spamthreshold, capsthreshold }, count, lastuser, baseMultiplier, exponent, flatOffset, roundToNearest } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { publicChannels: 1, responses: 1, staffroles: 1, jrrole: 1, mediaexclusions: 1, automodsettings: 1, count: 1, lastuser: 1, baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1, generalchannels: 1 } }) as Document
    if (channel_id == publicChannels.countingChannel) {
        if (!/^\d+$/.test(content)) return;
        await guildconfigs.findOneAndUpdate({ guildId: guild_id }, (count + 1 == parseInt(content) && lastuser !== author.id) ? { $inc: { count: 1 }, $set: { lastuser: author.id } } : { $set: { count: 0, lastuser: null } })
        return (count + 1 == parseInt(content) && lastuser !== author.id) ? await response({ method: "PUT", endpoint: `channels/${channel_id}/messages/${id}/reactions/%E2%9C%85/@me` }) : await response({ method: "POST", endpoint: `channels/${channel_id}/messages`, body: { content: `<@${author.id}> missed or already counted!`, message_reference: { message_id: id } } as APIMessage })
    }
    let messageWords: string = '!';
    const isstaff = member?.roles.some((roleId: string) => staffroles.includes(roleId)) || member?.roles.includes(jrrole) || author.id === "521404063934447616"
    const linkcheck = /https?:\/\/[^\s]+/i.test(content)
    console.log(content)
    const hasMedia = (attachments.length > 0 || linkcheck) && flags != MessageFlags.IsVoiceMessage && generalchannels.includes(channel_id)
    if (content.length >= 1 && !linkcheck) {
        messageWords = content.replace(/<a?:\w+:\d+>|[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '');
        const lowerwords = messageWords.toLowerCase()
        const reactionsToApply = [];
        for (const [trigger, text] of Object.entries(responses))
            if (lowerwords.includes(trigger))
                await response({ method: "POST", endpoint: `channels/${channel_id}/messages`, body: { content: text, message_reference: { message_id: id } } })
        if (lowerwords.includes('bad') && lowerwords.includes('bot'))
            reactionsToApply.push('😡')
        if (lowerwords.includes('857445139416088647'))
            reactionsToApply.push(encodeURIComponent('SaltyEyes:1257522749635563561'))
        if (lowerwords.includes('gay'))
            reactionsToApply.push('🏳️‍🌈')
        for (const emoji of reactionsToApply) {
            await response({ method: "PUT", endpoint: `channels/${channel_id}/messages/${id}/reactions/${emoji}/@me` });
        }
    }
    const { total, mediaCount, timestamps, duplicateCounts } = await usersCollection.findOne({ userId: author.id, guildId: guild_id }, { projection: { total: 1, mediaCount: 1, timestamps: 1, duplicateCounts: 1 } }) as Document;
    const caps: RegExpMatchArray | null = messageWords.length > 20 ? messageWords.match(/[A-Z]/g) : null;
    const activemarks: Record<string, boolean> = {
        everyonePing: mention_everyone,
        duplicateSpam: duplicateCounts[messageWords] + 1 >= Duplicatespamthreshold,
        mediaViolation: mediaCount + 1 > mediathreshold && (total ?? 0) + 1 < messagethreshold,
        generalspam: timestamps.filter((stamp: string) => Date.now() - parseInt(stamp) < 8000).length + 1 > spamthreshold,
        capSpam: ((caps?.length ?? 0) / messageWords.length) > capsthreshold
    };
    const { xp, level } = await usersCollection.findOneAndUpdate(
        { userId: author.id, guildId: guild_id },
        [
            {
                $set: {
                    previoustime: { $ifNull: ["$lastmessage", 0] },
                    isModReset: {
                        $or: [activemarks.duplicateSpam || activemarks.mediaViolation, { $gte: [{ $subtract: [Date.now(), { $ifNull: ["$lastmessage", 0] }] }, 1800000] }]
                    }
                }
            },
            {
                $set: {
                    xp: { $add: ["$xp", 20] },
                    totalmessages: { $add: ["$totalmessages", 1] },
                    avatar: author.avatar,
                    total: { $cond: ["$isModReset", 0, { $cond: [{ $gte: [{ $add: ["$total", 1] }, messagethreshold] }, 0, { $add: ["$total", 1] }] }] },
                    mediaCount: { $cond: ["$isModReset", 0, { $cond: [{ $gte: [{ $add: ["$total", 1] }, messagethreshold] }, 0, { $add: ["$mediaCount", hasMedia ? 1 : 0] }] }] },
                    duplicateCounts: {
                        $cond: ["$isModReset", {}, { $cond: [{ $gte: [{ $add: ["$total", 1] }, messagethreshold] }, {}, { $mergeObjects: ["$duplicateCounts", { [messageWords]: { $add: [{ $ifNull: [`$duplicateCounts.${messageWords}`, 0] }, 1] } }] }] }]
                    },
                    timestamps: { $slice: [{ $concatArrays: ["$timestamps", [Date.now().toString()]] }, -15] },
                    lastmessage: Date.now()
                }
            },
            {
                $unset: "isModReset"
            }
        ], { upsert: true, returnDocument: 'after', projection: { xp: 1, level: 1 } }) as WithId<Document>
    const isNewUser = Date.now() - Date.parse(member?.joined_at!) < 2 * 24 * 60 * 60 * 1000 && level < 3
    if (level < 100 && xp >= (Math.round((level ** exponent * baseMultiplier + flatOffset) / roundToNearest))) {
        const rank = await usersCollection.countDocuments({ guildId: guild_id, $or: [{ level: { $gt: level ? level + 1 : 2 } }, { level: level ? level + 1 : 2, xp: { $gt: xp } }] });
        await response({
            method: "POST",
            endpoint: `channels/${channel_id}/messages`,
            body: {
                embeds: [{
                    author: { name: `${author.username} you reached level ${parseInt(level) + 1}!`, icon_url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
                    color: 0x00AE86,
                    footer: { text: `You are now #${rank + 1} in the server!` }
                }]
            }
        })
        if (parseInt(level) + 1 > 2 && !member?.roles.includes("1334238580914131026") && guild_id == "1231453115937587270")
            await response({ method: "PUT", endpoint: `guilds/${guild_id}/members/${author.id}/roles/1334238580914131026` })
        await usersCollection.findOneAndUpdate({ userId: author.id, guildId: guild_id }, { $inc: { level: 1 }, $set: { xp: 0 } });
    }
    messageCache.set(id, { author: { id: author.id, username: author.username, avatar: author.avatar }, content: content, attachments: attachments.map(a => ({ filename: a.filename, proxy_url: a.proxy_url })) });
    if (isstaff) return;
    if (mention_everyone) await response({ method: "DELETE", endpoint: `channels/${channel_id}/messages/${id}` })
    const activeChecks = Object.keys(reasonsandweights).filter((key: string) => activemarks[key]).map(key => ({ ...reasonsandweights[key] })) as Array<{ reason: string, Weight: number }>;
    let totalWeight = activeChecks.reduce((acc, check) => { return acc + check.Weight }, 0) as number;
    if (totalWeight == 0) return;
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const bannable = isNewUser && (totalWeight >= 3 || mention_everyone)
    await punishUser({ guildId: guild_id, target: author.id, moderatorUser: { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc', discriminator: '#0000', global_name: null }, reason: reasonText, channelId: channel_id, isAutomated: true, currentWarnWeight: !bannable ? totalWeight : 1, banflag: bannable })
});
client.on(GatewayDispatchEvents.VoiceStateUpdate, async (event: GatewayVoiceStateUpdateDispatchData) => {
    const { guild_id, channel_id, user_id, member } = event;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const { vcchannel } = await usersCollection.findOneAndUpdate({ userId: user_id, guildId: guild_id }, { $set: { vcchannel: channel_id } }, { returnDocument: 'before' }) as Document;
    if (vcchannel === channel_id) return;
    await response({
        method: "POST",
        endpoint: `channels/${modChannels.voicelogChannel}/messages`, body: {
            embeds: [{
                author: { name: member?.user.username, icon_url: `https://cdn.discordapp.com/avatars/${user_id}/${member?.user.avatar}.png` },
                description: channel_id !== null ? `<@${user_id}> joined <#${channel_id}>.` : `<@${user_id}> left <#${vcchannel}>`,
                color: channel_id !== null ? 0x305830 : 0x8b0000,
                timestamp: new Date().toISOString()
            }]
        }
    })
})
client.on(GatewayDispatchEvents.Resumed, async () => { client.startStatusLoop() })
