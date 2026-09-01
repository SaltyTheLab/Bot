import { usersCollection, guildconfigs, ws } from './Database';
import { ObjectId, type Document, type WithId } from 'mongodb';
import { appendFile } from 'node:fs/promises'
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ComponentType, ButtonStyle, MessageType, ActivityType, PresenceUpdateStatus, AuditLogEvent, Client, Collection, DiscordAPIError, Options, Role, Routes, type APIChannel, type APIEmbed, type APIMessage, Partials, GatewayIntentBits, PermissionFlagsBits, TextChannel, type Channel, type APIGuildMember, type APIInvite, MessageFlags, type AnyComponentV2, subtext } from 'discord.js'
import { createHash } from 'crypto'
interface xp { Id: string; source: 'discord' | 'twitch'; channel?: string; roles?: Collection<string, Role>, guildId?: string }
process.on("uncaughtException", async (err: any) => {
    const intpid = parseInt(await Bun.file("./interpid.txt").text())
    await appendFile("./log.log",
        `[root] Uncaught exception @ ${Date.now()}: method: ${err.method}, url: ${err.url}, status: ${err.status}, code: ${err.code}\n 
        rawError: ${JSON.stringify(err.rawError)}\n`
    )
    Bun.spawn(["powershell", "-ExecutionPolicy", "Bypass", "-File", "C:\\Users\\micha\\Desktop\\Bot\\restart.ps1", "-BotPid", `${process.pid}`, "-intpid", `${intpid}`], { stderr: "pipe", stdout: 'pipe', stdin: 'pipe' })
})
process.on("unhandledRejection", async (reason: any) => {
    const intpid = parseInt(await Bun.file("./interpid.txt").text())
    appendFile("./log.log", `[root] unhandled Rejection: ${JSON.stringify(reason)}\n`)
    Bun.spawn(["powershell", "-ExecutionPolicy", "Bypass", "-File", "C:\\Users\\micha\\Desktop\\Bot\\restart.ps1", "-BotPid", `${process.pid}`, "-intpid", `${intpid}`], { stderr: "pipe", stdout: 'pipe', stdin: 'pipe' })
});
const client = new Client({
    intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildModeration | GatewayIntentBits.GuildExpressions | GatewayIntentBits.GuildIntegrations | GatewayIntentBits.GuildWebhooks | GatewayIntentBits.GuildVoiceStates | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildMessageReactions | GatewayIntentBits.MessageContent,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    presence: { activities: [{ name: `for 0d 0h 0m 0s`, type: ActivityType.Watching, }], status: 'online', afk: false },
    makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings }),
    sweepers: { ...Options.DefaultSweeperSettings }
})

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
    for (const id of userIds) {
        const member = await client.rest.get(Routes.guildMember('1231453115937587270', id)) as APIGuildMember
        if (member.roles.length === 0)
            await client.rest.delete(Routes.guildMember('1231453115937587270', id))
        await Bun.sleep(750);
    }
    await usersCollection.deleteMany({ guildId: '1231453115937587270', userId: { $in: userIds } });
}
async function grantXp({ Id, source, channel, roles, guildId }: xp) {
    const { baseMultiplier, exponent, flatOffset, roundToNearest } = await guildconfigs.findOne({ guildId: guildId }, { projection: { baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1 } }
    ) as any;

    const { xp, level, avatar, nick } = await usersCollection.findOneAndUpdate(
        source == 'discord' ? { userId: Id, guildId: guildId } : { twitchId: Id }, { $inc: { xp: 20 } }, { returnDocument: 'after', projection: { xp: 1, level: 1, avatar: 1, nick: 1, } }) as any;


    if (level < 100 && xp >= Math.round((level ** exponent * baseMultiplier + flatOffset) / roundToNearest)) {
        await usersCollection.updateOne({ userId: Id, guildId: guildId }, { $inc: { level: 1 }, $set: { xp: 0 } });
        const rank = await usersCollection.countDocuments({ guildId: guildId, $or: [{ level: { $gt: level + 1 } }, { level: level + 1, xp: { $gt: xp } }] });
        if (source == 'discord') {
            if (parseInt(level) + 1 > 2 && !roles!.has("1334238580914131026") && guildId == '1231453115937587270')
                await client.rest.put(Routes.guildMemberRole(guildId, Id, '1334238580914131026'))
            client.rest.post(Routes.channelMessages(channel!), { body: { embeds: [{ author: { name: nick, icon_url: `https://cdn.discordapp.com/avatars/${Id}/${avatar}${avatar!.includes('a_') ? '.gif' : '.png'}` }, color: 0x00AE86, footer: { text: `${nick} reached level ${level + 1}! You are now #${rank + 1} in the server`, icon_url: "https://cdn.discordapp.com/icons/1231453115937587270/49d602a371ad1e713309c43f301e696d.webp?size=1024" } }] } as APIMessage })
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
        const { id, name, ownerId, invites } = guild
        const existing = await guildconfigs.findOne({ guildId: id }, { projection: { _id: 0, messageConfigs: 1 } });
        if (!existing) continue;
        const guildinvites = await invites.fetch();
        await guildconfigs.updateOne({ guildId: id }, { $set: { icon: guild.iconURL(), name: name, ownerId: ownerId, Invites: Object.fromEntries(guildinvites.map(i => [i.code, { uses: i.uses, inviter: i.inviter!.id, code: i.code }])) } })
        const { messageConfigs } = existing
        for (const [embedName, config] of Object.entries(messageConfigs as Document)) {
            const { channelid, embeds, components, reactions, messageId } = config;
            try {
                if (!messageId) throw new Error("no message sent yet");
                const message = await client.rest.get(Routes.channelMessage(channelid, messageId)) as any;
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
                if (reactions) {
                    for (const r of reactions) {
                        const emoji = typeof r === 'string' ? r : r.emoji; // supports plain-string groups too, see note below
                        await client.rest.put(Routes.channelMessageOwnReaction(channelid, msg!.id, emoji));
                        await Bun.sleep(750);
                    }
                }
                await appendFile("./log.log", `📝 Sent '${embedName}'. Message ID: ${msg!.id} \n`)
                await guildconfigs.updateOne({ guildId: id }, { $set: { [`messageConfigs.${embedName}.messageId`]: msg!.id } })
            }
        }
    }
})
client.on('autoModerationActionExecution', async (action) => {
    const { guild, channelId, ruleId, user } = action;
    const userDoc = await usersCollection.findOne({ userId: user!.id, guildId: guild.id }, { projection: { level: 1, punishments: 1 } }) as Document;
    const { level, punishments } = userDoc;
    const { automodsettings: { automodreasonsandweights }, Stages, modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { automodsettings: 1, Stages: 1, modChannels: 1 } }) as Document;

    if (!automodreasonsandweights[ruleId]) {
        console.error(`No reasonsandweights entry for AutoMod rule ${ruleId} in guild ${guild.id}`);
        return;
    }
    let totalWeight = automodreasonsandweights[ruleId].Weight;
    let reason = `AutoMod: ${automodreasonsandweights[ruleId].reason}`;
    if (level < 3) { totalWeight += 1; reason += ' while new to the server.'; }

    const bannable = level < 3 && (totalWeight >= 3 || punishments.length > 2);
    const activeWarns = punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0);
    const totalWarns = activeWarns + (!bannable ? totalWeight : 1);
    const { minutes, label } = Stages[Math.min(totalWarns - 1, Stages.length - 1)];
    let warnType = bannable ? 'Ban' : 'Warn';
    let durationMs = 0, durationStr: string | null = null;
    if (warnType === 'Warn' && minutes > 0) {
        durationMs = minutes * 60000;
        durationStr = minutes >= 60 ? `${Math.ceil(minutes / 60)} hour mute` : `${minutes} min mute`;
        warnType = 'Mute';
    }
    const finalMessage: any = await client.rest.post(Routes.channelMessages(channelId!), {
        body: {
            embeds: [{
                author: {
                    name: `${user!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : `${statusMap[warnType]?.cmd}`}`,
                    icon_url: user?.avatarURL() ?? user?.defaultAvatarURL
                },
                color: statusMap[warnType]!.color,
            }]
        } as APIMessage
    });
    const object = new ObjectId();
    const newPunishment = {
        _id: object, userId: user!.id, moderatorId: '1420927654701301951', reason,
        duration: durationMs, timestamp: Date.now(), active: 1,
        weight: !bannable ? totalWeight : 1, type: warnType, channel: channelId,
        refrence: `https://discord.com/channels/${guild.id}/${channelId}/${finalMessage.id}`,
        warns: totalWarns - 1
    };
    await usersCollection.updateOne({ userId: user!.id, guildId: guild.id }, { $push: { punishments: newPunishment as any } }, { upsert: true });
    const caseHistory = [...punishments, newPunishment]
        .filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick')
        .slice(0, 10)
        .map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null)
        .filter(Boolean);
    let dm = true
    try {
        const dmchannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: user!.id } }) as APIChannel;
        await client.rest.post(Routes.channelMessages(dmchannel.id), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                components: [{
                    type: ComponentType.Container,
                    accent_color: statusMap[warnType]!.color,
                    components: [{
                        type: ComponentType.Section,
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: `<@${user!.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${guild.name}](https://discord.com/channels/${guild.id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${guild.name}` : `in ${guild.name}`}`
                        }],
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: { url: guild.iconURL() }
                        }
                    },
                        {
                            type: ComponentType.TextDisplay,
                            content: `Reason: \`${reason}\` ${(['Ban', 'Kick'].includes(warnType)) ? '' : `Punishment: \`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nActive Warnings:\`${totalWarns}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`}`
                        },
                        ...(warnType == 'Ban' ? [{
                            type: ComponentType.ActionRow,
                            components: [{
                                type: ComponentType.Button,
                                style: ButtonStyle.Link,
                                label: "Appeal",
                                url: 'https://discord.gg/qMjjyXyYbr'
                            }]
                        }] : [{}])],
                }]
            } as APIMessage
        });
    } catch {
        dm = false;
    }
    const logEmbed: AnyComponentV2[] = [{
        type: ComponentType.Section,
        accessory: {
            type: ComponentType.Thumbnail,
            media: { url: client.rest.cdn.avatar('1420927654701301951', 'a96f0e3049ea9aae9798f45cc2479ebc') }
        },
        components: [{
            type: ComponentType.TextDisplay,
            content: `febot ${statusMap[warnType]!.log}\n\nuser: <@${user!.id}>  Channel:<#${channelId}>  History: ${caseHistory.join(' | ')} || "none"\n\nReason: \`${reason}\`\n\n ${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nWarns at log time: \`${activeWarns}\`\nNext Punishment: \`${label}\`\n\n ${dm ? 'User DMed ✅' : 'User DMed 🚫'}`}`
        }]
    }];
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

    await client.rest.post(Routes.channelMessages(warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: statusMap[warnType]!.color,
                components: logEmbed
            }]
        } as APIMessage
    });
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => { await usersCollection.updateOne({ userId: user!.id, guildId: guild.id }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] }); }, 86400000);
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
    const currentInvites = await guild.invites.fetch();
    const invite: APIInvite | { uses: number, inviter: string, code: string } | null = currentInvites.find((i: any) => i.uses > (Invites[i.code]?.uses || 0)) ?? Object.values(Invites).find((i: any) => !currentInvites.get(i.code));
    const inviter: APIGuildMember | null = invite ? await client.rest.get(Routes.guildMember(guild.id, typeof invite.inviter === 'string' ? invite.inviter : invite.inviter!.id)) as APIGuildMember : null
    const welcomeEmbed: AnyComponentV2[] = [
        {
            type: ComponentType.Section,
            components: [{
                type: ComponentType.TextDisplay,
                content: `<@${user.id}> joined the Server!\n\nDiscord Join Date: <t:${user.createdTimestamp / 1000}>\n\n${invite ? `Invited by: <@${inviter?.user.id} | ${invite.code}` : ''}`
            }],
            accessory: {
                type: ComponentType.Thumbnail,
                media: { url: user.avatarURL() ?? user.defaultAvatarURL }
            }
        }]
    const originalMessage = await client.rest.post(Routes.channelMessages(modChannels.welcomeChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: 0x00FF99,
                components: [welcomeEmbed, {
                    type: ComponentType.ActionRow,
                    components: [{
                        type: ComponentType.Button,
                        style: ButtonStyle.Danger,
                        custom_id: `ban_${user.id}_${invite && inviter && !inviter.roles.some((role: string) => staffroles.includes(role)) ? invite.code : 'none'}`,
                        label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}`
                    }]
                }]
            }]
        }
    }) as APIMessage
    if (Date.now() - member.user.createdTimestamp < 172800000) {
        await member.kick('Account less than 2 days old')
        await client.rest.post(Routes.channelMessages(modChannels.mutelogChannel), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                componets: [{
                    type: ComponentType.Container,
                    components: [{
                        type: ComponentType.Section,
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: `A member was auto-kicked \n\n**User:**<@${user.id}>\n\n**Reason:**New Account\n** Created:** <t:${member.user.createdTimestamp}:R>\n\n**Created on:**<t:${member.user.createdTimestamp}:R>`
                        }],
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: { url: user.avatarURL() ?? user.defaultAvatarURL }
                        }
                    }]
                }]
            }
        })
        return;
    }
    const dmChannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: user.id } }) as Channel;
    try {
        await client.rest.post(Routes.channelMessages(dmChannel.id), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                components: [{
                    type: ComponentType.Container,
                    accent_color: 0x00FF99,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel. Click on the invite: https://discord.gg/qMjjyXyYbr for the bot's key incase he cannot dm you.`
                        }
                    ]

                }]
            }
        })
    } catch {
        await appendFile("./log.log", `[Member Add] Error: ${user.id} does not have dms open`)
    }

    const persistentdata: WithId<Document> | null = await usersCollection.findOne({ userId: user.id, guildId: guild.id })
    if (!persistentdata && !user.bot) {
        await usersCollection.insertOne({ userId: user.id, guildId: guild.id, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], blacklist: [], avatar: member.user.avatarURL() ?? member.user.defaultAvatarURL, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [], nick: member.user.username, lastmessage: null, joinedTime: member.joinedTimestamp })
    } else {
            if (guild.id == "1231453115937587270")
                await client.rest.put(Routes.guildMemberRole(guild.id, user.id, `1463354464747524136`))
            await client.rest.post(Routes.channelMessages(generalchannels[0]), {
                body: {
                    flags: MessageFlags.IsComponentsV2,
                    components: [{
                        type: ComponentType.Container,
                        components: [
                            {
                                type: ComponentType.Section,
                                components: [{
                                    type: ComponentType.TextDisplay,
                                    content: `Everyone, Welcome <@${member?.user.id}> back to the server!\n\nDiscord Join Date: <t:${member.user.createdTimestamp / 1000}>`
                                }],
                                accessory: {
                                    type: ComponentType.Thumbnail,
                                    media: { url: member.user.avatarURL() ?? member.user.defaultAvatarURL },
                                    description: "User icon",
                                    spoiler: false
                                }
                            },


                        ]
                    }]
                }
            })
    }
        setTimeout(async () => {
            try {
                await client.rest.patch(Routes.channelMessage(originalMessage.channel_id, originalMessage.id), {
                body: {
                    flags: MessageFlags.IsComponentsV2,
                    components: [{
                        type: ComponentType.Container,
                        accent_color: 0x00FF99,
                        components: [welcomeEmbed, {
                            type: ComponentType.ActionRow,
                            components: [{
                                type: ComponentType.Button,
                                style: ButtonStyle.Danger,
                                custom_id: `ban_${user.id}_${invite && inviter && !inviter.roles.some((role: string) => staffroles.includes(role)) ? invite.code : 'none'}`,
                                label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}`,
                                disabled: true
                            }]
                        }]
                    }]
                }
            })
            } catch (err: any) {
                await appendFile("./log.log",
                    `[guildMemberAdd] Button-disable PATCH failed: ${JSON.stringify({ method: err.method, url: err.url, status: err.status, rawError: err.rawError })}\n`
                );
            }
        }, 15 * 60 * 1000)

})
client.on('guildMemberRemove', async (member) => {
    const { user, guild } = member;
    if (user.bot) { return }
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    await client.rest.post(Routes.channelMessages(modChannels.welcomeChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2, components: [{
                type: ComponentType.Container, components: [{
                    type: ComponentType.Section,
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `<@${user.id}> left the server.`
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: member.avatarURL() ?? member.user.defaultAvatarURL }
                    }
                }]
            }]
        }
    })
})
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const { guild, user, nickname, avatar } = newMember;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    await usersCollection.updateOne({ guildId: guild.id, userId: user.id }, { $set: { nick: nickname ?? user.username, avatar: avatar } });
    if (!oldMember || nickname === oldMember.nickname || newMember.user.username == nickname) return;
    await client.rest.post(Routes.channelMessages(modChannels.namelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: 0x4e85b6,
                components: [{
                    type: ComponentType.Section,
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `<@${user.id}> **changed their nickname**\n\n**Before:**\n${oldMember.nickname}\n\n**After:**\n${newMember.nickname ?? user.username}`
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: oldMember.avatarURL() ?? oldMember.user.defaultAvatarURL }
                    }
                }]
            }]
        } as APIMessage
    })
})
client.on('guildBanAdd', async (ban) => {
    const { user, guild } = ban;
    let dmed = true;
    const { Ban, modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { Ban: 1, modChannels: 1 } }) as Document
    if (Ban === user.id) { await guildconfigs.updateOne({ guildId: guild.id }, { $set: { ban: '' } }); return; }
    else {
        massban += 1;
        const auditLog = await guild.fetchAuditLogs({ limit: 1, user: user.id, type: AuditLogEvent.MemberBanAdd })
        const reason = auditLog.entries.first()?.reason ?? null;
        const userId = auditLog.entries.first()?.executorId
        await Bun.sleep(massban * 1000)
        try {
            const dmchannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: user.id } }) as APIChannel;
            await client.rest.post(Routes.channelMessages(dmchannel.id), {
                body: {
                    flags: MessageFlags.IsComponentsV2,
                    components: [{
                        type: ComponentType.Container,
                        accent_color: 0xd10000,
                        components: [{
                            type: ComponentType.Section,
                            accesory: {
                                type: ComponentType.Thumbnail,
                                media: { url: guild.iconURL() }
                            },
                            components: [{
                                type: ComponentType.TextDisplay,
                                content: `${user.username}, you were banned from [${guild.name}](https://discord.com/channels/${guild.id}).\n\n\nTo appeal this decision, please join our dedicated appeal server using the button below.\nReason: \`${reason}\``,

                            },
                            {
                                type: ComponentType.ActionRow,
                                components: [{
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Link,
                                    label: "Appeal",
                                    url: 'https://discord.gg/qMjjyXyYbr'
                                }]

                            }]
                        }],
                    }]
                }
            });
        } catch { dmed = false }
        await client.rest.post(Routes.channelMessages(modChannels.banlogChannel), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                componenets: [{
                    type: ComponentType.Container,
                    accent_color: 0xff3030,
                    components: [{
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: { url: guild.iconURL()! }
                        },
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: `Mass Ban Detected\n**Moderator <@${userId}> banned <@${user.id}>:\n\nID: <@${user.id}>\n\n**TAG:**${user.username}\n\n**Reason:**\`${reason}\`\n\n ${subtext(dmed ? 'User DMed ✅' : 'UserDmed ❌')}`,

                        },]
                    }]
                }]
            }
        })
        massban -= 1;
    }
})
client.on('guildBanRemove', async (ban) => {
    const { user, guild } = ban
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    const doc = await usersCollection.findOne({ userId: user.id, guildId: guild.id }, { projection: { punishments: 1 } }) as Document;
    const bans = (doc.punishments ?? []).filter((p: any) => p.type === 'Ban').sort((a: any, b: any) => b.timestamp - a.timestamp);
    await client.rest.post(Routes.channelMessages(modChannels.banlogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: 0x309eff,
                components: [{
                    type: ComponentType.Section,
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `A member was unbanned\n\n**User**: <@${user.id}>\n**Tag**:\`${user.username}\`\n**Reason**:\`${bans[0].reason}\``
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: user.avatar ? client.rest.cdn.avatar(user.id, user.avatar) : client.rest.cdn.defaultAvatar(6) }
                    }
                }]
            }]
        }
    }) as TextChannel
})
client.on('inviteCreate', async (invite) => {
    await guildconfigs.updateOne({ guildId: invite.guild!.id }, { $set: { [`Invites.${invite.code}`]: { uses: invite.uses, inviter: invite.inviter?.id ?? null, code: invite.code } } });
})
client.on('inviteDelete', async (invite) => {
    await guildconfigs.updateOne({ guildId: invite.guild!.id }, { $unset: { [`Invites.${invite.code}`]: "" } });
})
client.on('messageReactionAdd', async (reaction, user) => {
    const { message, emoji } = reaction;
    if (!message.guild || user.bot) return;
    const { messageConfigs } = await guildconfigs.findOne({ guildId: message.guild!.id }, { projection: { messageConfigs: 1 } }) as Document;
    const config = Object.values(messageConfigs).find((info: any) => info?.messageId === message.id
    ) as { reactions: { emoji: string; roleId: string | string[] }[]; single: boolean } | undefined;
    if (!config) return;

    const { reactions, single } = config;
    const entry = reactions.find(e => e.emoji === (emoji.id ?? emoji.name));
    if (!entry) return;

    const roleID = entry.roleId;
    const { blacklist } = await usersCollection.findOne({ userId: user.id, guildId: message.guild!.id }, { projection: { blacklist: 1 } }) as WithId<Document>;

    const roleIds = Array.isArray(roleID) ? roleID : [roleID];
    if (blacklist?.length && roleIds.some(id => blacklist.includes(id))) return;
    const member = await client.rest.get(Routes.guildMember(message.guild.id, user.id)) as APIGuildMember;
    if (single) {
        const groupRoleIds = reactions.flatMap(r => Array.isArray(r.roleId) ? r.roleId : [r.roleId]);
        const staleRoleIds = groupRoleIds.filter(id => !roleIds.includes(id) && member.roles.includes(id));
        await Promise.all(staleRoleIds.map(id => client.rest.delete(Routes.guildMemberRole(message.guild!.id, user.id, id))));
    }
    await Promise.all(roleIds.map(id => client.rest.put(Routes.guildMemberRole(message.guild!.id, user.id, id))));
});
client.on('messageReactionRemove', async (reaction, user) => {
    const { message, emoji } = reaction;
    if (!message.guild || user.bot) return;
    const { messageConfigs } = await guildconfigs.findOne({ guildId: message.guild!.id }, { projection: { reactions: 1, Data: 1, messageConfigs: 1 } }) as Document
    if (!Object.values(messageConfigs).find((info: any) => info.messageId === message.id)) return;
    const config = Object.values(messageConfigs).find((info: any) => info.messageId === message.id) as any;
    const { reactions } = config
    const entry = reactions.find((entry: { emoji: string }) => entry.emoji === (emoji.id! ?? emoji.name!));
    if (!entry) return;
    const roleID = entry.roleId
    const { blacklist } = await usersCollection.findOne({ userId: user.id, guildId: message.guild!.id }, { projection: { blacklist: 1 } }) as WithId<Document>;
    if (blacklist && blacklist.length > 0 && blacklist.includes(roleID)) return;
    const roleIds = Array.isArray(roleID) ? roleID : [roleID];
    await Promise.all(
        roleIds.map((id: string) => client.rest.delete(Routes.guildMemberRole(message.guild!.id, user.id, id)))
    );
})
client.on('messageDelete', async (deletedData) => {
    const { id, channelId, guildId, stickers, attachments, author, content } = deletedData;
    if (deletedData.partial || !author || author.bot) return;
    const imageAttachments = attachments
        .filter(att => att.contentType?.startsWith('image/'))
        .map(att => att.proxyURL);
    const { modChannels } = await guildconfigs.findOne({ guildId }, { projection: { modChannels: 1 } }) as Document;
    if (!modChannels?.deletedlogChannel) return;
    const bodyComponents: AnyComponentV2[] = [
        {
            type: ComponentType.Section,
            components: [{
                type: ComponentType.TextDisplay,
                content: `Message by ${author.username} was deleted in <#${channelId}>\n\n${content || 'No text content'}`
            }],
            accessory: {
                type: ComponentType.Thumbnail,
                media: { url: author.avatar ? client.rest.cdn.avatar(author.id, author.avatar) : client.rest.cdn.defaultAvatar(6) }
            }
        }];

    if (imageAttachments.length > 0) {
        bodyComponents.push({
            type: ComponentType.MediaGallery,
            items: imageAttachments.map(url => ({ media: { url } }))
        });
    }
    if (stickers.size > 0) {
        bodyComponents.push({
            type: ComponentType.MediaGallery,
            items: [{ media: { url: stickers.first()!.url } }]
        })
    }
    bodyComponents.push({
        type: ComponentType.Section,
        components: [{ type: ComponentType.TextDisplay, content: `ID: ${id}` }],
        accessory: {
            type: ComponentType.Button,
            style: ButtonStyle.Link,
            label: 'Event link',
            url: `https://discord.com/channels/${guildId}/${channelId}/${id}`
        }
    })
    await client.rest.post(Routes.channelMessages(modChannels.deletedlogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: 0xf03030,
                components: bodyComponents
            }]
        } 
    })
})
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage || oldMessage.content == newMessage.content || newMessage.author.bot) return;
    const { author, id, channelId, content, guildId } = newMessage;
    const { modChannels } = await guildconfigs.findOne({ guildId: newMessage.guildId }, { projection: { modChannels: 1 } }) as Document
    await client.rest.post(Routes.channelMessages(modChannels.updatedlogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: 0x309eff,
                components: [{
                    type: ComponentType.Section,
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `${author!.username} edited a message in <#${channelId}>\n\n **Before:**\n${oldMessage.content || ''}\n\n **After:**\n${content || ''}`
                    }],
                    accessory: { type: ComponentType.Thumbnail, media: { url: author.avatarURL ?? author.defaultAvatarURL } }
                },
                {
                    type: ComponentType.Section,
                    components: [{ type: ComponentType.TextDisplay, content: `ID: ${id}` }],
                    accessory: {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        label: 'Event Link',
                        url: `https://discordapp.com/channels/${guildId}/${channelId}/messages/${id}`
                    }
                }],
            }]
        }
    })
})
client.on('messageCreate', async (message) => {
    const { author, guildId, channelId, member, content, attachments, type, mentions, guild } = message;
    if (author.bot == true || !guildId || type === MessageType.ChatInputCommand || type === MessageType.UserJoin) return;
    const { publicChannels, responses, staffroles, generalchannels, automodsettings: { messagereasonsandweights, messagethreshold, Duplicatespamthreshold, mediathreshold, spamthreshold, capsthreshold }, count, lastuser, Stages, modChannels } = await guildconfigs.findOne({ guildId: guildId }, { projection: { publicChannels: 1, responses: 1, staffroles: 1, mediaexclusions: 1, automodsettings: 1, count: 1, lastuser: 1, baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1, generalchannels: 1, Stages: 1, modChannels: 1 } }) as Document
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
        const triggers = Object.entries(responses)
        if (!triggers) {
            appendFile("./log.log", `Responses not setup/found for ${guild!.name}`)
        } else {
            for (const [trigger, text] of triggers)
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
    }
    const key = keyify(messageWords)
    const capsRatio = messageWords.length > 20
        ? (messageWords.match(/[A-Z]/g)?.length ?? 0) / messageWords.length
        : 0;
    const { automodMarks, punishments, level } = await usersCollection.findOneAndUpdate(
        { userId: author.id, guildId: guildId }, [
        {
            $set: {
                previoustime: { $ifNull: ["$lastmessage", 0] },
                markDuplicateSpam: { $gt: [{ $add: [{ $ifNull: [`$duplicateCounts.${key}`, 0] }, changed ? 1 : 0] }, Duplicatespamthreshold] },
                markMessageThreshold: { $gte: [{ $add: ["$total", 1] }, messagethreshold] },
                markInactive30: { $gte: [{ $subtract: [Date.now(), { $ifNull: ["$lastmessage", 0] }] }, 1800000] },
                markMediaViolation: { $and: [hasMedia, { $gt: [{ $add: ["$mediaCount", hasMedia ? 1 : 0] }, mediathreshold] }, { $lt: [{ $add: ["$total", 1] }, messagethreshold] }] },
                markGeneralSpam: { $gt: [{ $size: { $filter: { input: { $concatArrays: ["$timestamps", [Date.now().toString()]] }, cond: { $lt: [{ $subtract: [Date.now(), { $toLong: "$$this" }] }, 8000] } } } }, spamthreshold] }
                }
            },
            { $set: { isModReset: { $or: ["$markDuplicateSpam", "$markMessageThreshold", "$markInactive30"] } } },
            {
                $set: {
                    avatar: member!.user.avatarURL() ?? member!.user.defaultAvatarURL,
                    totalmessages: { $add: ["$totalmessages", 1] },
                    total: { $cond: ["$isModReset", 0, { $add: ["$total", 1] }] },
                    mediaCount: { $cond: ["$isModReset", 0, { $add: ["$mediaCount", hasMedia ? 1 : 0] }] },
                    duplicateCounts: { $cond: ["$isModReset", {}, changed ? { $mergeObjects: ["$duplicateCounts", { [key]: { $add: [{ $ifNull: [`$duplicateCounts.${key}`, 0] }, 1] } }] } : "$duplicateCounts"] },
                    timestamps: { $slice: [{ $concatArrays: ["$timestamps", [Date.now().toString()]] }, -15] },
                    lastmessage: Date.now()
                }
            },
        {
            // marks assigned from the pre-reset booleans captured in stage 1, untouched by stage 3's reset
            $set: { automodMarks: { everyonePing: mentions.everyone, duplicateSpam: "$markDuplicateSpam", mediaViolation: "$markMediaViolation", generalspam: "$markGeneralSpam", capSpam: capsRatio > capsthreshold } }
        },
        { $unset: ["isModReset", "markDuplicateSpam", "markMessageThreshold", "markInactive30", "markMediaViolation", "markGeneralSpam"] }
    ], { returnDocument: 'after', projection: { automodMarks: 1, punishments: 1, level: 1 } }) as Document;
    await grantXp({ Id: author.id, source: 'discord', roles: member!.roles.cache, guildId: guildId, channel: channelId });
    const isNewUser = Date.now() - member?.joinedTimestamp! < 2 * 24 * 60 * 60 * 1000 && level < 3
    if (isstaff) return;
    if (mentions.everyone) await message.delete();
    const activeChecks = Object.keys(messagereasonsandweights).filter((key: string) => automodMarks[key]).map(key => ({ ...messagereasonsandweights[key] })) as Array<{ reason: string, Weight: number }>;
    let totalWeight = activeChecks.reduce((acc, check) => acc + check.Weight, 0) as number;
    if (totalWeight == 0) return;
    await usersCollection.updateOne({ guildId: guildId, userId: member!.user.id }, {
        $set: { 'automodMarks.everyonePing': false, 'automodMarks.duplicateSpam': false, 'automodMarks.mediaViolation': false, 'automodMarks.generalspam': false, 'automodMarks.capSpam': false }
    })
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const bannable = isNewUser && (totalWeight >= 3 || mentions.everyone)

    const activeWarns = punishments.length > 0 ? punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0) : 0;
    const totalWarns = activeWarns + totalWeight;
    let warnType = bannable ? 'Ban' : 'Warn';
    let durationMs = 0, durationStr = null;
    const stage = Stages[Math.min(totalWarns - 1, Stages.length - 1)];
    if (warnType === 'Warn' && stage.minutes > 0) {
        durationMs = stage.minutes * 60000;
        durationStr = stage.minutes >= 60 ? `${Math.ceil(stage.minutes / 60)} hour mute` : `${stage.minutes} min mute`;
        warnType = 'Mute';
    }
    const finalMessage: any = await client.rest.post(Routes.channelMessages(channelId!), {
        body: {
            embeds: [{
                author: {
                    name: `${member!.user!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : `${statusMap[warnType]?.cmd}`}`,
                    icon_url: member!.user?.avatarURL() ?? member!.user?.defaultAvatarURL
                },
                color: statusMap[warnType]!.color,
            }]
        } as APIMessage
    });
    const object = new ObjectId();
    const newPunishment = { _id: object, userId: author.id, moderatorId: '1420927654701301951', reasonText, duration: durationMs, timestamp: Date.now(), active: 1, weight: !bannable ? totalWeight : 1, type: warnType, guildId, channel: channelId, refrence: `https://discord.com/channels/${guildId}/${channelId}/${finalMessage.id}`, warns: totalWarns - 1 };
    await usersCollection.updateOne({ userId: author.id, guildId }, { $push: { punishments: newPunishment as any } });
    const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);

    let dmFailed = false;
    try {
        const dmchannel = await client.rest.post(Routes.userChannels(), { body: { recipient_id: author.id } }) as APIChannel;
        await client.rest.post(Routes.channelMessages(dmchannel.id), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                components: [{
                    type: ComponentType.Container,
                    accent_color: statusMap[warnType]!.color,
                    components: [{
                        type: ComponentType.Section,
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: { url: message.guild?.iconURL() }
                        },
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: `<@${author.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${message.guild!.name}](https://discord.com/channels/${guildId}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${message.guild!.name}` : `in ${message.guild!.name}`}`
                        },
                            { type: ComponentType.Separator },
                            {
                                type: ComponentType.Section,
                                components: [{
                                    type: ComponentType.TextDisplay,
                                    content: `Reason: \`${reasonText}\` ${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${totalWeight} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nActive Warnings: \`${totalWarns}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`}`
                                }],
                                ...(warnType === 'Ban' ? {
                                    accessory: {
                                        type: ComponentType.Button,
                                        style: ButtonStyle.Link,
                                        label: "Appeal",
                                        url: 'https://discord.gg/qMjjyXyYbr'
                                    }
                                } : {}),
                            }]
                    }]
                }]

            } as APIMessage
        })
    } catch { dmFailed = true; }
    const logEmbed: AnyComponentV2[] = [{
        type: ComponentType.Section,
        components: [{
            type: ComponentType.TextDisplay,
            content: `<@${client.user?.id}> ${statusMap[warnType]!.log}\n\n user:<@${author.id}>\nChannel:<#${channelId}>\nHistory: ${caseHistory.join(' | ') || "none"}\n\nReason:  \`${reasonText}\`\n${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nWarns at log time: \`${activeWarns}\`\nNext Punishment: \`${stage.label}\`\n\n${subtext(dmFailed ? 'User DMed 🚫' : 'User DMed ✅')}`}`
        }],
        accessory: {
            type: ComponentType.Thumbnail,
            media: { url: author.avatarURL() ?? author.defaultAvatarURL }
    }
    }];
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
    await logChannel.send({ flags: MessageFlags.IsComponentsV2, components: [{ type: ComponentType.Container, accent_color: statusMap[warnType]!.color, components: logEmbed }] })
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne({ userId: author.id, guildId }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
        }, 86400000);
    }
});
client.on('voiceStateUpdate', async (oldState, newState) => {
    const { guild, channelId, member } = newState;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    if (oldState.channelId === channelId) return;
    await client.rest.post(Routes.channelMessages(modChannels.voicelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: channelId !== null ? 0x305830 : 0x8b0000,
                components: [
                    {
                        type: ComponentType.Section,
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: channelId !== null ? `${member?.user.username} joined <#${channelId}>.` : `${member?.user.username} left <#${oldState.channelId}>`
                        }],
                        accessory: {
                            type: ComponentType.Thumbnail,
                            media: { url: member!.user.avatarURL() ?? member!.user.defaultAvatarURL }
                        }
                    }
                ]
            }]
        } as APIMessage
    })
})
client.on('guildUpdate', async (oldGuild, newGuild) => {
    const existing = await guildconfigs.findOne({ guildId: oldGuild.id }, { projection: { ownerId: 1 } }) as Document;
    if (newGuild.ownerId == existing.ownerId) return;
    else await guildconfigs.updateOne({ guildId: newGuild.id }, { $set: { ownerId: newGuild.ownerId } })
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