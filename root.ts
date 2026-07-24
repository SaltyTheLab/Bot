import { usersCollection, guildconfigs, ws } from './Database';
import { ObjectId, type Document, type WithId } from 'mongodb';
import { appendFile } from 'node:fs/promises'
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ComponentType, ButtonStyle, MessageType, ActivityType, PresenceUpdateStatus, AuditLogEvent, Client, Collection, DiscordAPIError, Options, Role, Routes, type APIChannel, type APIEmbed, type APIMessage, Partials, GatewayIntentBits, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js'
import { createHash } from 'crypto'
export const client = new Client({
    intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildModeration | GatewayIntentBits.GuildExpressions | GatewayIntentBits.GuildIntegrations | GatewayIntentBits.GuildWebhooks | GatewayIntentBits.GuildVoiceStates | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildMessageReactions | GatewayIntentBits.MessageContent,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    presence: { activities: [{ name: `for 0d 0h 0m 0s`, type: ActivityType.Watching, }], status: 'online', afk: false },
    makeCache: Options.cacheWithLimits({ MessageManager: { maxSize: 30 }, ...Options.DefaultMakeCacheSettings }),
    sweepers: { ...Options.DefaultSweeperSettings, messages: { interval: 900, lifetime: 360 } }
})
interface xp { Id: string; source: 'discord' | 'twitch'; channel?: string; roles?: Collection<string, Role>, guildId?: string }
process.on("uncaughtException", async (err) => {
    const intpid = parseInt(await Bun.file("./interpid.txt").text())
    await appendFile("./log.log", `[root] Uncaught exception @ ${Date.now()}: ${JSON.stringify(err.stack ?? err)}\n`)
    Bun.spawn(["powershell", "-ExecutionPolicy", "Bypass", "-File", "C:\\Users\\micha\\Desktop\\Bot\\restart.ps1", "-BotPid", `${process.pid}`, "-intpid", `${intpid}`], { stderr: "pipe", stdout: 'pipe', stdin: 'pipe' })
})
process.on("unhandledRejection", (reason) => { appendFile("./log.log", `[root] unhandled Rejection: ${JSON.stringify(reason)}\n`) });
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
const startedAt = Date.now();
const authProvider = new RefreshingAuthProvider({ clientId: Bun.env.TWITCH_ID!, clientSecret: Bun.env.TWITCH_SECRET! });
const doc = await ws.findOne({}, { projection: { twitchbot: 1, twitchaccess: 1, twitchrefresh: 1, twitchexpires: 1, twitchobtained: 1 } }) as any;
if (!doc?.twitchbot) throw new Error('No Twitch bot tokens found — run get-token.ts first.');
authProvider.addUser(doc.twitchbot, { accessToken: doc.twitchaccess, scope: ['chat:read', 'chat:edit'], refreshToken: doc.twitchrefresh, expiresIn: doc.twitchexpires, obtainmentTimestamp: doc.twitchobtained, }, ['chat']);
authProvider.onRefresh(async (userId, newTokenData) => {
    await ws.updateOne({}, { $set: { twitchaccess: newTokenData.accessToken, twitchrefresh: newTokenData.refreshToken, twitchexpires: newTokenData.expiresIn, twitchobtained: Date.now(), } });
});
const TwitchClient = new ChatClient({ authProvider, channels: ['saltytbsl'] });
TwitchClient.connect();
TwitchClient.onAuthenticationSuccess(() => { appendFile("./log.log", "Febot is listening on twitch!\n") })
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
function keyify(text: string): string {
    return createHash('md5').update(text).digest('hex')
}
async function inactiveusers() {
    const list = await usersCollection.find({ level: 1, totalmessages: 0, guildId: '1231453115937587270' }, { projection: { userId: 1, _id: 0 } }).toArray()
    const userIds: string[] = list.map(doc => doc.userId);
    const guild = client.guilds.cache.get('1231453115937587270');
    if (!guild) return;
    const members = await guild.members.fetch({ user: userIds });
    const userlist = members.filter(member => member.roles.cache.size == 0);
    for (const member of userlist.values()) {
        try {
            await client.rest.delete(Routes.guildMember(guild.id, member.id));
        } catch {
            await appendFile("./log.log", `User ${member.id} has already left the guild\n`);
        }
    }
    await usersCollection.deleteMany({ guildId: guild.id, userId: { $in: [...userlist.keys()] } });
}
async function grantXp({ Id, source, channel, roles, guildId = '1231453115937587270' }: xp) {
    if (guildId != '1231453115937587270')
        return;

    const { baseMultiplier, exponent, flatOffset, roundToNearest } = await guildconfigs.findOne({ guildId: '1231453115937587270' }, { projection: { baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1 } }
    ) as any;

    const { xp, level, avatar, nick } = await usersCollection.findOneAndUpdate(
        source == 'discord' ? { userId: Id, guildId: '1231453115937587270' } : { twitchId: Id }, { $inc: { xp: 20 } }, { returnDocument: 'after', projection: { xp: 1, level: 1, avatar: 1, nick: 1, } }) as any;

    if (level < 100 && xp >= Math.round((level ** exponent * baseMultiplier + flatOffset) / roundToNearest)) {
        await usersCollection.updateOne({ userId: Id, guildId: '1231453115937587270' }, { $inc: { level: 1 }, $set: { xp: 0 } });
        const rank = await usersCollection.countDocuments({ guildId: '1231453115937587270', $or: [{ level: { $gt: level + 1 } }, { level: level + 1, xp: { $gt: xp } }] });
        if (source == 'discord') {
            if (parseInt(level) + 1 > 2 && !roles!.has("1334238580914131026") && guildId == '1231453115937587270')
                await client.rest.put(Routes.guildMemberRole(guildId, Id, '1334238580914131026'))
            client.rest.post(Routes.channelMessages(channel!), { body: { embeds: [{ author: { name: nick, icon_url: `https://cdn.discordapp.com/avatars/${Id}/${avatar}${avatar!.includes('a_') ? '.gif' : '.png'}` }, description: `${nick} reached level ${level + 1}! You are now #${rank + 1} in the server`, color: 0x00AE86 }] } })
        }
        else if (source == 'twitch') {
            TwitchClient.say(channel!, `<@${Id}> reached level ${level + 1}! You are now #${rank + 1}!`)
        }
    }
}
await Bun.write("./pid.txt", String(process.pid))
Bun.cron("0 0 * * 0", async () => { await inactiveusers() })
TwitchClient.onMessage(async (channel, user, text, msg) => {
    const twitchId = msg.userInfo.userId;
    if (text.startsWith('!verify ')) {
        const code = text.split(' ')[1]?.toUpperCase();
        const linkDoc = await usersCollection.findOne({ twitchLinkCode: code, twitchLinkExpires: { $gt: Date.now() } });
        if (!linkDoc) return TwitchClient.say(channel, `@${user} that code is invalid or expired.`);
        await usersCollection.updateOne({ _id: linkDoc._id }, { $set: { twitchId: twitchId }, $unset: { twitchLinkCode: '', twitchLinkExpires: '' } });
        return TwitchClient.say(channel, `@${user} linked to Discord! ✅`);
    }
    if (text.startsWith('!discord ')) {
        const code = text.split(' ')[1]?.toUpperCase();
        const linkDoc = await usersCollection.findOne({ twitchLinkCode: code, twitchLinkExpires: { $gt: Date.now() } });
        if (!linkDoc) return TwitchClient.say(channel, `@${user} that code is invalid or expired.`);
        await usersCollection.updateOne({ _id: linkDoc._id }, { $set: { twitchId: twitchId }, $unset: { twitchLinkCode: '', twitchLinkExpires: '' } });
        return TwitchClient.say(channel, `@${user} linked to Discord! ✅`);
    }
    await grantXp({ Id: msg.userInfo.userId, source: 'twitch', channel: channel });
});
const statusMap: Record<string, { cmd: string, log: string, dm: string, color: number }> = {
    Ban: { cmd: 'was banned', log: 'banned a member', dm: `you were banned from`, color: 0xd10000 },
    Kick: { cmd: 'was kicked', log: 'kicked a member', dm: `you were kicked from`, color: 0x838383 },
    Mute: { cmd: 'was issued a mute', log: 'muted a member', dm: `you were given a`, color: 0xff4444 },
    Warn: { cmd: 'was issued a warning', log: 'warned a member', dm: `you were given a warning`, color: 0xffcc00 }
};
let presenceInterval: NodeJS.Timeout | undefined;
function startStatusLoop() {
    clearInterval(presenceInterval); // now this actually clears the right one
    presenceInterval = setInterval(() => {
        const uptimeMs = Date.now() - startedAt;
        client.user?.setPresence({
            activities: [{
                name: `for ${Math.floor(uptimeMs / 86400000)}d ${Math.floor((uptimeMs / 3600000) % 24)}h ${Math.floor((uptimeMs / 60000) % 60)}m ${Math.floor((uptimeMs / 1000) % 60)}s`,
                type: ActivityType.Watching,
            }],
            status: PresenceUpdateStatus.Online,
            afk: false,
        });
    }, 5000);
}
client.on('clientReady', async (ready) => {
    await appendFile("./log.log", `[Gateway] Ready\n`);
    startStatusLoop();
    await usersCollection.updateMany(
        { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
        { $set: { "punishments.$[elem].active": 0 } },
        { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
    );
    for (const guild of ready.guilds.cache.values()) {
        const { id, name, ownerId } = guild
        const existing = await guildconfigs.findOne({ guildId: id }, { projection: { _id: 0, Data: 1, messageConfigs: 1 } });
        if (!existing) return;
        const guildinvites = await guild.invites.fetch();
        await guildconfigs.updateOne({ guildId: id }, { $set: { icon: guild.iconURL(), name: name, ownerId: ownerId, Invites: Object.fromEntries(guildinvites.map(i => [i.code, i.uses])) } })
        const { Data, messageConfigs } = existing
        let data = Data
        for (const [embedName, config] of Object.entries(messageConfigs as Document)) {
            const { channelid, embeds, components, reactions } = config;
            try {
                const existingdata = Data.find((m: any) => m.name === embedName) as { name: string, messageId: string };
                const message = await client.rest.get(Routes.channelMessage(channelid, existingdata.messageId)) as any;
                const different = message.embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||') !== embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||')
                if (different) { await client.rest.patch(Routes.channelMessage(channelid, message.id), { body: { embeds: embeds, ...components } }) }
            } catch {
                let msg: APIMessage;
                try {
                    msg = await client.rest.post(Routes.channelMessages(channelid), { body: { embeds: embeds, components: components } }) as APIMessage;
                } catch (err) {
                    if (err instanceof DiscordAPIError) {
                        await appendFile("./log.log", `Error sending embed: ${embedName} cause: ${err.message}\n`);
                        continue;
                    }
                    throw err;
                }
                data = data.filter((message: any) => message.name !== embedName);
                if (reactions)
                    for (const reaction of reactions) {
                        await client.rest.put(Routes.channelMessageOwnReaction(channelid, msg!.id, reaction))
                        await Bun.sleep(750)
                    }
                await appendFile("./log.log", `📝 Sent '${embedName}'. Message ID: ${msg!.id} \n`);
                data.push({ name: embedName, messageId: msg!.id })
                await guildconfigs.updateOne({ guildId: id }, { $set: { Data: data } })
            }
        }
    }
})
client.on('autoModerationActionExecution', async (action) => {
    const { guild, channelId, ruleId, user } = action;

    const userDoc = await usersCollection.findOne(
        { userId: user!.id, guildId: guild.id },
        { projection: { level: 1, punishments: 1, avatar: 1, nick: 1 } }
    ) as Document;
    const { level, nick } = userDoc;
    const punishments = userDoc.punishments ?? [];

    const { reasonsandweights, Stages, name, icon, modChannels } = await guildconfigs.findOne(
        { guildId: guild.id },
        { projection: { reasonsandweights: 1, Stages: 1, name: 1, icon: 1, modChannels: 1 } }
    ) as Document;

    const rule = reasonsandweights[ruleId];
    let totalWeight = rule.Weight;
    let reason = `AutoMod: ${rule.reason}`;
    if (level < 3) { totalWeight += 1; reason += ' while new to the server.'; }

    const bannable = level < 3 && (totalWeight >= 3 || punishments.length > 2);
    const activeWarns = punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0);
    const totalWarns = activeWarns + (!bannable ? totalWeight : 1);
    const useravatar = user?.avatarURL() ?? user?.defaultAvatarURL;

    let warnType = bannable ? 'Ban' : 'Warn';
    let durationMs = 0, durationStr: string | null = null;
    const stage = Stages[Math.min(totalWarns - 1, Stages.length - 1)];

    if (warnType === 'Warn' && stage.minutes > 0) {
        durationMs = stage.minutes * 60000;
        durationStr = stage.minutes >= 60 ? `${Math.ceil(stage.minutes / 60)} hour mute` : `${stage.minutes} min mute`;
        warnType = 'Mute';
    }

    const finalMessage: any = await client.rest.post(Routes.channelMessages(channelId!), {
        body: {
            embeds: [{
                color: statusMap[warnType]!.color,
                author: { name: `${nick} ${warnType === 'Mute' ? `was issued a ${durationStr}` : statusMap[warnType]!.cmd}`, icon_url: useravatar }
            }]
        }
    });

    const object = new ObjectId();
    const newPunishment = {
        _id: object, userId: user!.id, moderatorId: '1420927654701301951', reason,
        duration: durationMs, timestamp: Date.now(), active: 1,
        weight: !bannable ? totalWeight : 1, type: warnType, channel: channelId,
        refrence: `https://discord.com/channels/${guild.id}/${channelId}/${finalMessage.id}`,
        warns: totalWarns - 1
    };
    await usersCollection.updateOne(
        { userId: user!.id, guildId: guild.id },
        { $push: { punishments: newPunishment as any } },
        { upsert: true }
    );

    const caseHistory = [...punishments, newPunishment]
        .filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick')
        .slice(0, 10)
        .map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null)
        .filter(Boolean);

    const logEmbed: APIEmbed = {
        color: statusMap[warnType]!.color,
        author: { name: `febot ${statusMap[warnType]!.log}`, icon_url: client.rest.cdn.avatar('1420927654701301951', 'a96f0e3049ea9aae9798f45cc2479ebc') },
        thumbnail: { url: useravatar! },
        fields: [
            { name: 'user.id:', value: `<@${user!.id}>`, inline: true },
            { name: 'Channel:', value: `<#${channelId}>`, inline: true },
            { name: 'History:', value: caseHistory.join(' | ') || "none", inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            ...(['Ban', 'Kick'].includes(warnType) ? [] : [
                { name: 'Punishment:', value: `\`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
                { name: 'Warns at log time:', value: `\`${activeWarns}\``, inline: false },
                { name: 'Next Punishment:', value: `\`${stage.label}\``, inline: false }
            ])
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'User DMed ✅' }
    };

    try {
        const dmchannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: user!.id } }) as APIChannel;
        await client.rest.post(Routes.channelMessages(dmchannel.id), {
            body: {
                embeds: [{
                    color: statusMap[warnType]!.color, author: { name: nick, icon_url: useravatar },
                    thumbnail: { url: icon },
                    description: `<@${user!.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${name}](https://discord.com/channels/${guild.id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${name}` : `in ${name}`}`,
                    fields: [
                        { name: 'Reason:', value: `\`${reason}\``, inline: false },
                        ...(['Ban', 'Kick'].includes(warnType) ? [] : [
                            { name: 'Punishment:', value: `\`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
                            { name: 'Active Warnings:', value: `\`${totalWarns}\``, inline: false },
                            { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:F>` }
                        ])
                    ],
                    timestamp: new Date().toISOString()
                }],
                components: warnType === 'Ban' ? [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }] : undefined,
            } as APIMessage
        });
    } catch {
        logEmbed.footer!.text = 'User DMed 🚫';
    }

    const member = await guild.members.fetch(user!.id).catch(() => null);
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId: guild.id }, { $set: { Ban: user!.id } });
            await guild.bans.create(user!.id, { deleteMessageSeconds: 604800, reason: `Ban Command: ${reason}` });
            break;
        case 'Mute':
            await member?.timeout(Math.min(durationMs, 2419200000), reason);
            break;
        case 'Kick':
            await member?.kick(reason);
            break;
    }

    await client.rest.post(Routes.channelMessages(warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel), { body: { embeds: [logEmbed] } });

    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne(
                { userId: user!.id, guildId: guild.id },
                { $set: { "punishments.$[elem].active": 0 } },
                { arrayFilters: [{ "elem._id": object }] }
            );
        }, 86400000);
    }
});
client.on('guildCreate', async (guild) => {
    const { id, name, ownerId } = guild
    const existing = await guildconfigs.findOne({ guildId: id }, { projection: { _id: 1, Data: 1, messageConfigs: 1 } });
    if (!existing) return;
    const guildinvites = await guild.invites.fetch();
    await guildconfigs.updateOne({ guildId: id }, { $set: { icon: guild.iconURL(), name: name, ownerId: ownerId, Invites: Object.fromEntries(guildinvites.map(i => [i.code, i.uses])) } })
    const { Data, messageConfigs } = existing
    let data = Data
    for (const [embedName, config] of Object.entries(messageConfigs as Document)) {
        const { channelid, embeds, components, reactions } = config;
        try {
            const existingdata = Data.find((m: any) => m.name === embedName) as { name: string, messageId: string };
            const message = await client.rest.get(Routes.channelMessage(channelid, existingdata.messageId)) as any;
            const different = message.embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||') !== embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||')
            if (different) { await client.rest.patch(Routes.channelMessage(channelid, message.id), { body: { embeds: embeds, ...components } }) }
        } catch {
            let msg: APIMessage;
            try {
                msg = await client.rest.post(Routes.channelMessages(channelid), { body: { embeds: embeds, components: components } }) as APIMessage;
            } catch (err) {
                if (err instanceof DiscordAPIError) {
                    await appendFile("./log.log", `Error sending embed: ${embedName} cause: ${err.message}\n`);
                    continue;
                }
                throw err;
            }
            data = data.filter((message: any) => message.name !== embedName);
            if (reactions)
                for (const reaction of reactions) {
                    await client.rest.put(Routes.channelMessageOwnReaction(channelid, msg!.id, reaction))
                    await Bun.sleep(750)
                }
            await appendFile("./log.log", `📝 Sent '${embedName}'. Message ID: ${msg!.id} \n`);
            data.push({ name: embedName, messageId: msg!.id })
            await guildconfigs.updateOne({ guildId: id }, { $set: { Data: data } })
        }
    }
})
client.on('guildMemberAdd', async (member) => {
    const { guild, user } = member;
    const { modChannels, staffroles, generalchannels, Invites } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1, staffroles: 1, generalchannels: 1, Invites: 1 } }) as Document
    const avatarURL: string = user.avatarURL() ?? user.defaultAvatarURL
    const currentInvites = await guild.invites.fetch();
    const invite = currentInvites.find((i: any) => i.uses > (Invites.get(i.code) || 0));
    const inviter = await guild.members.fetch(invite!.inviter!.id) as GuildMember ?? null;
    await guildconfigs.updateOne({ guildId: guild.id }, { $set: { Invites: Object.fromEntries(currentInvites.map(i => [i.code, i.uses])) } }, { upsert: true });
    const createdTimestamp = ((BigInt(member.user.id) >> 22n) + 1420070400000n) / 1000n;
    const welcomeEmbed: APIEmbed = {
        color: 0x00FF99,
        description: `<@${user.id}> joined the Server!`,
        thumbnail: { url: avatarURL },
        fields: [{ name: 'Discord Join Date:', value: `<t:${createdTimestamp}>`, inline: true }],
        timestamp: new Date().toISOString(),
        footer: invite ? { text: `Invited by: ${inviter?.user.username} | ${invite.code}`, icon_url: `https://cdn.discordapp.com/avatars/${inviter!.user.id}/${inviter!.user.avatar}.png` } : undefined
    }
    const channel = client.channels.cache.get(modChannels.welcomeChannel) as TextChannel;
    const originalMessage = await channel.send({
        embeds: [welcomeEmbed],
            components: [{
                type: ComponentType.ActionRow,
                components: [{
                    type: ComponentType.Button,
                    custom_id: `ban_${user.id}_${invite && inviter && !inviter.roles.cache.some((role: Role) => staffroles.includes(role)) ? invite.code : 'none'}`,
                    label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}`,
                    style: ButtonStyle.Danger
                }]
            }]
    }) 
    if (Date.now() - Number(createdTimestamp) < 172800000) {
        await member.kick('Account less than 2 days old')
        const channel = client.channels.cache.get(modChannels.mutelogChannel) as TextChannel;
        channel.send({
            embeds: [{
                title: 'A member was auto-kicked', thumbnail: { url: avatarURL },
                fields: [
                    { name: `**User:**`, value: `<@${user.id}>` },
                    { name: '**Reason:**', value: `New Account\n** Created:** <t: ${Math.floor(Number(createdTimestamp) / 1000)}:R>` },
                    { name: '**Created on:**', value: `<t:${Math.floor(Number(createdTimestamp) / 1000)}:R>` }
                ]
            }]
        })
        return;
    }
    const dmChannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: user.id } }) as any;
    if (dmChannel.id) {
        try {
            await client.rest.post(Routes.channelMessages(dmChannel.id), {
                body: {
                    embeds: [{
                        description: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.  Click on the invite: https://discord.gg/qMjjyXyYbr for the bot's key incase he cannot dm you.`,
                    }],
                    components: []
                }
            })
        } catch {
            await appendFile("./log.log", `[Member Add] Error: ${user.id} does not have dms open`)
        }
    }
    const persistentdata: WithId<Document> | null = await usersCollection.findOne({ userId: user.id, guildId: guild.id })
        if (!persistentdata) {
            await usersCollection.insertOne({ userId: user.id, guildId: guild.id, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], joinedTime: Date.now(), blacklist: [], avatar: member.user.avatarURL() ?? member.user.defaultAvatarURL, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [], nick: member.user.username, lastmessage: null })
        } else {
            if (guild.id == "1231453115937587270")
                await member.roles.add(`1463354464747524136`)
            const channel = client.channels.cache.get(generalchannels[0]) as TextChannel;
            await channel.send({
                embeds: [{
                    description: `Everyone, Welcome <@${member?.user.id}> back to the server!\n\n`,
                    thumbnail: { url: member.user.avatarURL() ?? member.user.defaultAvatarURL },
                    fields: [
                        { name: 'Discord Join Date:', value: `<t:${Number(((BigInt(member!.user.id) >> 22n) + 1420070400000n) / 1000n)}>`, inline: true }
                    ]
                }]
            })
        }
        setTimeout(async () => {
            await client.rest.patch(Routes.channelMessage(originalMessage.channel.id, originalMessage.id), {
                body: {
                    embeds: [welcomeEmbed],
                    components: [{
                        type: 1, components: [{
                            type: ComponentType.Button,
                            custom_id: `ban_${user.id}_${invite && inviter && !inviter.roles.cache.some((role: Role) => staffroles.includes(role)) ? invite.code : 'none'}`,
                            label: invite && inviter && !inviter.roles.cache.some((role: Role) => staffroles.includes(role)) ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                            style: ButtonStyle.Danger,
                            disabled: true
                        }],
                    }],
                }
            })
        }, 15 * 60 * 1000)

})
client.on('guildMemberRemove', async (member) => {
    const { user, guild } = member;
    if (user.bot) { return }
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    const { joinedTime } = await usersCollection.findOne({ userId: user.id, guildId: guild.id }, { projection: { joinedTime: 1 } }) as Document;
    const channel = client.channels.cache.get(modChannels.welcomeChannel) as TextChannel
    await channel.send({
        embeds: [{
            description: `<@${user.id}> left the server.`,
            thumbnail: { url: member.avatarURL() ?? member.user.defaultAvatarURL },
            fields: [{ name: 'Server Join Date:', value: `<t:${Math.floor(joinedTime / 1000)}>`, inline: true }]
        }]
    })
})
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const { guild, user, nickname, avatar } = newMember;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    await usersCollection.updateOne({ guildId: guild.id, userId: user.id }, { $set: { nick: nickname ?? user.username, avatar: avatar } });
    if (!oldMember || nickname === oldMember.nickname || newMember.user.username == nickname) return;
    const channel = client.channels.cache.get(modChannels.namelogChannel) as TextChannel;
    await channel.send({
        embeds: [{
            thumbnail: { url: oldMember.avatarURL() ?? oldMember.user.defaultAvatarURL },
            color: 0x4e85b6,
            description: `<@${user.id}> **changed their nickname**\n\n` +
                `**Before:**\n${nickname}\n\n` +
                `**After:**\n${nickname ?? user.username}`,
            timestamp: new Date().toISOString()
        }]
    })
})
client.on('guildBanAdd', async (ban) => {
    const { user, guild } = ban;
    const { Ban, modChannels, icon, name } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { Ban: 1, modChannels: 1, icon: 1, name: 1 } }) as Document
    if (Ban === user.id) { await guildconfigs.updateOne({ guildId: guild.id }, { $set: { ban: '' } }); return; }
    else {
        massban += 1;
        const auditLog = await guild.fetchAuditLogs({ limit: 1, user: user.id, type: AuditLogEvent.MemberBanAdd })
        const reason = auditLog.entries.first()?.reason ?? null;
        const userId = auditLog.entries.first()?.executorId
        const logEmbed: APIEmbed = {
            color: 0xff3030,
            title: 'Mass Ban Detected',
            thumbnail: { url: `https://cdn.discordapp.com/users/${user.id}/${user.avatar}.png` },
            description: `**Moderator <@${userId}> banned <@${user.id}>:**`,
            fields: [
                { name: 'ID:', value: `<@${user.id}>`, inline: true },
                { name: `**TAG:**`, value: `${user.username}`, inline: true },
                { name: `**Reason:**`, value: `\`${reason}\`` }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'User DMed ✅' }
        }
        await Bun.sleep(massban * 1000)
        try {
            const dmchannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: user.id } }) as APIChannel;
            await client.rest.post(Routes.channelMessages(dmchannel.id), {
                body: {
                    embeds: [{
                        color: 0xd10000,
                        author: { name: `${user.username}`, icon_url: user.avatarURL() ?? user.defaultAvatarURL },
                        thumbnail: { url: icon },
                        description: `<@${user.id}>, ${`you were banned from [${name}](https://discord.com/channels/${guild.id}).\n\n\nTo appeal this decision, please join our dedicated appeal server using the button below.`}`,
                        fields: [{ name: 'Reason:', value: `\`${reason}\``, inline: false }],
                    }],
                    components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }]
                }
            });
        } catch { logEmbed.footer!.text = 'User DMed 🚫'; }
        const channel = client.channels.cache.get(modChannels.banlogChannel) as TextChannel
        await channel.send({ embeds: [logEmbed] })
        massban -= 1;
    }
})
client.on('guildBanRemove', async (ban) => {
    const { user, guild } = ban
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    const { bans } = (await usersCollection.findOne({ userId: user.id, guildId: guild.id }, { projection: { punishments: 1 } }) as Document).filter((ban: any) => ban.type == 'Ban').sort((a: any, b: any) => b.timestamp - a.timestamp)
    const channel = client.channels.cache.get(modChannels.banlogChannel) as TextChannel;
    await channel.send({
        embeds: [{
            color: 0x309eff,
            title: 'A member was unbanned',
            thumbnail: { url: client.rest.cdn.avatar(user.id, user.avatar!) ?? client.rest.cdn.defaultAvatar(6) },
            fields: [
                { name: '**User**', value: `<@${user.id}>` },
                { name: '**Tag**', value: `\`${user.username}\`` },
                { name: '**Reason**:', value: ` \`${bans[0].reason}\`` }
            ],
            timestamp: new Date().toISOString()
        }]
    })
})
client.on('inviteCreate', async (invite) => {
    await guildconfigs.updateOne({ guildId: invite.guild!.id }, { $set: { [`Invites.${invite.code}`]: invite.uses } });
})
client.on('inviteDelete', async (invite) => {
    await guildconfigs.updateOne({ guildId: invite.guild!.id }, { $unset: { [`Invites.${invite.code}`]: "" } });
})
client.on('messageReactionAdd', async (reaction, user) => {
    const { message, emoji } = reaction;
    if (!message.guild) return;
    const { reactions, Data } = await guildconfigs.findOne({ guildId: message.guild!.id }, { projection: { reactions: 1, Data: 1 } }) as Document
    if (!Data || !Data.some((info: { name: string, messageId: string }) => info.messageId === message.id)) return;
    const roleID = reactions[emoji.id! || emoji.name!];
    if (!roleID) return;
    const { blacklist } = await usersCollection.findOne({ userId: user.id, guildId: message.guild!.id }, { projection: { blacklist: 1 } }) as WithId<Document>;
    if (blacklist && blacklist.length > 0 && blacklist.includes(roleID)) return;
    const roleIds = Array.isArray(roleID) ? roleID : [roleID];
    await Promise.all(
        roleIds.map((id: string) => client.rest.put(Routes.guildMemberRole(message.guild!.id, user.id, id)))
    );
})
client.on('messageReactionRemove', async (reaction, user) => {
    const { message, emoji } = reaction;
    if (!message.guild) return;
    const { Data, reactions } = await guildconfigs.findOne({ guildId: message.guild!.id }, { projection: { Data: 1, reactions: 1 } }) as WithId<Document>;
    if (!Data || !Data.some((info: { name: string, messageId: string }) => info.messageId === message.id)) return;
    const roleID = reactions[emoji.id! || emoji.name!];
    if (!roleID) return;
    if (Array.isArray(roleID))
        await Promise.all(roleID.map(role => client.rest.delete(Routes.guildMemberRole(message.guild!.id!, user.id, role))));
    else
        await client.rest.delete(Routes.guildMemberRole(message.guild!.id!, user.id, roleID));
})
client.on('messageDelete', async (deletedData) => {
    const { id, channelId, guildId, stickers, attachments, author, content } = deletedData
    if (deletedData.author!.bot) return;
    const imageAttachments = attachments.map((att) => att.proxyURL);
    const additionalEmbeds = imageAttachments.slice(1, imageAttachments.length).map(url => ({ url: `https://discord.com/channels/${guildId}/${channelId}/${id}`, image: { url: url } }));
    const mainEmbed: APIEmbed = {
        color: 0xf03030,
        description: `Message by <@${author!.id}> was deleted in <#${channelId}>\n\n${content || 'No content'}${stickers.size > 0 ? `\n\n**__Sticker:__**${stickers.first()?.name}` : ''}\n\n[Event Link](${`https://discord.com/channels/${guildId}/${channelId}/messages/${id}`})\n\n`,
        url: `https://discord.com/channels/${guildId}/${channelId}/${id}`,
        thumbnail: { url: client.rest.cdn.avatar(author!.id, author!.avatar!) ?? client.rest.cdn.defaultAvatar(6) },
        footer: { text: `ID: ${id}` },
        timestamp: new Date().toISOString(),
        image: imageAttachments[0] ? { url: imageAttachments[0] } : undefined
    }
    const { modChannels } = await guildconfigs.findOne({ guildId: guildId }, { projection: { modChannels: 1 } }) as Document
    const channel = client.channels.cache.get(modChannels.deletedlogChannel) as TextChannel;
    await channel.send({ embeds: [mainEmbed, ...additionalEmbeds] })
})
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage || oldMessage.content == newMessage.content || newMessage.author.bot) return;
    const { modChannels } = await guildconfigs.findOne({ guildId: newMessage.guildId }, { projection: { modChannels: 1 } }) as Document
    const channel = client.channels.cache.get(modChannels.updatedlogChannel) as TextChannel
    await channel.send({
        embeds: [{
            description: `<@${oldMessage.author!.id}> edited a message in <#${newMessage.channelId}>\n\n **Before:**\n${oldMessage.content || ''}\n\n **After:**\n${newMessage.content || ''}\n\n[Jump to Message](https://discordapp.com/channels/${newMessage.guildId}/${newMessage.channelId}/messages/${newMessage.id})`,
            color: 0x309eff,
            thumbnail: { url: oldMessage.member!.user.avatarURL() ?? oldMessage.member!.user.defaultAvatarURL },
            footer: { text: `ID: ${newMessage.id}` },
            timestamp: new Date().toISOString()
        }]
    })
})
client.on('messageCreate', async (message) => {
    const { author, guildId, channelId, member, content, attachments, type, mentions, guild, channel } = message;
    if (author.bot == true || !guildId || type === MessageType.ChatInputCommand || type === MessageType.UserJoin) return;
    const { publicChannels, responses, staffroles, generalchannels, automodsettings: { messagethreshold, Duplicatespamthreshold, mediathreshold, spamthreshold, capsthreshold }, count, lastuser, Stages, modChannels } = await guildconfigs.findOne({ guildId: guildId }, { projection: { publicChannels: 1, responses: 1, staffroles: 1, mediaexclusions: 1, automodsettings: 1, count: 1, lastuser: 1, baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1, generalchannels: 1, Stages: 1, modChannels: 1 } }) as Document
    const isstaff = member?.roles.cache.some((role: Role) => staffroles.includes(role.id)) || author.id === "521404063934447616"
    const linkcheck = /https?:\/\/[^\s]+/i.test(content)
    const hasMedia = (attachments.size > 0 || linkcheck) && generalchannels.includes(channelId)
    let messageWords: string = '!';
    let changed: boolean = false
    if (channelId == publicChannels.countingChannel) {
        if (!/^\d+$/.test(content)) return;
        await guildconfigs.findOneAndUpdate({ guildId: guildId }, (count + 1 == parseInt(content) && lastuser !== author.id) ? { $inc: { count: 1 }, $set: { lastuser: author.id } } : { $set: { count: 0, lastuser: null } })
        return (count + 1 == parseInt(content) && lastuser !== author.id) ?
            await message.react("%E2%9C%85") : await message.reply({ content: `<@${author.id}> missed or already counted!` })
    }
    if (content.startsWith("!restart") && channelId === modChannels.adminChannel && member?.permissions.has(PermissionFlagsBits.Administrator)) {
        const intPid = (await Bun.file('./interpid.txt').text()).trim();
        Bun.spawn(['powershell', '-ExecutionPolicy', 'Bypass', '-File', 'restart-interactions.ps1', '-IntPid', intPid, '-BotPid', String(process.pid)
        ], { cwd: 'C:\\Users\\micha\\Desktop\\bot', stderr: "pipe", stdout: 'pipe', stdin: 'pipe' });
        await message.reply({ embeds: [{ description: 'Restarting interactions server...' }] })
        return;
    }
    if (content.length >= 1) {
        const stripped = content.replace(/<a?:\w+:\d+>|[\-!$.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '');
        if (stripped.length > 0) { messageWords = stripped; changed = true; }
        const lowerwords = messageWords.toLowerCase()
        const reactionsToApply = [];
        for (const [trigger, text] of Object.entries(responses))
            if (lowerwords.includes(trigger))
                await message.reply(text as string) 
        if (lowerwords.includes('bad') && lowerwords.includes('bot'))
            reactionsToApply.push('😡')
        if (lowerwords.includes('857445139416088647'))
            reactionsToApply.push(encodeURIComponent('SaltyEyes:1257522749635563561'))
        if (lowerwords.includes('gay'))
            reactionsToApply.push('🏳️‍🌈')
        for (const emoji of reactionsToApply)
            await message.react(emoji);
    }
    const key = keyify(messageWords)
    const { total, mediaCount, timestamps, duplicateCounts, punishments } = await usersCollection.findOne({ userId: author.id, guildId: guildId }, { projection: { total: 1, mediaCount: 1, timestamps: 1, duplicateCounts: 1, punishments: 1 } }) as Document;
    const caps: RegExpMatchArray | null = messageWords.length > 20 ? messageWords.match(/[A-Z]/g) : null;
    const activemarks: Record<string, boolean> = {
        everyonePing: mentions.everyone,
        duplicateSpam: changed && (duplicateCounts[key!] + 1) > Duplicatespamthreshold,
        mediaViolation: hasMedia && mediaCount + 1 > mediathreshold && (total ?? 0) + 1 < messagethreshold,
        generalspam: timestamps.filter((stamp: string) => Date.now() - parseInt(stamp) < 8000).length + 1 > spamthreshold,
        capSpam: ((caps?.length ?? 0) / messageWords.length) > capsthreshold
    };
    await grantXp({ Id: author.id, source: 'discord', roles: member!.roles.cache, guildId: guildId, channel: channelId });
    const result = await usersCollection.findOneAndUpdate(
        { userId: author.id, guildId: guildId },
        [
            {
                $set: {
                    previoustime: { $ifNull: ["$lastmessage", 0] },
                    isModReset: { $or: [activemarks.duplicateSpam, { $gte: [{ $subtract: [Date.now(), { $ifNull: ["$lastmessage", 0] }] }, 1800000] }] }
                }
            },
            {
                $set: {
                    avatar: member?.user.avatarURL() ?? member?.user.defaultAvatarURL,
                    totalmessages: { $add: ["$totalmessages", 1] },
                    total: { $cond: ["$isModReset", 0, { $cond: [{ $gte: [{ $add: ["$total", 1] }, messagethreshold] }, 0, { $add: ["$total", 1] }] }] },
                    mediaCount: { $cond: ["$isModReset", 0, { $cond: [{ $gte: [{ $add: ["$total", 1] }, messagethreshold] }, 0, { $add: ["$mediaCount", hasMedia ? 1 : 0] }] }] },
                    duplicateCounts: {
                        $cond: ["$isModReset", {},
                            {
                                $cond: [
                                    { $gte: [{ $add: ["$total", 1] }, messagethreshold] },
                                    {},
                                    changed ? { $mergeObjects: ["$duplicateCounts", { [key]: { $add: [{ $ifNull: [`$duplicateCounts.${key}`, 0] }, 1] } }] } : "$duplicateCounts"
                                ]
                            }]
                    },
                    timestamps: { $slice: [{ $concatArrays: ["$timestamps", [Date.now().toString()]] }, -15] },
                    lastmessage: Date.now()
                }
            },
            { $unset: "isModReset" }
        ],
        { returnDocument: 'after', projection: { level: 1 } }
    ) as WithId<Document>;
    if (!result) {
        await appendFile("./log.log", `[MessageCreate] No user doc for ${author.id} in ${guildId}, skipping automod.\n`);
        return;
    }
    const { level } = result
    const isNewUser = Date.now() - member?.joinedTimestamp! < 2 * 24 * 60 * 60 * 1000 && level < 3
    if (isstaff) return;
    if (mentions.everyone) await message.delete();
    const activeChecks = Object.keys(reasonsandweights).filter((key: string) => activemarks[key]).map(key => ({ ...reasonsandweights[key] })) as Array<{ reason: string, Weight: number }>;
    let totalWeight = activeChecks.reduce((acc, check) => acc + check.Weight, 0) as number;
    if (totalWeight == 0) return;
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const bannable = isNewUser && (totalWeight >= 3 || mentions.everyone)

    const activeWarns = punishments.length > 0 ? punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0) : 0;
    const totalWarns = activeWarns + totalWeight;
    const useravatar = author.avatarURL() ?? author.defaultAvatarURL;

    let warnType = bannable ? 'Ban' : 'Warn';
    let durationMs = 0, durationStr = null;
    const stage = Stages[Math.min(totalWarns - 1, Stages.length - 1)];
    if (warnType === 'Warn' && stage.minutes > 0) {
        durationMs = stage.minutes * 60000;
        durationStr = stage.minutes >= 60 ? `${Math.ceil(stage.minutes / 60)} hour mute` : `${stage.minutes} min mute`;
    }
    warnType = 'Mute';
    const finalMessage: any = await channel.send({
        embeds: [{
            color: statusMap[warnType]!.color,
            author: { name: `${member?.nickname} ${warnType === 'Mute' ? `was issued a ${durationStr}` : statusMap[warnType]!.cmd}`, icon_url: useravatar }
        }]
    })
    const object = new ObjectId();
    const newPunishment = { _id: object, userId: author.id, moderatorId: '1420927654701301951', reasonText, duration: durationMs, timestamp: Date.now(), active: 1, weight: !bannable ? totalWeight : 1, type: warnType, guildId, channel: channelId, refrence: `https://discord.com/channels/${guildId}/${channelId}/${finalMessage.id}`, warns: totalWarns - 1 };
    await usersCollection.updateOne({ userId: author.id, guildId }, { $push: { punishments: newPunishment as any } });
    const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
    const logEmbed: APIEmbed = {
        color: statusMap[warnType]!.color,
        author: { name: `${client.user?.username} ${statusMap[warnType]!.log}`, icon_url: client.user?.avatarURL()! },
        thumbnail: { url: useravatar },
        fields: [
            { name: 'user.id:', value: `<@${author.id}>`, inline: true },
            { name: 'Channel:', value: `<#${channelId}>`, inline: true },
            { name: 'History:', value: caseHistory.join(' | ') || "none", inline: true },
            { name: 'Reason:', value: `\`${reasonText}\``, inline: false },
            ...(['Ban', 'Kick'].includes(warnType) ? [] : [
                { name: 'Punishment:', value: `\`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
                { name: 'Warns at log time:', value: `\`${activeWarns}\``, inline: false },
                { name: 'Next Punishment:', value: `\`${stage.label}\``, inline: false }
            ])
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'User DMed ✅' }
    };
    let dmFailed = false;
    try {
        const dmchannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: author.id } }) as APIChannel;
        await client.rest.post(Routes.channelMessages(dmchannel.id), {
            body: {
                embeds: [{
                    color: statusMap[warnType]!.color, author: { name: member!.nickname, icon_url: useravatar },
                    thumbnail: { url: message.guild?.iconURL() },
                    description: `<@${author.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${message.guild!.name}](https://discord.com/channels/${guildId}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${message.guild!.name}` : `in ${message.guild!.name}`}`,
                    fields: [
                        { name: 'Reason:', value: `\`${reasonText}\``, inline: false },
                        ...(['Ban', 'Kick'].includes(warnType) ? [] : [
                            { name: 'Punishment:', value: `\`${totalWeight} warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
                            { name: 'Active Warnings:', value: `\`${totalWarns}\``, inline: false },
                            { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:F>` }
                        ])
                    ],
                    timestamp: new Date().toISOString()
                }],
                components: warnType === 'Ban' ? [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }] : undefined,
            } as APIMessage
        })
    } catch {
        dmFailed = true;
    }
    logEmbed.footer!.text = dmFailed === false ? 'User DMed 🚫' : 'User DMed ✅';
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId }, { $set: { ban: author.id } });
            await guild?.bans.create(author.id, { deleteMessageSeconds: 604800, reason: `Ban Command: ${reasonText}` })
            break;
        case 'Mute':
            await member!.timeout(Math.min(durationMs, 2419200000), reasonText)
            break;
        case 'Kick':
            await member?.kick(reasonText)
            break;
    }
    const logChannel = await client.channels.fetch(warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel) as TextChannel
    await logChannel.send({ embeds: [logEmbed] });
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne({ userId: author.id, guildId }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
        }, 86400000);
    }
});
client.on('voiceStateUpdate', async (event) => {
    const { guild, channelId, member } = event;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    const vcchannel = await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild.id }, { $set: { vcchannel: channelId } }, { returnDocument: 'before' }) as Document;
    if (vcchannel.vcchannel === channelId) return;
    await client.rest.post(Routes.channelMessages(modChannels.voicelogChannel), {
        body: {
            embeds: [{
                author: { name: member?.user.username, icon_url: member?.avatarURL() },
                thumbnail: { url: member?.avatarURL() },
                description: channelId !== null ? `<@${guild.id}> joined <#${channelId}>.` : `<@${guild.id}> left <#${vcchannel.vcchannel}>`,
                color: channelId !== null ? 0x305830 : 0x8b0000,
                timestamp: new Date().toISOString()
            }]
        } as APIMessage
    })
})
client.on('guildUpdate', async (guild) => {
    const existing = await guildconfigs.findOne({ guildId: guild.id }, { projection: { ownerId: 1 } }) as Document;
    if (guild.ownerId = existing.ownerId) return;
    else await guildconfigs.updateOne({ guildId: guild.id }, { $set: { ownerId: guild.ownerId } })
})
client.on('shardError', async (err, shardId) => {
    await appendFile("./log.log", `[root] errror on shard ${shardId} @ ${Date.now()}: ${err}\n`)
})
client.on('shardDisconnect', async (event, shardId) => {
    appendFile("./log.log", `Shard ${shardId} disconnected. Code: ${event.code}`)
})
client.on('shardResume', async (shardId, replayedEvents) => {
    appendFile("./log.log", `Shard ${shardId} resumed, replayed ${replayedEvents} events`);
    startStatusLoop()
})
client.login(Bun.env.TOKEN)