import { LRUCache } from 'lru-cache'
import { type EmbedObject, type messageObject, type guildEmbedIds, type Invite, type channelObject, type memberObject, type guildObject, type options, type reactionObject, type AuditLogEntryObject, type AuditLogObject, type Punishment, type userObject, type Ready, ComponentType } from './types';
import { usersCollection, guildconfigs } from './Database';
import punishUser from './punishUser';
import { type Document, type WithId } from 'mongodb';
import xpconfigs from './guildconfiguration'
import { client } from './CustomGateway';
import { get, pull, put, patch, post } from './rest'
import { appendFile } from 'fs/promises';
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
const keyMap: Record<string, string> = { 'Forbidden Words': 'ForbiddenWords', 'Banned Words': 'BannedWords', 'No Invites': 'hasInvite', 'Masked Links': 'MaskedLinks' };
const commands: options[] = [
    { name: 'appeal', description: 'appeal a ban', contexts: [0], type: 1 },
    {
        name: 'applications', description: 'Open/close applications', options: [{ name: 'open', description: 'Open applications', type: 1 }, { name: 'close', description: 'Close Applications', type: 1 }], contexts: [0], default_member_permissions: "8",
    },
    { name: 'apply', description: 'Apply to be on the mod team', type: 1 },
    {
        name: 'blacklist', description: 'edit/show a users blacklist', contexts: [0], default_member_permissions: "1099511627776", options: [{ name: 'add', description: 'add a role ', type: 1, options: [{ name: 'target', description: 'User', required: true, type: 6 }, { name: 'role', description: 'role', required: true, type: 8 }] }, { name: 'show', description: 'show blacklist', type: 1, options: [{ name: 'target', description: 'user to show', required: true, type: 6 }] }, { name: 'remove', description: 'remove a role', type: 1, options: [{ name: 'target', description: 'User', required: true, type: 6 }, { name: 'role', description: 'Role', required: true, type: 8 }] }]
    },
    {
        name: 'dnd', description: 'Roll DND dice', contexts: [0],
        options: [{ name: 'd4', description: 'Roll a D4', type: 1 }, { name: 'd6', description: 'Roll a D6', type: 1 }, { name: 'd8', description: 'Roll a D8', type: 1 }, { name: 'd10', description: 'Roll a D10', type: 1 }, { name: 'd12', description: 'Roll a D12', type: 1 }, { name: 'd20', description: 'Roll a D20', type: 1 }, { name: 'd100', description: 'Roll a D100', type: 1 }],
    },
    {
        name: 'games', description: 'Play a game', type: 1, contexts: [0], options: [{ name: 'tictactoe', description: 'Play Tictactoe', type: 1, options: [{ name: 'opponent', description: 'Your Opponent', required: true, type: 6 }] }, { name: 'rps', description: 'Play Rock, Paper, Scissors', type: 1, options: [{ name: 'choice', description: 'Your move', type: 3, required: true, choices: [{ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' }] }] }, { name: 'logos', description: 'Play the Logo Game', type: 1 }, { name: 'bet', description: 'bet coins', type: 1, options: [{ name: 'amount', description: 'The amount', required: true, type: 4 }] }, { name: 'highlow', description: 'Guess a number between 1 and 100', type: 1 }],

    },
    { name: 'leaderboard', type: 1, description: `Show the top ten users`, contexts: [0] },
    {
        name: 'member', description: 'Warn/Mute/Ban/kick/unwarn/unmute a user', default_member_permissions: "1099511627776", contexts: [0], options: [
            {
                name: 'warn', description: 'Warn a user', type: 1, default_member_permissions: "1099511627776",
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
                name: 'ban', description: 'Ban a user', type: 1, options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'Reason', required: true, type: 3 }]
            },
            {
                name: 'kick', description: 'Kick a user', type: 1, default_member_permissions: "1099511627776",
                options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'reason', description: 'Reason', required: true, type: 3 }]
            },
            { name: 'unwarn', description: 'Removes a user\'s warn', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }], default_member_permissions: "1099511627776" },
            { name: 'unmute', description: 'Unmute a user', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }], default_member_permissions: "1099511627776" }]
    },
    {
        name: 'modlogs', description: 'View a user’s moderation history.', default_member_permissions: "1099511627776", contexts: [0], options: [{ name: 'target', description: 'The user to view', required: true, type: 6 }]
    },
    {
        name: 'note', description: 'add/show a user\'s notes', default_member_permissions: "1099511627776", contexts: [0], options: [{ name: 'show', description: 'Display a users notes', type: 1, options: [{ name: 'target', description: 'target User', required: true, type: 6 }] }, { name: 'add', description: 'Add note to a user', type: 1, options: [{ name: 'target', description: 'The User', required: true, type: 6 }, { name: 'note', description: 'note to add', required: true, type: 3 }] }]
    },
    { name: 'rank', description: 'See your xp and Level', contexts: [0], type: 1, options: [{ name: 'member', description: 'The Member', type: 6 }] },
    { name: 'refresh', description: 'Refreshes the Posted embeds', default_member_permissions: "8", contexts: [0] },
    { name: 'restart', description: 'Restart the bot', default_member_permissions: '8', contexts: [0] },
    { name: 'link', description: 'link your twitch channel', contexts: [0], options: [{ name: 'channel', description: 'The channel name to link', type: 3, required: true }] }
]
let massban = 0;
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
client.on("READY", async (ready: Ready) => {
    await put(`applications/1420927654701301951/commands`, commands, null, null);
    await put(`applications/1420927654701301951/role-connections/metadata`, [{ type: 7, key: "twitch_linked", name: "Twitch Linked", description: "Twitch channel is linked" }], null, null)
    await usersCollection.updateMany(
        { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
        { $set: { "punishments.$[elem].active": 0 } },
        { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
    );
    setInterval(() => client.updateStatus(), 15000)
    appendFile('bot_error.log', 'Febot is awake! \n');
    const guildIds = ready.guilds.map((guild: guildObject) => (guild.id))
    for (const guildId of guildIds) {
        const guildinvites = await get(`guilds/${guildId}/invites`) as Invite[];
        const invites = guildinvites.map((invite: Invite) => { return { code: invite.code, uses: invite.uses } })
        await guildconfigs.findOneAndUpdate({ guildId: guildId }, { $set: { Invites: invites } }, { upsert: true })
        const { Data, messageConfigs } = await guildconfigs.findOne({ guildId: guildId }, { projection: { Data: 1, messageConfigs: 1 } }) as Document;
        let data = Data
        if (!messageConfigs) { appendFile('bot_error.log', `[GuildConfig] No config found for guild ID: ${guildId}\n`); return; }
        for (const [embedName, config] of Object.entries(messageConfigs as Document)) {
            const { channelid, embeds, components, reactions } = config;
            try {
                const existingdata = Data.find((m: any) => m.name === embedName) as guildEmbedIds;
                const message = await get(`channels/${channelid}/messages/${existingdata.messageId}`) as messageObject
                const different = message.embeds.map((embed: EmbedObject) => getComparableEmbed(embed)).join('|||') !== embeds.map((embed: EmbedObject) => getComparableEmbed(embed)).join('|||')
                if (different) { await patch(`channels/${channelid}/messages/${message.id}`, { embeds: embeds, ...components }) }
            } catch {
                const msg = await post(`channels/${channelid}/messages`, { embeds: embeds, components: components }) as messageObject
                data = Data.filter((message: any) => message.name !== embedName);
                if (reactions)
                    for (const reaction of reactions) {
                        await put(`channels/${channelid}/messages/${msg.id}/reactions/${reaction}/@me`, null, null, null);
                        await Bun.sleep(750)
                    }
                appendFile('bot_error.log', `📝 Sent '${embedName}'. Message ID: ${msg.id} \n`);
                data.push({ name: embedName, messageId: msg.id })
                await guildconfigs.updateOne({ guildId: guildId }, { $set: { Data: data } })
            }
        }
    }
})
client.on("GUILD_AUDIT_LOG_ENTRY_CREATE", async (action: AuditLogEntryObject) => {
    if (action.action_type !== 143) return;
    const { guild_id, user_id, target_id, options: { channel_id, auto_moderation_rule_name } } = action
    const triggeredKey = keyMap[auto_moderation_rule_name] as string;
    const { level, punishments, avatar, } = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { avatar: 1, xp: 1, level: 1, punishments: 1 } }) as Document;
    const activeReason = reasonsandweights[triggeredKey] as { reason: string, Weight: number };
    await pull(`channels/${channel_id}/messages/${target_id}`).catch(() => { });
    let totalWeight = activeReason.Weight;
    let reason = `AutoMod: ${activeReason.reason}`
    if (level < 3) { totalWeight += 2; reason += ' while new to the server.'; }
    const bannable = level < 3 && (totalWeight >= 3 || punishments.length > 2);
    await punishUser(guild_id, user_id, avatar, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reason, channel_id, true, undefined, bannable ? 1 : totalWeight, bannable, false);
})
client.on("GUILD_MEMBER_ADD", async (member: memberObject) => {
    const { guild_id, user } = member;
    const { modChannels, staffroles, jrrole } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, staffroles: 1, jrrole: 1 } }) as Document
    const avatarURL: string = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
    const currentInvites = await get(`guilds/${guild_id}/invites`) as Invite[]
    const { Invites } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Invites: 1 } }) as Document;
    const guildInvitesmap = new Map<string, number>(Invites.map((i: Invite) => [i.code, i.uses]));
    const invite = currentInvites.find((i: Invite) => i.uses > (guildInvitesmap.get(i.code) || 0)) as Invite;
    const inviter = invite ? await get(`guilds/${guild_id}/members/${invite.inviter}`) as memberObject : null;
    await guildconfigs.updateOne({ guildId: guild_id }, { $set: { Invites: currentInvites.map((i: Invite) => ({ code: i.code, uses: i.uses })) } }, { upsert: true })
    const createdTimestamp = ((BigInt(member.user.id) >> 22n) + 1420070400000n) / 1000n;
    const welcomeEmbed: EmbedObject = {
        color: 0x00FF99,
        description: `<@${user.id}> joined the Server!`,
        thumbnail: { url: avatarURL },
        fields: [{ name: 'Discord Join Date:', value: `<t:${createdTimestamp}>`, inline: true }],
        timestamp: new Date().toISOString(),
        footer: inviter ? { text: `Invited by: ${inviter.user.username} | ${invite.code}` } : undefined
    }
    const originalMessage = await post(`channels/${modChannels.welcomeChannel}/messages`, {
        embeds: [welcomeEmbed],
        components: [{
            type: 1, components: [{
                type: 2,
                custom_id: invite && inviter && !inviter.roles.some(role => staffroles.includes(role)) && !inviter.roles.includes(jrrole) ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                label: invite ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                style: 4
            }]
        }]
    }) as messageObject;
    if (Date.now() - Number(createdTimestamp) < 172800000) {
        await pull(`guilds/members/${user.id}`,)
        await post(`channels/${modChannels.mutelogChannel}/messages`,
            {
                embeds: [{
                    title: 'A member was auto-kicked', thumbnail: { url: avatarURL }, description: `**User:** <@${user.id}>\n**Reason:** New Account\n**Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`
                }]
            })
        return;
    }

    if (!user.bot) {
        const dmChannel = await post(`users/@me/channels`, { recipient_id: user.id }) as channelObject;
        await post(`channels/${dmChannel.id}/messages`, {
            embeds: [{
                description: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.  Click on the invite: https://discord.gg/qMjjyXyYbr for the bot's key incase he cannot dm you.`,
            }]
        })
        const persistentdata: WithId<Document> | null = await usersCollection.findOne({ userId: user.id, guildId: guild_id })
        if (!persistentdata) {
            await usersCollection.insertOne({ userId: user.id, guildId: guild_id, level: 1, coins: 100, xp: 0, totalmessages: 0, punishments: [], notes: [], joinedTime: Date.now(), blacklist: [], avatar: member.user.avatar, total: 0, mediaCount: 0, duplicateCounts: {}, timestamps: [], nick: member.user.username })
        }
    }
    setTimeout(async () => {
        await patch(`channels/${originalMessage.channel_id}/messages/${originalMessage.id}`, {
            embeds: [welcomeEmbed],
            components: [{
                type: 1, components: [{
                    type: 2,
                    custom_id: invite ? `ban_${user.id}_${invite.code}` : `ban_${user.id}_none`,
                    label: invite && inviter && !inviter.roles.some(role => staffroles.includes(role)) && !inviter.roles.includes(jrrole) ? '🔨 Ban & Delete Invite' : '🔨 Ban',
                    style: 4,
                    disabled: true,
                    footer: inviter ? { text: `Invited by: ${inviter.user.username} | ${invite.code}` } : undefined
                }]
            }]
        })
    }, 15 * 60 * 1000)
})
client.on("GUILD_MEMBER_REMOVE", async (member: memberObject) => {
    const { user, guild_id } = member;
    if (user.bot) { return }
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const { joinedTime } = await usersCollection.findOne({ userId: user.id, guildId: guild_id }, { projection: { joinedTime: 1 } }) as Document;
    await post(`channels/${modChannels.welcomeChannel}/messages`, {
        embeds: [{ description: `<@${user.id}> left the server.`, thumbnail: { url: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png` }, fields: [{ name: 'Server Join Date:', value: `<t:${joinedTime}>`, inline: true }] }]
    })
})
client.on("GUILD_MEMBER_UPDATE", async (member: memberObject) => {
    const { guild_id, user, nick } = member;
    const oldMember = await usersCollection.findOne({ guildId: guild_id, userId: user.id }) as Document;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    await usersCollection.updateOne({ guildId: guild_id, userId: user.id }, { $set: { nick: nick ? nick : user.username } });
    if (!oldMember || nick === oldMember.nick || member.user.username == oldMember.nick) return;
    await post(`channels/${modChannels.namelogChannel}/messages`, {
        embeds: [{
            thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
            color: 0x4e85b6,
            description: `<@${user.id}> **changed their nickname**\n\n` +
                `**Before:**\n${oldMember?.nick}\n\n` +
                `**After:**\n${nick ?? user.username}`,
            timestamp: new Date().toISOString()
        }]
    })
})
client.on("GUILD_BAN_ADD", async (ban: { guild_id: string, user: userObject }) => {
    const { user, guild_id } = ban;
    const { Ban } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { ban: 1 } }) as Document
    if (Ban !== '') { await guildconfigs.updateOne({ guildId: guild_id }, { $set: { ban: '' } }); return; }
    else {
        const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
        const auditLog = await get(`guilds/${guild_id}/audit-logs?limit=1&user_id=${user.id}&action_type=22`) as AuditLogObject;
        const executorId = auditLog.audit_log_entries[0]?.user_id ?? null;
        const reason = auditLog.audit_log_entries[0]?.reason ?? null;
        const guild = await get(`guilds/${guild_id}`) as guildObject
        const logEmbed: EmbedObject = {
            color: 0xd10000,
            author: { name: `${user.username}`, icon_url: user.avatar },
            thumbnail: { url: `https://cdn.discordapp.com/icons/${guild_id}/${guild.icon}.png` },
            description: `<@${user.id}>, ${`you were banned from [${guild.name}](https://discord.com/channels/${guild_id}).\n\n\nTo appeal this decision, please join our dedicated appeal server using the button below.`}`,
            fields: [{ name: 'Reason:', value: `\`${reason}\``, inline: false }],
            timestamp: new Date().toISOString(),
            footer: { text: 'User DMed ✅' }
        }
        Bun.sleep(massban * 1000)
        try {
            const dmchannel = await post(`users/@me/channels`, { recipient_id: user.id }) as channelObject;
            await post(`channels/${dmchannel.id}/messages`, {
                embeds: [logEmbed],
                components: [{ type: ComponentType.ACTION_ROW, components: [{ type: ComponentType.BUTTON, style: 5, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }]
            })
        } catch { logEmbed.footer = { text: 'User DMed 🚫' } }
        await post(`channels/${modChannels.banlogChannel}/messages`, {
            embeds:
                [{
                    color: 0xff3030,
                    title: 'Mass Ban Detected',
                    thumbnail: { url: `https://cdn.discordapp.com/users/${user.id}/${user.avatar}.png` },
                    description: `**Moderator <@${executorId}> banned <@${user.id}>:**\n\n\n ${`ID:<@${user.id}>\n\n TAG:${user.username} \n\n Reason:${reason}`}`,
                    timestamp: new Date().toISOString()
                }]
        });
        massban -= 1;
    }
})
client.on("GUILD_BAN_REMOVE", async (ban: { guild_id: string, user: userObject }) => {
    const { user, guild_id } = ban
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const entry = (await usersCollection.findOne({ userId: user.id, guildId: guild_id }, { projection: { punishments: 1 } }) as Document).filter((ban: Punishment) => ban.type == 'Ban').sort((a: Punishment, b: Punishment) => b.timestamp - a.timestamp)
    await post(`https://discord.com/api/v10/channels/${modChannels.banlogChannel}/messages`, {
        embeds: [{
            color: 0x309eff,
            title: 'A member was unbanned',
            thumbnail: { url: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${BigInt(user.id) % 5n}.png` },
            description: `**User**: <@${user.id}>\n**Tag**: \`${user.username}\`\n**Id**: \`${user.id}\`\n**Reason**: \`${entry[0].reason ?? "no reason specified."}\``,
            timestamp: new Date().toISOString()
        }]
    })

})
client.on("INVITE_CREATE", async (invite: Invite) => {
    await guildconfigs.findOneAndUpdate({ guildId: invite.guild_id }, { $addToSet: { Invites: { code: invite.code, uses: invite.uses } } });
})
client.on("INVITE_DELETE", async (invite: Invite) => {
    await guildconfigs.findOneAndUpdate({ guildId: invite.guild_id }, { $pull: { Invites: { code: invite.code } } as any })
})
client.on("MESSAGE_REACTION_ADD", async (reaction: reactionObject) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const { reactions, Data } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { reactions: 1, Data: 1 } }) as Document
    if (!Data || !Data.some((info: guildEmbedIds) => info.messageId === message_id)) return;
    const roleID = reactions[emoji.id || emoji.name];
    if (!roleID) return;
    const blacklist = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { blacklist: 1 } }) as WithId<Document>
    if (blacklist.length > 0 && blacklist.find((r: string) => r === roleID)) return;
    if (Array.isArray((roleID)))
        await Promise.all(roleID.map(role => put(`guilds/${guild_id}/members/${user_id}/roles/${role}`, null, null, null)));
    else
        await put(`guilds/${guild_id}/members/${user_id}/roles/${roleID}`, null, null, null);
})
client.on("MESSAGE_REACTION_REMOVE", async (reaction: reactionObject) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const { Data, reactions } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Data: 1, reactions: 1 } }) as WithId<Document>;
    if (!Data || !Data.some((info: guildEmbedIds) => info.messageId === message_id)) return;
    const roleID = reactions[emoji.id || emoji.name];
    if (!roleID) return;
    const blacklist = await usersCollection.findOne({ userId: user_id, guildId: guild_id }, { projection: { blacklist: 1 } }) as Document
    if (blacklist.length > 0 && blacklist.find((r: string) => r === roleID)) return;
    if (Array.isArray(roleID))
        await Promise.all(roleID.map(role => pull(`guilds/${guild_id}/members/${user_id}/roles/${role}`)));
    else
        await pull(`guilds/${guild_id}/members/${user_id}/roles/${roleID}`);
})
client.on("MESSAGE_DELETE", async (deletedData: messageObject) => {
    const { id, channel_id, guild_id } = deletedData;
    const message = messageCache.get(id) as messageObject;
    if (!message) return;
    const { author, content, attachments } = message;
    const imageAttachments = attachments.map((att) => att.proxy_url);
    const additionalEmbeds = imageAttachments.slice(1, imageAttachments.length).map(url => ({ url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`, image: { url: url } }));
    const mainEmbed: EmbedObject = {
        color: 0xf03030,
        description: `Message by <@${author.id}> was deleted in <#${channel_id}>\n\n${content || ''}\n\n[Event Link](${`https://discord.com/channels/${guild_id}/${channel_id}/messages/${id}`})\n\n`,
        url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`,
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
        footer: { text: `ID: ${id}` },
        timestamp: new Date().toISOString(),
        image: imageAttachments[0] ? { url: imageAttachments[0] } : undefined
    }
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    await post(`channels/${modChannels.deletedlogChannel}/messages`, { embeds: [mainEmbed, ...additionalEmbeds] })
})
client.on("MESSAGE_UPDATE", async (newMessage: messageObject) => {
    const oldMessage = messageCache.get(newMessage.id) as messageObject;
    if (!oldMessage || oldMessage.content == newMessage.content) return;
    const { modChannels } = await guildconfigs.findOne({ guildId: newMessage.guild_id }, { projection: { modChannels: 1 } }) as Document
    await post(`channels/${modChannels.updatedlogChannel}/messages`, {
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
    const { publicChannels, responses, staffroles, jrrole, mediaexclusions, automodsettings, count, lastuser } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { publicChannels: 1, responses: 1, staffroles: 1, jrrole: 1, mediaexclusions: 1, automodsettings: 1, count: 1, lastuser: 1 } }) as Document
    if (author.bot == true || !guild_id || type == 20 || type == 7) return;
    if (channel_id == publicChannels.countingChannel) {
        if (!parseInt(content)) return;
        await guildconfigs.findOneAndUpdate({ guildId: guild_id }, (count + 1 == parseInt(content) && lastuser !== author.id) ? { $inc: { count: 1 }, $set: { lastuser: author.id } } : { $set: { count: 0, lastuser: null } })
        return (count + 1 == parseInt(content) && lastuser !== author.id) ? await put(`channels/${channel_id}/messages/${id}/reactions/%E2%9C%85/@me`, null, null, null) : await post(`channels/${channel_id}/messages`, { content: `<@${author.id}> missed or already counted!(Number Reset!)`, message_reference: { message_id: id } })
    }
    let messageWords: string | null = null;
    const isstaff = member.roles.some((roleId: string) => staffroles.includes(roleId)) || member.roles.includes(jrrole) || author.id === "521404063934447616"
    const isembeded = embeds.some((embed: EmbedObject) => { { return embed.type == 'image' || embed.type == "video" || embed.type == "gifv" || embed.type == "rich" } })
    const hasMedia = (attachments.length > 0 || isembeded) && (flags & 8192) === 0 && !Object.values(mediaexclusions as Record<string, string>).some(id => id === channel_id)
    if (content.length >= 1) {
        messageWords = content.replace(/<a?:\w+:\d+>/g, '').replace(/[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '');
        const reactionsToApply = [];
        for (const [trigger, response] of Object.entries(responses))
            if (messageWords.toLowerCase().includes(trigger))
                await post(`channels/${channel_id}/messages`, { content: response, message_reference: { message_id: id } })
        if (messageWords.toLowerCase().includes('bad') && messageWords.toLowerCase().includes('bot'))
            reactionsToApply.push('😡')
        if (messageWords.toLowerCase().includes('<@857445139416088647>'))
            reactionsToApply.push(encodeURI('SaltyEyes:1257522749635563561'))
        if (messageWords.toLowerCase().includes('gay'))
            reactionsToApply.push('🏳️‍🌈')
        for (const emoji of reactionsToApply) {
            await put(`channels/${channel_id}/messages/${id}/reactions/${emoji}/@me`, null, null, null);
        }
    }
    const { total, mediaCount, timestamps, duplicateCounts, xp, level, avatar, lastmessage } = await usersCollection.findOneAndUpdate({ userId: author.id, guildId: guild_id }, [{
        $set: {
            xp: { $add: [{ $ifNull: ["$xp", 0] }, 20] },
            totalmessages: { $add: [{ $ifNull: ["$totalmessages", 0] }, 1] },
            avatar: author.avatar,
            total: { $cond: [{ $gte: [{ $add: [{ $ifNull: ["$total", 0] }, 1] }, automodsettings.messagethreshold] }, 0, { $add: [{ $ifNull: ["$total", 0] }, 1] }] },
            mediaCount: { $cond: [{ $gte: [{ $add: [{ $ifNull: ["$total", 0] }, 1] }, automodsettings.messagethreshold] }, 0, { $add: [{ $ifNull: ["$mediaCount", 0] }, (hasMedia ? 1 : 0)] }] },
            duplicateCounts: messageWords ? { $cond: [{ $gte: [{ $add: [{ $ifNull: ["$total", 0] }, 1] }, automodsettings.messagethreshold] }, {}, { $mergeObjects: [{ $ifNull: ["$duplicateCounts", {}] }, { [messageWords]: { $add: [{ $ifNull: [`$duplicateCounts.${messageWords}`, 0] }, 1] } }] }] } : "$duplicateCounts",
            timestamps: { $slice: [{ $concatArrays: [{ $ifNull: ["$timestamps", []] }, [Date.now().toString()]] }, -15] },
            lastmessage: Date.now()
        }
    }], { upsert: true, returnDocument: 'after', projection: { xp: 1, level: 1, avatar: 1, total: 1, mediaCount: 1, timestamps: 1, duplicateCounts: 1, lastmessage: 1 } }) as WithId<Document>
    const isNewUser = Date.now() - Date.parse(member.joined_at) < 2 * 24 * 60 * 60 * 1000 && level < 3
    if (xp >= xpconfigs[guild_id].xp(level ? level : 1)) {
        const rank = await usersCollection.countDocuments({ guildId: guild_id, $or: [{ level: { $gt: level ? level + 1 : 2 } }, { level: level ? level + 1 : 2, xp: { $gt: xp } }] });
        await post(`channels/${channel_id}/messages`, {
            embeds: [{
                author: { name: `${author.username} you reached level ${level ? level + 1 : 2}!`, icon_url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
                color: 0x00AE86,
                footer: { text: `You are now #${rank} in the server!` }
            }]
        })
        if (level + 1 > 2 && !member.roles.includes("1334238580914131026") && guild_id == "1231453115937587270")
            await put(`guilds/${guild_id}/members/${author.id}/roles/1334238580914131026`, null, null, null)
        await usersCollection.findOneAndUpdate({ userId: author.id, guildId: guild_id }, level ? { $inc: { level: 1 }, $set: { xp: 0 } } : { $set: { level: 1, xp: 0 } });
    }
    messageCache.set(id, { author: { id: author.id, username: author.username, avatar: author.avatar }, content: content, attachments: attachments.map(a => ({ filename: a.filename, proxy_url: a.proxy_url })) });
    let caps: RegExpMatchArray | null = null;
    if (messageWords && messageWords.length > 20)
        caps = messageWords.match(/[A-Z]/g);
    const activemarks: Record<string, boolean> = {
        everyonePing: mention_everyone,
        duplicateSpam: messageWords ? duplicateCounts[messageWords] >= automodsettings.Duplicatespamthreshold : false,
        mediaViolation: mediaCount > automodsettings.mediathreshold && total < automodsettings.messagethreshold,
        generalspam: timestamps.filter((stamp: string) => Date.now() - parseInt(stamp) < 8000).length > automodsettings.spamthreshold,
        capSpam: caps && messageWords ? (caps.length / messageWords.length) > automodsettings.capsthreshold : false
    };
    if (activemarks.duplicateSpam || activemarks.mediaViolation || Date.now() - lastmessage <= 1800000)
        await usersCollection.updateOne({ userId: author.id, guildId: guild_id }, { $set: { duplicateCounts: {}, mediaCount: 0 } });
    if (isstaff) return;
    if (mention_everyone) await pull(`channels/${channel_id}/messages/${id}`)
    const activeChecks = Object.keys(reasonsandweights).filter((key: string) => activemarks[key]).map(key => ({ ...reasonsandweights[key] })) as Array<{ reason: string, Weight: number }>;
    let totalWeight = activeChecks.reduce((acc, check) => { return acc + check.Weight }, 0) as number;
    if (totalWeight == 0) return;
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const bannable = (isNewUser && (totalWeight >= 3 || mention_everyone)) ?? false
    await punishUser(guild_id, author.id, avatar, { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reasonText, channel_id, true, undefined, bannable ? 1 : totalWeight, bannable, false);
});
client.on('VOICE_STATE_UPDATE', async (event) => {
    const { guild_id, channel_id, user_id, member } = event;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const { vcchannel } = await usersCollection.findOneAndUpdate({ userId: user_id, guildId: guild_id }, { $set: { vcchannel: channel_id } }, { returnDocument: 'before' }) as Document;
    if (vcchannel === channel_id) return;
    await post(`channels/${modChannels.voicelogChannel}/messages`, {
        embeds: [{
            author: { name: member.user.username, icon_url: `https://cdn.discordapp.com/avatars/${user_id}/${member.user.avatar}.png` },
            description: channel_id !== null ? `<@${user_id}> joined <#${channel_id}>.` : `<@${user_id}> left <#${vcchannel}>`,
            color: channel_id !== null ? 0x305830 : 0x8b0000,
            timestamp: new Date().toISOString()
        }]
    })
})
client.on('error', async (error) => appendFile('bot_error.log', `ERROR: ${error} \n`))