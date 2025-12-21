import embedIDs from '../embeds/embedIDs.json' with {type: 'json'}
import guildChannelMap from '../Extravariables/guildconfiguration.json' with {type: 'json'}
import { AuditLogEvent } from '@discordjs/core';
import { load, save } from './fileeditors.js';
import { getblacklist, getPunishments } from '../Database/databaseAndFunctions.js';
const recentBans = new Map()
export async function handleReactionChange(reaction, api, action) {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const guildEmbeds = embedIDs[guild_id];
    if (!guildEmbeds || !guildEmbeds.some(info => info.messageId === message_id)) return;
    const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
    if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
    const blacklist = await getblacklist(user_id, guild_id)
    if (blacklist.length > 0 && blacklist.find(r => r === roleID)) return;
    try {
        if (action === 'add') {
            await api.guilds.addRoleToMember(guild_id, user_id, roleID);
        } else {
            await api.guilds.removeRoleFromMember(guild_id, user_id, roleID);
        }
    } catch (err) {
        console.error(`❌ Failed to ${action} role ${roleID} for user ${user_id}:`, err);
    }
}
export async function handleinvites(invite, action) {
    const invites = await load("Extravariables/invites.json")
    let guildinvites = invites[invite.data.guild_id]
    switch (action) {
        case 'add': guildinvites.push({ code: invite.data.code, uses: invite.data.uses })
            break;
        case 'remove': guildinvites = guildinvites.filter(inv => inv.code !== `${invite.data.code}`)
            break;
    }
    invites[invite.data.guild_id] = guildinvites
    await save("Extravariables/invites.json", invites)
}
export async function MemberHandler(member, api, action) {
    const guildId = member.guild_id;
    const user = member.user;
    const channels = guildChannelMap[guildId];
    if (!channels) return;
    const avatarURL = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${user.id % 5}.png`;

    if (action === 'add') {
        const currentInvites = await api.guilds.getInvites(guildId);
        const filepath = "./Extravariables/invites.json";
        const invitesCache = await load(filepath);
        const guildInvitesArray = invitesCache[guildId] || [];
        const oldInvitesMap = new Map(guildInvitesArray.map(item => [item.code, item.uses]));
        let invite = currentInvites.find(i => i.uses > (oldInvitesMap.get(i.code) || 0));
        let inviter = invite?.inviter;
        invitesCache[guildId] = currentInvites.map(i => ({ code: i.code, uses: i.uses }));
        await save(filepath, invitesCache);

        const welcomeEmbed = {
            color: 0x00FF99,
            description: `<@${user.id}> joined the Server!`,
            thumbnail: { url: avatarURL },
            fields: [{ name: 'Discord Join Date:', value: `<t:${Math.floor(Date.parse(member.joined_at) / 1000)}>`, inline: true }],
            timestamp: new Date().toISOString(),
        };

        if (inviter) welcomeEmbed.footer = { text: `Invited by: ${inviter.username} | ${invite.code}` };

        const welcomeMsg = await api.channels.createMessage(channels.modChannels.welcomeChannel, {
            embeds: [welcomeEmbed],
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    custom_id: invite ? `ban_${user.id}_${inviter.id}_${invite.code}` : `ban_${user.id}_none_none`,
                    label: invite ? '🔨 Ban User & Delete Invite' : '🔨 Ban',
                    style: 4
                }]
            }]
        });
        const createdTimestamp = (BigInt(user.id) >> 22n) + 1420070400000n; // Snowflake to MS
        if (Date.now() - Number(createdTimestamp) < 172800000) {
            await api.guilds.removeMember(guildId, user.id, { reason: "Account under 2 days old" });
            await api.channels.createMessage(channels.modChannels.mutelogChannel, {
                embeds: [{
                    title: 'A member was auto-kicked',
                    thumbnail: { url: avatarURL },
                    description: `**User:** <@${user.id}>\n**Reason:** New Account\n**Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`
                }]
            });
            return;
        }
        await api.channels.createMessage(channels.publicChannels.generalChannel, { content: `Welcome <@${user.id}>!` });
        if (!user.bot) {
            const dmChannel = await api.users.createDM(user.id);
            await api.channels.createMessage(dmChannel.id, {
                embeds: [{ title: `Welcome to the server!`, description: `Be sure to check out the rules.` }]
            }).catch(() => null); // Ignore blocked DMs
        }

        setTimeout(async () => {
            await api.channels.editMessage(channels.modChannels.welcomeChannel, welcomeMsg.id, {
                components: [{ type: 1, components: [{ ...welcomeMsg.components[0].components[0], disabled: true, label: '🔨 (Expired)' }] }]
            }).catch(() => null);
        }, 900000);

    } else if (action === 'leave') {
        await api.channels.createMessage(channels.modChannels.welcomeChannel, {
            embeds: [{
                description: `<@${user.id}> left the server.`,
                fields: [{ name: `Joined:`, value: `<t:${Math.floor(Date.parse(member.joined_at) / 1000)}:F>` }]
            }]
        });
    }
}
export async function handleban(ban, api, action) {
    const guildId = ban.guild_id;
    const user = ban.user;
    const channels = guildChannelMap[guildId];
    if (!channels?.modChannels?.banlogChannel) return;

    if (action === 'add') {
        // 1. Fetch Audit Logs to find the moderator (executor)
        const auditLogs = await api.guilds.getAuditLogs(guildId, {
            limit: 1,
            action_type: AuditLogEvent.MemberBanAdd
        });

        const entry = auditLogs.audit_log_entries[0];
        const executorId = entry?.user_id || "Unknown";
        const reason = entry?.reason || "No reason provided.";

        // 2. Mass Ban Logic (Buffer)
        let existingEntry = recentBans.get(executorId);

        if (existingEntry) {
            clearTimeout(existingEntry.timeout);
            existingEntry.bans.push({ user, reason });
        } else {
            existingEntry = {
                executorId,
                bans: [{ user, reason }]
            };
        }

        existingEntry.timeout = setTimeout(async () => {
            await sendMassBanEmbed(executorId, guildId, api, recentBans.get(executorId));
            recentBans.delete(executorId);
        }, 3000);

        recentBans.set(executorId, existingEntry);
    }
    else if (action === 'remove') {
        // Unban logging logic
        const avatarURL = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${user.id % 5}.png`;
        const bans = await getPunishments(user.id, ban.guild)
        const ban = bans.filter(ban => ban.type == 'Ban')
        await api.channels.createMessage(channels.modChannels.banlogChannel, {
            embeds: [{
                color: 0x309eff,
                title: 'A member was unbanned',
                thumbnail: { url: avatarURL },
                description: `**User**: <@${user.id}>\n**Tag**: \`${user.username}\`\n**Id**: \`${user.id}\``,
                timestamp: new Date().toISOString()
            }]
        });
    }
}
async function sendMassBanEmbed(executorId, guildId, api, data) {
    const channels = guildChannelMap[guildId];
    const banCount = data.bans.length;

    const description = banCount > 1
        ? `**Moderator <@${executorId}> banned ${banCount} users:**\n` + data.bans.map(b => `- <@${b.user.id}>: ${b.reason}`).join('\n')
        : `**<@${data.bans[0].user.id}> was banned by <@${executorId}>**\nReason: ${data.bans[0].reason}`;

    await api.channels.createMessage(channels.modChannels.banlogChannel, {
        embeds: [{
            color: 0xff3030,
            title: banCount > 1 ? 'Mass Ban Detected' : 'Member Banned',
            description: description,
            timestamp: new Date().toISOString()
        }]
    });
}

