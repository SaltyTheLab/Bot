import { usersCollection, guildconfigs, ws } from './Database';
import { ObjectId, type Document, type WithId } from 'mongodb';
import { appendFile } from 'node:fs/promises'
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { ComponentType, ButtonStyle, MessageType, ActivityType, PresenceUpdateStatus, Client, Options, Role, Routes, Partials, GatewayIntentBits, TextChannel, MessageFlags, type AnyComponentV2, subtext, GuildMember, GuildMemberFlags, Invite, type APIMessage } from 'discord.js'
import { createHash } from 'crypto'
interface xp { Id: string | GuildMember; channel?: TextChannel | string; guildId?: string };
type DbInvite = Record<string, { uses: number; id: string; code: string }>;
process.on("uncaughtException", async (err: any) => {
    const intpid = parseInt(await Bun.file("./interpid.txt").text())
    await appendFile("./log.log",
        `[root] Uncaught exception @ ${Date.now()}: method: ${err.method}, url: ${err.url}, status: ${err.status}, code: ${err.code}\n 
        rawError: ${JSON.stringify(err.rawError)}\n`
    )
    await client.destroy();
    Bun.spawn(["powershell", "-ExecutionPolicy", "Bypass", "-File", "C:\\Users\\micha\\Desktop\\Bot\\restart.ps1", "-BotPid", `${process.pid}`, "-intpid", `${intpid}`], { stderr: "pipe", stdout: 'pipe', stdin: 'pipe' })
})
process.on("unhandledRejection", async (reason: any) => {
    const intpid = parseInt(await Bun.file("./interpid.txt").text())
    appendFile("./log.log", `[root] unhandled Rejection: ${JSON.stringify(reason)}\n`)
    client.destroy();
    Bun.spawn(["powershell", "-ExecutionPolicy", "Bypass", "-File", "C:\\Users\\micha\\Desktop\\Bot\\restart.ps1", "-BotPid", `${process.pid}`, "-intpid", `${intpid}`], { stderr: "pipe", stdout: 'pipe', stdin: 'pipe' });
});
const authProvider = new RefreshingAuthProvider({ clientId: Bun.env.TWITCH_ID!, clientSecret: Bun.env.TWITCH_SECRET! });
let massban = 0;
const doc = await ws.findOne({}, { projection: { twitchbot: 1, twitchaccess: 1, twitchrefresh: 1, twitchexpires: 1, twitchobtained: 1 } }) as any;
if (!doc?.twitchbot) throw new Error('No Twitch bot tokens found — run get-token.ts first.');
const client = new Client({
    intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildModeration | GatewayIntentBits.GuildExpressions | GatewayIntentBits.GuildIntegrations | GatewayIntentBits.GuildWebhooks | GatewayIntentBits.GuildVoiceStates | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildMessageReactions | GatewayIntentBits.MessageContent,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    presence: { activities: [{ name: `for 0d 0h 0m 0s`, type: ActivityType.Watching, }], status: 'online', afk: false },
    makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings }),
    sweepers: { ...Options.DefaultSweeperSettings }
});
const TwitchClient = new ChatClient({ authProvider, channels: ['saltytbsl'] });
authProvider.addUser(doc.twitchbot, { accessToken: doc.twitchaccess, scope: ['chat:read', 'chat:edit'], refreshToken: doc.twitchrefresh, expiresIn: doc.twitchexpires, obtainmentTimestamp: doc.twitchobtained, }, ['chat']);
authProvider.onRefresh(async (userId, newTokenData) => {
    await ws.updateOne({}, { $set: { twitchaccess: newTokenData.accessToken, twitchrefresh: newTokenData.refreshToken, twitchexpires: newTokenData.expiresIn, twitchobtained: Date.now(), } });
});
TwitchClient.connect();
TwitchClient.onAuthenticationSuccess(() => { appendFile("./log.log", "Febot is listening on twitch!\n") })

async function inactiveusers() {
    const list = await usersCollection.find({ level: 1, totalmessages: 0, guildId: '1231453115937587270' }, { projection: { userId: 1, _id: 0 } }).toArray()
    const userIds: string[] = list.map(doc => doc.userId);
    for (const id of userIds) {
        let member: null | GuildMember = null
        try {
            member = await client.rest.get(Routes.guildMember('1231453115937587270', id)) as GuildMember;
            if (member?.roles.cache.size === 0)
            await client.rest.delete(Routes.guildMember('1231453115937587270', id))
        } catch {
            appendFile("./log.log", `${id} is no longer in guild.`)
        }
        await Bun.sleep(750);
    }
    await usersCollection.deleteMany({ guildId: '1231453115937587270', userId: { $in: userIds } });
}
async function grantXp({ Id, channel, guildId }: xp) {
    const { baseMultiplier, exponent, flatOffset, roundToNearest } = await guildconfigs.findOne({ guildId: guildId }, { projection: { baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1 } }
    ) as any;

    const { xp, level } = await usersCollection.findOneAndUpdate(
        Id instanceof GuildMember ? { userId: Id.user.id, guildId: guildId } : { twitchId: Id }, { $inc: { xp: 20 } }, { returnDocument: 'after', projection: { xp: 1, level: 1, } }) as any;
    if (level < 100 && xp >= Math.round((level ** exponent * baseMultiplier + flatOffset) / roundToNearest)) {
        await usersCollection.updateOne(Id instanceof GuildMember ? { userId: Id.user.id, guildId: guildId } : { twitchId: Id }, { $inc: { level: 1 }, $set: { xp: 0 } });
        const rank = await usersCollection.countDocuments({ guildId: guildId, $or: [{ level: { $gt: level + 1 } }, { level: level + 1, xp: { $gt: xp } }] });
        if (Id instanceof GuildMember && channel instanceof TextChannel) {
            if (parseInt(level) + 1 > 2 && !Id.roles.cache!.has("1334238580914131026") && guildId == '1231453115937587270')
                await client.rest.put(Routes.guildMemberRole(guildId, Id.id, '1334238580914131026'))
            channel!.send({ embeds: [{ author: { name: Id?.user.username, icon_url: Id.user.avatarURL() ?? Id.user.defaultAvatarURL }, color: 0x00AE86, footer: { text: `${Id!.user.username} reached level ${level + 1}! You are now #${rank + 1} in the server` } }] })
        }
        else {
            TwitchClient.say(channel! as string, `<@${Id}> reached level ${level + 1}! You are now #${rank + 1}!`)
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
    await grantXp({ Id: msg.userInfo.userId, channel: channel });
});
const statusMap: Record<string, { cmd: string, log: string, dm: string, color: number }> = {
    Ban: { cmd: 'was banned', log: 'banned a member', dm: `you were banned from`, color: 0xd10000 },
    Kick: { cmd: 'was kicked', log: 'kicked a member', dm: `you were kicked from`, color: 0x838383 },
    Mute: { cmd: 'was issued a mute', log: 'muted a member', dm: `you were given a`, color: 0xff4444 },
    Warn: { cmd: 'was issued a warning', log: 'warned a member', dm: `you were given a warning`, color: 0xffcc00 }
};
let presenceInterval: NodeJS.Timeout | undefined;
function startStatusLoop() {
    clearInterval(presenceInterval);
    presenceInterval = setInterval(() => {
        client.user?.setPresence({
            activities: [{
                name: `for ${Math.floor(client.uptime! / 86400000)}d ${Math.floor((client.uptime! / 3600000) % 24)}h ${Math.floor((client.uptime! / 60000) % 60)}m ${Math.floor((client.uptime! / 1000) % 60)}s`,
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
        if (!await guildconfigs.findOne({ guildId: id })) continue;
        const guildinvites = await invites.fetch();
        await guildconfigs.updateOne({ guildId: id }, { $set: { icon: guild.iconURL(), name: name, ownerId: ownerId, Invites: Object.fromEntries(guildinvites.map(i => [i.code, { uses: i.uses, id: i.inviter!.id, code: i.code }])) } })
    }
})
client.on('autoModerationActionExecution', async (action) => {
    const { guild, channel, ruleId, user, member } = action;
    const { level, punishments } = await usersCollection.findOne({ userId: user!.id, guildId: guild.id }, { projection: { level: 1, punishments: 1 } }) as Document;;
    const { automodsettings: { automodreasonsandweights }, Stages, modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { automodsettings: 1, Stages: 1, modChannels: 1 } }) as Document;
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
    const finalMessage = await (channel as TextChannel).send({
        embeds: [{
            author: {
                name: `${user!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : `${statusMap[warnType]?.cmd}`}`,
                icon_url: user?.avatarURL() ?? user?.defaultAvatarURL
            },
            color: statusMap[warnType]!.color,
        }]
    })
    const object = new ObjectId();
    const newPunishment = {
        _id: object, userId: user!.id, moderatorId: '1420927654701301951', reason,
        duration: durationMs, timestamp: Date.now(), active: 1,
        weight: !bannable ? totalWeight : 1, type: warnType, channel: channel!.id,
        refrence: `https://discord.com/channels/${guild.id}/${channel!.id}/${finalMessage.id}`,
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
        user!.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
                {
                    type: ComponentType.Container,
                    accent_color: statusMap[warnType]!.color,
                    components: [
                        {
                            type: ComponentType.Section,
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: `<@${user!.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${guild.name}](https://discord.com/channels/${guild.id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${guild.name}` : `in ${guild.name}`}`
                                }
                            ],
                            accessory: { type: ComponentType.Thumbnail, media: { url: guild.iconURL()! } }
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `Reason: \`${reason}\` ${(['Ban', 'Kick'].includes(warnType)) ? '' : `Punishment: \`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nActive Warnings:\`${totalWarns}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`}`
                        },
                        ...(warnType == 'Ban' ? [{
                            type: ComponentType.Section as const,
                            components: [{
                                type: ComponentType.TextDisplay as const,
                                content: 'Click on the right side/below to go to the server:'
                            }],
                            accessory: {
                                type: ComponentType.Button as const,
                                style: ButtonStyle.Link as const,
                                label: "Appeal",
                                url: 'https://discord.gg/qMjjyXyYbr'
                            }
                        }] : [])],
                }]
        })
    } catch {
        dm = false;
    }
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
                components: [{
                    type: ComponentType.Section,
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: client.rest.cdn.avatar('1420927654701301951', 'a96f0e3049ea9aae9798f45cc2479ebc') }
                    },
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `febot ${statusMap[warnType]!.log}\n\nuser: <@${user!.id}>  Channel:<#${channel!.id}>  History: ${caseHistory.join(' | ')} || "none"\n\nReason: \`${reason}\`\n\n ${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nWarns at log time: \`${activeWarns}\`\nNext Punishment: \`${label}\`\n\n ${dm ? 'User DMed ✅' : 'User DMed 🚫'}`}`
                    }]
                }]
            }]
        }
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
    await guildconfigs.updateOne({ guildId: id }, { $set: { icon: guild.iconURL(), name: name, ownerId: ownerId, Invites: Object.fromEntries(guildinvites.map(i => [i.code, { uses: i.uses, inviter: i.inviter!.id, code: i.code }])) } })
})
client.on('guildMemberAdd', async (member) => {
    const { guild, user, joinedTimestamp, flags } = member;
    const { modChannels: { welcomeChannel, mutelogChannel }, generalchannels, Invites } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1, staffroles: 1, generalchannels: 1, Invites: 1 } }) as WithId<Document>;
    const currentInvites = await guild.invites.fetch();
    const invite: Invite | DbInvite | undefined = currentInvites.find((i: any) => i.uses > (Invites[i.code]?.uses || 0)) ?? Object.values(Invites)?.find((i: any) => !currentInvites.get(i!.code!)) ?? undefined;
    const inviter: string | undefined | { uses: number; id: string; code: string } = invite instanceof Invite ? invite?.inviter?.id : invite && invite satisfies DbInvite ? invite!.id : undefined;
    const originalMessage = await client.rest.post(Routes.channelMessages(welcomeChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container, accent_color: 0x00FF99,
                components: [
                    {
                        type: ComponentType.Section,
                        components: [{ type: ComponentType.TextDisplay, content: `<@${user.id}> joined the Server!\n\nDiscord Join Date: <t:${Math.floor(user.createdTimestamp / 1000)}>` }],
                        accessory: { type: ComponentType.Thumbnail, media: { url: user.avatarURL() ?? user.defaultAvatarURL } }
                    }, { type: ComponentType.Separator },
                    {
                        type: ComponentType.Section,
                        components: [{ type: ComponentType.TextDisplay, content: subtext(`${invite instanceof Invite || (invite && invite satisfies DbInvite) ? `Invited by: <@${inviter}> | ${invite?.code}` : 'No Invite'}`), }],
                        accessory: { type: ComponentType.Button, style: ButtonStyle.Danger, custom_id: `ban_${user.id}_${invite instanceof Invite && inviter ? invite?.code : 'none'}`, label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}` }
                    }],
            }]
        }
    }) as APIMessage;
    if (Date.now() - user.createdTimestamp < 172800000) {
        await member.kick('Account less than 2 days old');
        await client.rest.post(Routes.channelMessages(mutelogChannel), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                components: [{
                    type: ComponentType.Container,
                    components: [{
                        type: ComponentType.Section,
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: `A member was auto-kicked \n\n**User:**<@${user.id}>\n\n**Reason:**New Account\n** Created:** <t:${user.createdTimestamp}:R>\n\n**Created on:**<t:${Math.floor(user.createdTimestamp / 1000)}:R>`
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
    try {
        user.send({
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: 0x00FF99,
                components: [
                    { type: ComponentType.TextDisplay, content: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.` }]
            }]
        })
    } catch {
        await appendFile("./log.log", `[Member Add] Error: ${user.id} does not have dms open/channel cannot be created.`)
    }
    if (!flags.has(GuildMemberFlags.DidRejoin) && !user.bot) {
        await usersCollection.insertOne({ userId: user.id, guildId: guild.id, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], blacklist: [], avatar: user.avatarURL() ?? user.defaultAvatarURL, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [], nick: user.username, lastmessage: null, joinedTime: joinedTimestamp })
    } else {
            if (guild.id == "1231453115937587270")
                await client.rest.put(Routes.guildMemberRole(guild.id, user.id, `1463354464747524136`))
        await client.rest.post(Routes.channelMessages(generalchannels[0]!), {
                body: {
                    flags: MessageFlags.IsComponentsV2,
                    components: [{
                        type: ComponentType.Container,
                        components: [
                            {
                                type: ComponentType.Section,
                                components: [{
                                    type: ComponentType.TextDisplay,
                                    content: `Everyone, Welcome <@${user.id}> back to the server!\n\nDiscord Join Date: <t:${Math.floor(user.createdTimestamp / 1000)}>`
                                }],
                                accessory: {
                                    type: ComponentType.Thumbnail,
                                    media: { url: user.avatarURL() ?? user.defaultAvatarURL },
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
                await client.rest.patch(Routes.channelMessage(welcomeChannel, originalMessage.id), {
                body: {
                    allowed_mentions: { "parse": [] },
                    flags: MessageFlags.IsComponentsV2,
                    components: [{
                        type: ComponentType.Container,
                        accent_color: 0x00FF99,
                        components: [{
                            type: ComponentType.Section,
                            components: [{
                                type: ComponentType.TextDisplay,
                                content: `<@${user.id}> joined the Server!\n\nDiscord Join Date: <t:${Math.floor(user.createdTimestamp / 1000)}>`
                            }],
                            accessory: {
                                type: ComponentType.Thumbnail,
                                media: { url: user.avatarURL() ?? user.defaultAvatarURL }
                            }
                        },
                            {
                                type: ComponentType.Section,
                                components: [{
                                    type: ComponentType.TextDisplay,
                                    content: subtext(`${invite ? `Invited by: <@${inviter}> | ${invite?.code}` : 'No Invite'}`),
                                }],
                                accessory: {
                                    type: ComponentType.Button,
                                    style: ButtonStyle.Danger,
                                    custom_id: `ban_${user.id}_${invite && inviter ? invite?.code : 'none'}`,
                                    label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}`
                                }
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
                        content: `<@${user.id}> left the server.\n\nJoined ${guild.name}: <t:${Math.floor(member.joinedTimestamp! / 1000)}>`
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: user.avatarURL() ?? user.defaultAvatarURL }
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
                        content: `< @${user.id} > ** changed their nickname **\n\n ** Before:**\n${oldMember.nickname}\n\n ** After:**\n${newMember.nickname ?? user.username}`
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: newMember.user.avatarURL() ?? newMember.user.defaultAvatarURL }
                    }
                }]
            }]

        }
    })
})
client.on('guildBanAdd', async (ban) => {
    const { user, guild } = ban;
    let dmed = true;
    const { Ban, modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { Ban: 1, modChannels: 1 } }) as Document
    if (Ban === user.id) { await guildconfigs.updateOne({ guildId: guild.id }, { $set: { ban: '' } }); return; }
    else {
        massban += 1;
        const result = await usersCollection.aggregate([
            { $match: { guildId: guild.id, userId: user.id } },
            {
                $project: {
                    punishments: {
                        $sortArray: {
                            input: {
                                $filter: {
                                    input: "$punishments",
                                    as: "p",
                                    cond: { $eq: ["$$p.type", "Ban"] } // swap for your actual filter condition
                                }
                            },
                            sortBy: { timestamp: -1 }
                        }
                    }
                }
            }
        ]).toArray();
        const { punishments } = result[0] as Document;
        await Bun.sleep(massban * 1000)
        try {
            await user.send({
                flags: MessageFlags.IsComponentsV2,
                components: [{
                    type: ComponentType.Container,
                    accent_color: 0xd10000,
                    components: [{
                        type: ComponentType.Section,
                        accessory: { type: ComponentType.Thumbnail, media: { url: guild.iconURL()! } },
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: `${user.username}, you were banned from [${guild.name}](https://discord.com/channels/${guild.id}).\n\n\nTo appeal this decision, please join our dedicated appeal server using the button below.\nReason: \`${punishments[0].reason}\``,

                        }]
                    },
                        {
                            type: ComponentType.Section,
                            components: [{
                                type: ComponentType.TextDisplay,
                                content: "Click the button below/on the right to go to the Server:"
                            }],
                            accessory: {
                                type: ComponentType.Button,
                                style: ButtonStyle.Link,
                                label: "Appeal",
                                url: 'https://discord.gg/qMjjyXyYbr'
                            }
                        }
                    ],
                }]
            })
        } catch { dmed = false }
        await client.rest.post(Routes.channelMessages(modChannels.banlogChannel), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                components: [{
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
                            content: `Mass Ban Detected\n**Moderator <@${punishments[0].moderatorId}> banned <@${user.id}>:\n\nID: <@${user.id}>\n\n**TAG:**${user.username}\n\n**Reason:**\`${punishments[0].reason}\`\n\n ${subtext(dmed ? 'User DMed ✅' : 'UserDmed ❌')}`,
                        },]
                    }]
                }]
            }
        })
        massban -= 1;
    }
})
client.on('guildBanRemove', async (ban) => {
    const { user, guild, reason } = ban
    const { modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
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
                        content: `A member was unbanned\n\n**User**: <@${user.id}>\n**Tag**:\`${user.username}\`\n**Reason**:\`${reason}\``
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: user.avatarURL() ?? user.defaultAvatarURL }
                    }
                }]
            }]
        }

    })
})
client.on('inviteCreate', async (invite) => {
    await guildconfigs.updateOne({ guildId: invite.guild!.id }, { $set: { [`Invites.${invite.code}`]: { uses: invite.uses, inviter: invite.inviter!.id, code: invite.code } } });
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
    const { blacklist } = await usersCollection.findOne({ userId: user.id, guildId: message.guild!.id }, { projection: { blacklist: 1 } }) as WithId<Document>;

    const roleIds = Array.isArray(entry.roleId) ? entry.roleId : [entry.roleId];
    if (blacklist?.length && roleIds.some(id => blacklist.includes(id))) return;
    const member = await message.guild.members.fetch(user.id);
    if (single) {
        const groupRoleIds = reactions.flatMap(r => Array.isArray(r.roleId) ? r.roleId : [r.roleId]);
        const staleRoleIds = groupRoleIds.filter(id => !roleIds.includes(id) && member.roles.cache.get(id));
        await Promise.all(staleRoleIds.map(id => message.member?.roles.add(id)));
    }
    await Promise.all(roleIds.map(id => message.member?.roles.add(id)));
});
client.on('messageReactionRemove', async (reaction, user) => {
    const { message, emoji } = reaction;
    if (!message.guild || user.bot) return;
    const { messageConfigs } = await guildconfigs.findOne({ guildId: message.guild!.id }, { projection: { messageConfigs: 1 } }) as Document
    const config: { reactions: { emoji: string; roleId: string | string[] }[]; } | undefined = Object.values(messageConfigs).find((info: any) => info.messageId === message.id) ?? undefined;
    if (!config) return;
    else {
    const { reactions } = config
    const entry = reactions.find((entry: { emoji: string }) => entry.emoji === (emoji.id! ?? emoji.name!));
    if (!entry) return;
        const roleIds = Array.isArray(entry.roleId) ? entry.roleId : [entry.roleId];
        await Promise.all(roleIds.map((id: string) => message.member?.roles.remove(id)));
    }
})
client.on('messageDelete', async (deletedData) => {
    const { id, channelId, guildId, stickers, attachments, author, content } = deletedData;
    if (deletedData.partial || !author || author.bot) return;
    const imageAttachments = attachments
        .filter(att => att.contentType?.startsWith('image/'))
        .map(att => att.proxyURL);
    const { modChannels: { deletedlogChannel } } = await guildconfigs.findOne({ guildId }, { projection: { modChannels: 1 } }) as Document;
    const bodyComponents: AnyComponentV2[] = [
        {
            type: ComponentType.Section,
            components: [{
                type: ComponentType.TextDisplay,
                content: `Message by ${author.username} was deleted in <#${channelId}>\n\n${content || 'No text content'}`
            }],
            accessory: {
                type: ComponentType.Thumbnail,
                media: { url: author.avatarURL() ?? author.defaultAvatarURL }
            }
        }];

    if (imageAttachments.length > 0) {
        bodyComponents.push({
            type: ComponentType.MediaGallery,
            items: stickers.size > 0 ? [{ media: { url: stickers.first()!.url } }] : imageAttachments.map(url => ({ media: { url } }))
        });
    }
    bodyComponents.push({
        type: ComponentType.Section,
        components: [{ type: ComponentType.TextDisplay, content: `ID: ${id}` }],
        accessory: { type: ComponentType.Button, style: ButtonStyle.Link, label: 'Event link', url: `https://discord.com/channels/${guildId}/${channelId}/${id}` }
    })
    await client.rest.post(Routes.channelMessages(deletedlogChannel), {
        body: { flags: MessageFlags.IsComponentsV2, components: [{ type: ComponentType.Container, accent_color: 0xf03030, components: bodyComponents }] }
    })
})
client.on('messageUpdate', async (oldMessage, newMessage) => {
    const { author, id, channelId, content, guildId } = newMessage;
    if (!oldMessage.content || oldMessage.content == newMessage.content || oldMessage.author?.bot) return;
    const { modChannels: { updatedlogChannel } } = await guildconfigs.findOne({ guildId: newMessage.guildId }, { projection: { modChannels: 1 } }) as Document
    await client.rest.post(Routes.channelMessages(updatedlogChannel), {
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
                    accessory: { type: ComponentType.Thumbnail, media: { url: author.avatarURL() ?? author.defaultAvatarURL } }
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
    const { author, member, content, attachments, type, mentions, guild, channel } = message;
    if (author.bot == true || !guild || type === MessageType.ChatInputCommand || type === MessageType.UserJoin) return;
    const { publicChannels, responses, staffroles, generalchannels, automodsettings: { messagereasonsandweights, messagethreshold, Duplicatespamthreshold, mediathreshold, spamthreshold, capsthreshold }, count, lastuser, Stages, modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { publicChannels: 1, responses: 1, staffroles: 1, mediaexclusions: 1, automodsettings: 1, count: 1, lastuser: 1, baseMultiplier: 1, exponent: 1, flatOffset: 1, roundToNearest: 1, generalchannels: 1, Stages: 1, modChannels: 1 } }) as Document
    const isstaff = member?.roles.cache.some((role: Role) => staffroles.includes(role.id)) || author.id === "521404063934447616"
    const hasMedia = (attachments.size > 0 || /https?:\/\/[^\s]+/i.test(content)) && generalchannels.includes(channel.id)
    let messageWords: string = '!';
    let changed: boolean = false
    if (channel.id == publicChannels.countingChannel) {
        if (!/^\d+$/.test(content)) return;
        await guildconfigs.findOneAndUpdate({ guildId: guild.id }, (count + 1 == parseInt(content) && lastuser !== author.id) ? { $inc: { count: 1 }, $set: { lastuser: author.id } } : { $set: { count: 0, lastuser: null } })
        return (count + 1 == parseInt(content) && lastuser !== author.id) ?
            await message.react("%E2%9C%85") : await message.reply({ content: `<@${author.id}> missed or already counted!` })
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
    const key = createHash('md5').update(messageWords).digest('hex')
    const capsRatio = messageWords.length > 20 ? (messageWords.match(/[A-Z]/g)?.length ?? 0) / messageWords.length : 0;
    const { automodMarks, punishments, level } = await usersCollection.findOneAndUpdate(
        { userId: author.id, guildId: guild.id }, [
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
    await grantXp({ Id: member!, guildId: guild.id, channel: channel as TextChannel });
    const isNewUser = Date.now() - member?.joinedTimestamp! < 2 * 24 * 60 * 60 * 1000 && level < 3
    if (isstaff) return;
    if (mentions.everyone) await message.delete();
    const activeChecks = Object.keys(messagereasonsandweights).filter((key: string) => automodMarks[key]).map(key => ({ ...messagereasonsandweights[key] })) as Array<{ reason: string, Weight: number }>;
    let totalWeight = activeChecks.reduce((acc, check) => acc + check.Weight, 0) as number;
    if (totalWeight == 0) return;
    await usersCollection.updateOne({ guildId: guild.id, userId: member!.user.id }, {
        $set: { 'automodMarks.everyonePing': false, 'automodMarks.duplicateSpam': false, 'automodMarks.mediaViolation': false, 'automodMarks.generalspam': false, 'automodMarks.capSpam': false }
    })
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const bannable = isNewUser && (totalWeight >= 3 || mentions.everyone)

    const activeWarns = punishments.length > 0 ? punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0) : 0;
    const totalWarns = activeWarns + totalWeight;
    const { minutes, label } = Stages[Math.min(totalWarns - 1, Stages.length - 1)];
    const object = new ObjectId();
    let warnType = bannable ? 'Ban' : 'Warn';
    let durationMs = 0, durationStr = null;
    if (warnType === 'Warn' && minutes > 0) {
        durationMs = minutes * 60000;
        durationStr = minutes >= 60 ? `${Math.ceil(minutes / 60)} hour mute` : `${minutes} min mute`;
        warnType = 'Mute';
    }
    const finalMessage = await channel.send({
        embeds: [{
            author: {
                name: `${member!.user!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : `${statusMap[warnType]?.cmd}`}`,
                icon_url: member!.user?.avatarURL() ?? member!.user?.defaultAvatarURL
            },
            color: statusMap[warnType]!.color,
        }]
    });
    const newPunishment = { _id: object, userId: author.id, moderatorId: '1420927654701301951', reasonText, duration: durationMs, timestamp: Date.now(), active: 1, weight: !bannable ? totalWeight : 1, type: warnType, guildId: guild.id, channel: channel.id, refrence: `https://discord.com/channels/${guild.id}/${channel.id}/${finalMessage.id}`, warns: totalWarns - 1 };
    await usersCollection.updateOne({ userId: author.id, guildId: guild.id }, { $push: { punishments: newPunishment as any } });
    const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
    let dm = true;
    try {
        author.send({
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: statusMap[warnType]!.color,
                components: [{
                    type: ComponentType.Section,
                    accessory: { type: ComponentType.Thumbnail, media: { url: message.guild?.iconURL()! } },
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `<@${author.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${message.guild!.name}](https://discord.com/channels/${guild.id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${message.guild!.name}` : `in ${message.guild!.name}`}`
                        }]
                },
                    {
                        type: ComponentType.Section,
                        components: [{
                            type: ComponentType.TextDisplay,
                            content: `Reason: \`${reasonText}\` ${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${totalWeight} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nActive Warnings: \`${totalWarns}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`}`
                        }],
                        ...(warnType === 'Ban' ? { accessory: { type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' } } : {})
                    }]
            }]
        })
    } catch { dm = false; }
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId: guild.id }, { $set: { ban: author.id } });
            await guild?.bans.create(author.id, { deleteMessageSeconds: 604800, reason: `Ban Command: ${reasonText}` })
            break;
        case 'Mute':
            await member!.timeout(Math.min(durationMs, 2419200000), reasonText)
            break;
        case 'Kick':
            await member?.kick(reasonText)
            break;
    }
    await client.rest.post(Routes.channelMessages(warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2, components: [{
                type: ComponentType.Container, accent_color: statusMap[warnType]!.color, components: [{
                    type: ComponentType.Section,
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `<@${client.user?.id}> ${statusMap[warnType]!.log}\n\n user:<@${author.id}>\nChannel:<#${channel.id}>\nHistory: ${caseHistory.join(' | ') || "none"}\n\nReason:  \`${reasonText}\`\n${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${!bannable ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nWarns at log time: \`${activeWarns}\`\nNext Punishment: \`${label}\`\n\n${subtext(dm ? 'User DMed ✅' : 'User DMed 🚫')}`}`
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: author.avatarURL() ?? author.defaultAvatarURL }
                    }
                }]
            }]
        }
    })
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne({ userId: author.id, guildId: guild.id }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
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
        }
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
})
client.login(Bun.env.TOKEN)