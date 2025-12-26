import { Client, ActivityType, GatewayIntentBits, InteractionResponseType, GatewayOpcodes, GatewayDispatchEvents, InteractionType, ChannelType, AuditLogEvent, MessageFlags, ComponentType, ButtonStyle, TextInputStyle, PermissionFlagsBits, MessageType } from '@discordjs/core';
import { WebSocketManager } from '@discordjs/ws';
import { pathToFileURL } from 'node:url'
import { discordFetch } from './utilities/request.js';
import { REST } from '@discordjs/rest';
import { save, load } from './utilities/fileeditors.js';
import { LRUCache } from 'lru-cache';
import { readdir } from 'fs/promises';
import { join } from 'node:path';
import db, { increment, getstate, initialize, getUser, saveUser, editNote, viewNotes, getPunishments, editPunishment, appealsinsert, appealsget, appealupdate, getblacklist } from './Database/databaseAndFunctions.js';
import { initializeRankCardBase } from './utilities/rankcardgenerator.js';
import punishUser from './moderation/punishUser.js';
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'}
import forbbidenWordsData from './moderation/forbiddenwords.json' with {type: 'json'};
import globalwordsData from './moderation/globalwords.json' with {type: 'json'}
const rest = new REST({ version: 10 }).setToken(process.env.TOKEN)
const gateway = new WebSocketManager({
  token: process.env.TOKEN,
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildModeration | GatewayIntentBits.MessageContent | GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildMessageReactions | GatewayIntentBits.GuildModeration | GatewayIntentBits.GuildInvites | GatewayIntentBits.MessageContent,
  rest,
  presence: {
    status: 'online',
    activities: [{
      name: "Booting up...",
      type: ActivityType.Watching
    }]
  }
})
const client = new Client({ rest, gateway });
//bot variables
const messageIDs = await load('./Extravariables/EmbedIDs.json')
const starttime = Date.now()
const forbiddenWords = new Set(forbbidenWordsData);
const globalWords = new Set(globalwordsData);
const userMessageTrackers = new LRUCache({ max: 50, ttl: 15 * 60 * 1000, updateAgeOnGet: true, ttlAutopurge: true });
const messageCache = new LRUCache({ max: 50, ttl: 2 * 60 * 1000, updateAgeOnGet: true, ttlAutopurge: true });
const memberCache = new LRUCache({ max: 50, ttl: 2 * 60 * 1000, ttlAutopurge: true });
const recentBans = new Map()
const filepath = "Extravariables/applications.json"
const commandsmap = new Map()
const replies = new Map([
  ['bark', 'bark'],
  ['cute', 'You\'re Cute'],
  ['adorable', 'You\'re adorable'],
  ['grr', 'Don\'t you growl at me'],
  ['<@364089951660408843>', 'awooooooooo']
])
const multireplies = [
  { keyword: ['bark', 'at', 'you'], reply: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark" },
  { keyword: ['say', 'the', 'line'], reply: 'stay frosty :3' },
  { keyword: ['execute', 'order', '66'], reply: 'Not the Padawans!!!' },
  { keyword: ['hello', 'there'], reply: 'general Kenobi' }
];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function clearExpiredWarns(usersCollection) {
  await usersCollection.updateMany(
    { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
    { $set: { "punishments.$[elem].active": 0 } },
    { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
  ).catch(err => console.error('❌ An error occurred during warn clearance:', err));
}
function updateStatus() {
  const elapsedMs = Date.now() - starttime;
  let seconds = Math.floor(elapsedMs / 1000);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  gateway.send(0, {
    op: GatewayOpcodes.PresenceUpdate,
    d: { since: null, activities: [{ name: `${days}d ${hours}h ${minutes}m ${seconds}s`, type: ActivityType.Watching }], status: 'online', afk: false }
  })
}
async function buildNoteEmbed(targetuser, index, currentNote, length) {
  const mod = await discordFetch(`https://discord.com/api/v10/users/${currentNote.moderatorId}`);
  const user = await discordFetch(`https://discord.com/api/v10/users/${targetuser}`);
  const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
  return {
    color: 0xdddddd,
    thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
    description: `<@${user.id}> notes |  \`${index + 1} of ${length}\`\n> ${currentNote.note}`,
    footer: { text: `${mod.username} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` }
  }
};
async function buildLogEmbed(targetUser, log, idx, totalLogs) {
  const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
  const user = await discordFetch(`https://discord.com/api/v10/users/${targetUser}`);
  const moderator = await discordFetch(`https://discord.com/api/v10/users/${log.moderatorId}`);
  const formattedDate = new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
  const mins = Math.round(log.duration / 60000);
  const hours = Math.floor(mins / 60);

  return {
    color: LOG_COLORS[log.type],
    thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
    description: `**Member:**\n<@${log.userId}>\n\n**Type:**\n\`${log.type}\`\n\n**Punishments:**\n\`${log.weight} warn\`, ${log.duration ? (hours > 0 ? `\`${hours} hour Mute\`` : `\`${mins} minute Mute\``) : ''}\n\n**Reason:**\n\`${log.reason}\`\n\n**Warns at Log Time:**\n\`${log.weight}\`\n\n**Channel:**\n<#${log.channel}>\n\n[Event Link](${log.refrence})`,
    footer: { text: `Staff: ${moderator.username} | log ${idx + 1} of ${totalLogs} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${moderator.id}/${moderator.avatar}.png` }
  }
};
function generateButtons(gameBoard, player1, player2, currentplayer, disabled = false) {
  const rows = [];
  const boardStr = gameBoard.join(',');
  for (let i = 0; i < 3; i++) {
    const row = { type: 1, components: [] }
    for (let j = 0; j < 3; j++) {
      const index = i * 3 + j;
      row.components.push({
        type: ComponentType.Button,
        custom_id: `tictactoe-${boardStr}-${player1}-${player2}-${currentplayer}-${index}`,
        label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index], style: gameBoard[index] === 'X' ? ButtonStyle.Primary : gameBoard[index] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary,
        disabled: gameBoard[index] !== ' ' || disabled
      })
    }
    rows.push(row);
  }
  return rows;
}
async function sendMassBanEmbed(executorId, guildId, data) {
  const banlog = guildChannelMap[guildId].modChannels.banlogChannel;
  const banCount = data.bans.length;
  await discordFetch(`https://discord.com/api/v10/channels/@${banlog}/messages`, "POST", {
    embeds:
      [{
        color: 0xff3030,
        title: 'Mass Ban Detected',
        description: `**Moderator <@${executorId}> banned ${banCount} users:**\n` + data.bans.map(b => `- <@${b.user.id}>: ${b.reason}`).join('\n'),
        timestamp: new Date().toISOString()
      }]
  })
}
function getComparableEmbed(embedData) {
  if (!embedData) return null; const normalizeText = (text) => text ? text.replace(/\r\n/g, '\n').trim() : null;
  const cleanmessage = {
    title: normalizeText(embedData.title), description: normalizeText(embedData.description), url: normalizeText(embedData.url),
    color: embedData.color ?? null,
    fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
    author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
    footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
  }
  return JSON.stringify(cleanmessage);
}
async function getCommandData(filePaths) {
  const names = [];
  for (const filePath of filePaths) {
    const command = await import(pathToFileURL(filePath).href);
    if (command.default.data) {
      names.push(command.default.data)
      commandsmap.set(command.default.data.name, command.default.execute)
    }
    else console.warn(`⚠️ Skipping invalid file: ${filePath} (missing 'data' or 'execute' property).`);
  }
  return names;
}
async function findFiles(dir) {
  const filePaths = [];
  for (const dirent of await readdir(dir, { withFileTypes: true })) if (dirent.isFile() && dirent.name.endsWith('.js')) filePaths.push(join(dir, dirent.name)); else continue;
  return filePaths;
}
const handlers = {
  [GatewayDispatchEvents.GuildMemberAdd]: async ({ data: member }) => {
    const guildId = member.guild_id;
    const user = member.user;
    const welcomeChannel = guildChannelMap[guildId].modChannels.welcomeChannel;
    const generalchannel = guildChannelMap[guildId].publicChannels.generalChannel
    const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${user.id % 5}.png`;
    const invitereq = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/invites`)
    const currentInvites = await invitereq.json();
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
      timestamp: new Date().toISOString()
    };

    if (inviter) welcomeEmbed.footer = { text: `Invited by: ${inviter.username} | ${invite.code}` };

    const originalMessage = await discordFetch(`https://discord.com/api/v10/channels/@${welcomeChannel}/messages`, "POST", {
      embeds: [welcomeEmbed],
      components: [{
        type: ComponentType.ActionRow, components: [{
          type: ComponentType.Button,
          custom_id: invite ? `ban_${user.id}_${inviter.id}_${invite.code}` : `ban_${user.id}_none_none`,
          label: invite ? '🔨 Ban User & Delete Invite' : '🔨 Ban',
          style: ButtonStyle.Danger
        }]
      }]
    })
    const createdTimestamp = (BigInt(user.id) >> 22n) + 1420070400000n;
    if (Date.now() - Number(createdTimestamp) < 172800000) {
      await discordFetch(`https://discord.com/api/v10/guilds/members/${user.id}`, 'DELETE')
      await discordFetch(`https://discord.com/api/v10/channels/${welcomeChannel}`, 'POST',
        {
          embeds: [{
            title: 'A member was auto-kicked', thumbnail: { url: avatarURL }, description: `**User:** <@${user.id}>\n**Reason:** New Account\n**Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`
          }]
        })
      return;
    }
    await discordFetch(`https://discord.com/api/v10/channels/${generalchannel}`, 'POST',
      {
        embeds: [{
          thumbnail: { url: avatarURL },
          description: `Welcome ${user} to the server!\n\n**Account Created:** <t:${Math.floor(Number(createdTimestamp) / 1000)}:R>`,
          timestamp: new Date().toISOString()
        }]
      })

    if (!user.bot) {
      const dmChannel = await discordFetch(`https://discord.com/api/v10/users/@me/channels`, "POST", { recipient_id: user.id })
      await discordFetch(`https://discord.com/api/v10/channels/${dmChannel.id}`, 'POST', {
        description: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.`,
        thumbnail: { url: avatarURL }
      })
    }

    setTimeout(async () => {
      await discordFetch(`https://discord.com/api/v10/channel/${originalMessage.channel.id}/messages/${originalMessage.id}`, 'PATCH', {
        components: [{
          type: ComponentType.ActionRow, components: [{
            type: ComponentType.Button,
            custom_id: invite ? `ban_${user.id}_${inviter.id}_${invite.code}` : `ban_${user.id}_none_none`,
            label: invite ? '🔨 Ban User & Delete Invite' : '🔨 Ban',
            style: ButtonStyle.Danger
          }]
        }]
      })
    }, 15 * 60 * 1000)
  },
  [GatewayDispatchEvents.GuildMemberRemove]: async ({ data: member }) => {
    const user = member.user;
    const welcomeChannel = guildChannelMap[member.guild_id].modChannels.welcomeChannel;
    const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${user.id % 5}.png`;
    await discordFetch(`https://discord.com/api/v10/channels/@${welcomeChannel}`, 'POST', {
      embeds: [{ description: `<@${user.id}> left the server.`, thumbnail: avatarURL, fields: [{ name: `Joined:`, value: `<t:${Math.floor(Date.parse(member.joined_at) / 1000)}:F>` }] }]
    })
  },
  [GatewayDispatchEvents.GuildBanAdd]: async ({ data: ban }) => {
    const guildId = ban.guild_id;
    const user = ban.user;
    const auditLogs = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/audit-logs?limit=1&user_id=${user.id}&action_type=${AuditLogEvent.MemberBanAdd}`, 'GET')
    const entry = auditLogs.audit_log_entries[0];
    const executorId = entry?.user_id || "Unknown";
    const reason = entry?.reason || "No reason provided.";

    // 2. Mass Ban Logic (Buffer)
    let existingEntry = recentBans.get(executorId);
    if (existingEntry) { clearTimeout(existingEntry.timeout); existingEntry.bans.push({ user, reason }); }
    else existingEntry = { executorId, bans: [{ user, reason }] };
    existingEntry.timeout = setTimeout(async () => { await sendMassBanEmbed(executorId, guildId, recentBans.get(executorId)); recentBans.delete(executorId); }, 3000);
    recentBans.set(executorId, existingEntry);
  },
  [GatewayDispatchEvents.GuildBanRemove]: async ({ data: ban }) => {
    const guildId = ban.guild_id;
    const user = ban.user;
    const banlogchannel = guildChannelMap[guildId].modChannels?.banlogChannel;
    const avatarURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${user.id % 5}.png`;
    const punishments = await getPunishments(user.id, ban.guild)
    const entry = punishments.filter(ban => ban.type == 'Ban')
    await discordFetch(`https://discord.com/api/v10/channels/@${banlogchannel}/messages`, 'POST', {
      embeds: [{
        color: 0x309eff,
        title: 'A member was unbanned',
        thumbnail: { url: avatarURL },
        description: `**User**: <@${user.id}>\n**Tag**: \`${user.username}\`\n**Id**: \`${user.id}\`\n**Reason**: \`${entry.reason}\``,
        timestamp: new Date().toISOString()
      }]
    })

  },
  [GatewayDispatchEvents.InviteCreate]: async (invite) => {
    const invites = await load("Extravariables/invites.json")
    let guildinvites = invites[invite.data.guild_id]
    guildinvites.push({ code: invite.data.code, uses: invite.data.uses })
    invites[invite.data.guild_id] = guildinvites
    await save("Extravariables/invites.json", invites)
  },
  [GatewayDispatchEvents.InviteDelete]: async (invite) => {
    const invites = await load("Extravariables/invites.json")
    let guildinvites = invites[invite.data.guild_id]
    guildinvites = guildinvites.filter(inv => inv.code !== `${invite.data.code}`)
    invites[invite.data.guild_id] = guildinvites
    await save("Extravariables/invites.json", invites)
  },
  [GatewayDispatchEvents.MessageReactionAdd]: async ({ data: reaction }) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const guildEmbeds = messageIDs[guild_id];
    if (!guildEmbeds || !guildEmbeds.some(info => info.messageId === message_id)) return;
    const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
    if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
    const blacklist = await getblacklist(user_id, guild_id)
    if (blacklist.length > 0 && blacklist.find(r => r === roleID)) return;
    await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${user_id}/roles/${roleID}`, 'PUT');
  },
  [GatewayDispatchEvents.MessageReactionRemove]: async ({ data: reaction }) => {
    const { guild_id, user_id, message_id, emoji } = reaction;
    const guildEmbeds = messageIDs[guild_id];
    if (!guildEmbeds || !guildEmbeds.some(info => info.messageId === message_id)) return;
    const roleID = guildChannelMap[guild_id].reactions[emoji.id || emoji.name];
    if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
    const blacklist = await getblacklist(user_id, guild_id)
    if (blacklist.length > 0 && blacklist.find(r => r === roleID)) return;
    await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${user_id}/roles/${roleID}`, 'DELETE');
  },
  [GatewayDispatchEvents.GuildMemberUpdate]: async ({ data: member }) => {
    const guildId = member.guild_id;
    const userId = member.user.id;
    const oldMember = memberCache.get(`${guildId}-${userId}`);
    const oldNick = oldMember?.nick ?? oldMember?.user?.username;
    const newNick = member.nick ?? member.user.username;
    memberCache.set(`${guildId}-${userId}`, member);
    if (!oldMember || oldNick === newNick) return;
    const logChannelId = guildChannelMap[guildId].modChannels.namelogChannel;
    await discordFetch(`https://discord.com/api/v10/channels/${logChannelId}/messages`, 'POST', {
      embeds: [{
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${userId}/${member.user.avatar}.png` },
        color: 0x4e85b6,
        description: `<@${userId}> **changed their nickname**\n\n` +
          `**Before:**\n${oldNick}\n\n` +
          `**After:**\n${newNick}`,
        timestamp: new Date().toISOString()
      }]
    })
  },
  [GatewayDispatchEvents.MessageDelete]: async ({ data: deletedData }) => {
    const { id, channel_id, guild_id } = deletedData;
    const message = messageCache.get(id);
    if (!message) return;
    const { author, content, attachments } = messageCache.get(id);
    const logchannel = guildChannelMap[guild_id].modChannels.deletedlogChannel
    let title = `Message by <@${author.id}> was deleted in <#${channel_id}>\n`;
    if (attachments.length > 0 && !content) title = `Image by <@${author.id}> was deleted in <#${channel_id}>\n`;
    else if (attachments.length > 0 && content) title = `Image and text by <@${author.id}> was deleted in <#${channel_id}>\n`;
    const imageAttachments = attachments.filter(att => att.content_type?.startsWith('image/')).map(att => att.proxy_url);
    const mainEmbed = {
      color: 0xf03030,
      description: `${title}\n${content || ''}\n\n[Event Link](${`https://discord.com/channels/${guild_id}/${channel_id}`})\n\n`,
      thumbnail: { url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
      footer: { text: `ID: ${id}` },
      timestamp: new Date().toISOString()
    };
    if (imageAttachments.length > 0) mainEmbed.image = { url: imageAttachments[0] };
    const additionalImageEmbeds = imageAttachments.slice(1, 9).map(url => ({ url: `https://discord.com/channels/${guild_id}/${channel_id}/${id}`, image: { url: url } }));
    await discordFetch(`https://discord.com/api/v10/channels/${logchannel}/messages`, 'POST', { embeds: [mainEmbed, ...additionalImageEmbeds] })
  },
  [GatewayDispatchEvents.MessageUpdate]: async ({ data: newMessage }) => {
    const oldMessage = messageCache.get(newMessage.id);
    if (!oldMessage || oldMessage.author.bot || oldMessage.content === newMessage.content) return;
    const channelId = guildChannelMap[newMessage.guild_id].modChannels.updatedlogChannel;
    messageCache.set(newMessage.id, { ...oldMessage, ...newMessage });
    await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages`, 'POST', {
      embeds: [{
        description: `<@${oldMessage.author.id}> edited a message in <#${channelId}>\n\n **Before:**\n${oldMessage.content || ''}\n\n **After:**\n${newMessage.content || ''}\n\n[Jump to Message](https://discord.com/channels/${channelId}/${newMessage.id})`,
        color: 0x309eff,
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${oldMessage.author.id}/${oldMessage.author.avatar}.png` },
        footer: { text: `ID: ${newMessage.id}` },
        timestamp: new Date().toISOString()
      }]
    })
  },
  [GatewayDispatchEvents.MessageCreate]: async ({ data: message }) => {
    const { guild_id, author, member, content, channel_id, attachments, flags, type, mentions, embeds } = message;
    if (author.bot || !guild_id || type == MessageType.ChatInputCommand || type == MessageType.UserJoin) return;
    const guild = await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}`)
    // eslint-disable-next-line no-useless-escape
    const messageWords = content.replace(/<a?:\w+:\d+>/g, '').replace(/[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '');
    if (channel_id == guildChannelMap[guild_id].publicChannels.countingChannel) {
      const state = await getstate(guild_id);
      if (!parseInt(content)) return;
      if (state.count + 1 == parseInt(content) && state.lastuser !== author.id) {
        increment(guild_id, author.id);
        await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages/${message.id}/reactions/%E2%9C%85/@me`, 'PUT')
      }
      else {
        await initialize(guild_id);
        await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, 'POST', { content: `<@${author.id}> missed or already counted!(Number Reset!)`, message_reference: { message_id: message.id, channel_id: channel_id, } })
      }
      return;
    }
    const text = messageWords.toLowerCase()
    for (const [keyword, reply] of replies) {
      if (text.includes(keyword)) await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, 'POST', ({ content: reply, message_reference: { message_id: message.id } }))
    }
    for (const { keyword, reply } of multireplies) {
      if (keyword.every(k => text.includes(k))) await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, 'POST', { content: reply, message_reference: { message_id: message.id } })
    }
    if (text.includes('<@857445139416088647>')) {
      const emoji = 'SaltyEyes:1257522749635563561'
      await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`, 'PUT')
    }
    if (text.includes('bad') && text.includes('bot')) await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages/${message.id}/reactions/😡/@me`, 'PUT')

    const { userData, rank } = await getUser({ userId: author.id, guildId: guild_id });
    userData.xp += 20; userData.totalmessages += 1;
    const levelrole = guild.roles.find(role => role.id = "1334238580914131026")
    if (userData.xp >= Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20) {
      userData.level++; userData.xp = 0;
      await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, 'POST', {
        embeds: [{
          author: {
            name: `${author.username} you reached level ${userData.level}!`,
            icon_url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`
          },
          color: 0x00AE86,
          footer: { text: `you are now #${rank} in the server` }
        }]
      })
    }
    if (levelrole.name !== '@everyone' && userData.level >= 3 && !member.roles.includes("1334238580914131026"))
      await discordFetch(`https://discord.com/api/v10/${guild_id}/members/${author.id}/roles/1334238580914131026`, 'PUT')
    messageCache.set(message.id, message);
    const staffroles = ['1235295120665088030', '1409208962091585607']
    const sentByStaff = member.roles.some(roleId => staffroles.includes(roleId))
    if (sentByStaff || author.id === "521404063934447616") return;
    let { total, mediaCount, duplicateCounts, timestamps } = userMessageTrackers.get(`${author.id}-${guild_id}`) ?? ({ total: 0, mediaCount: 0, duplicateCounts: new Map(), timestamps: [] });
    const currentContentCount = (duplicateCounts.get(messageWords) || 0) + 1;
    const embedcheck = embeds.some(embed => { { return embed.type == 'image' || embed.type == "video" || embed.type == "gifv" || embed.type == "rich" } })
    timestamps.push(Date.now())
    if ((attachments.length > 0 || embedcheck) && (flags & 8192) === 0 && !Object.values(guildChannelMap[guild_id].mediaexclusions).some(id => id === channel_id)) {
      mediaCount += 1;
    }
    total += 1;
    const { Duplicatespamthreshold, mediathreshold, messagethreshold } = guildChannelMap[guild_id].automodsettings
    const recentmessages = timestamps.filter(stamp => Date.now() - stamp < 1000 * 8)
    const [hasInvite, everyonePing, duplicateSpam, mediaViolation, generalspam] = [
      /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i.test(content),
      mentions.some(m => m.id === guild_id),
      currentContentCount >= Duplicatespamthreshold,
      (mediaCount > mediathreshold && total < messagethreshold),
      recentmessages.length >= 7
    ];
    let globalword, matchedWord, capSpam = false;
    const words = messageWords.split(/\s+/g);
    const isChannelExcluded = Object.values(guildChannelMap[guild_id].exclusions).some(id => id === id === channel_id);
    for (const word of words) { if (globalWords.has(word)) { globalword = word; break; } if (!isChannelExcluded && forbiddenWords.has(word)) { matchedWord = word; break; } }
    if (messageWords) { duplicateCounts.set(messageWords, currentContentCount); if (messageWords.length >= 20) { const caps = messageWords.match(/[A-Z]/g); if (caps) capSpam = caps.length / messageWords.length > 0.7; } }
    if (duplicateSpam) duplicateCounts.clear();
    if (total >= messagethreshold) { total = 0; mediaCount = 0; }
    else if (mediaViolation) mediaCount = 0;
    if (globalword || matchedWord || hasInvite || everyonePing || generalspam || duplicateSpam)
      await discordFetch(`https://discord.com/api/v10/channels/${channel_id}/messages/${message.id}`, 'DELETE')
    const checks = [
      { flag: hasInvite, reason: 'Discord invite', Weight: 2 },
      { flag: globalword, reason: "Saying a slur", Weight: 2 },
      { flag: matchedWord, reason: `NSFW word/Curse Word`, Weight: 1 },
      { flag: everyonePing, reason: 'Mass pinging', Weight: 2 },
      { flag: generalspam, reason: 'Spamming', Weight: 1 },
      { flag: duplicateSpam, reason: 'Spamming the same message', Weight: 1 },
      { flag: mediaViolation, reason: 'Media violation', Weight: 1 },
      { flag: capSpam, reason: 'Spamming Caps', Weight: 1 }
    ];
    let totalWeight = checks.filter(check => check.flag).reduce((acc, check) => { return acc + check.Weight }, 0);
    if (totalWeight == 0) return;
    let reasonText = `AutoMod: ${checks.filter(check => check.flag).map(check => check.reason).join('; ')}`;
    const isNewUser = Date.now() - Date.parse(member.joined_at) < 2 * 24 * 60 * 60 * 1000 && userData.level < 3
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const commoninputs = { guild: guild, target: author, moderatorUser: { username: 'febot', id: '1420927654701301951', avatar: 'a96f0e3049ea9aae9798f45cc2479ebc' }, reason: reasonText, channelId: channel_id, isAutomated: true }
    const bannable = isNewUser && (totalWeight >= 3 || everyonePing || hasInvite)
    if (bannable) await punishUser({ ...commoninputs, banflag: true });
    else await punishUser({ ...commoninputs, currentWarnWeight: totalWeight })
    await saveUser({ userId: author.id, guildId: guild_id, userData: userData });
    userMessageTrackers.set(`${author.id}-${guild_id}`, { total: total, mediaCount: mediaCount, duplicateCounts: duplicateCounts, timestamps: timestamps })
  },
  [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction }) => {
    const { guild_id, member, member: { user: rawUser }, data: interactionData, channel_id } = interaction;
    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = commandsmap.get(interactionData.name);
      if (command) {
        try { await command({ interaction }); await sleep(1000); }
        catch (error) {
          console.error(`❌ Command Error:`, error);
          await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { content: 'Error executing command!', flags: MessageFlags.Ephemeral })
        }
      }
    }
    if (interaction.type === InteractionType.ModalSubmit) {
      const customId = interactionData.custom_id;
      if (customId.startsWith('appeal')) {
        const fields = interactionData.components;
        const reason = fields[1].component.value;
        const justification = fields[2].component.value;
        const extra = fields[3].component.value;
        const guildId = fields[0].component.values[0];
        const guildroles = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/roles`)
        console.log(guildroles)
        const appealChannel = guildChannelMap[guildId].modChannels.appealChannel;
        const adminrole = guildroles.find(role => role.permissions == '8459633874173951' && role.hoist && !role.managed)
        const modrole = guildroles.find(role => role.permissions == '7882955489812486' && !role.managed)
        const appealMsg = await discordFetch(`https://discord.com/api/v10/channels/${appealChannel}/messages`, 'POST', {
          content: `<@&${adminrole.id}> <@&${modrole.id}>`,
          embeds: [{
            author: { name: `${rawUser.username}`, icon_url: `https://cdn.discordapp.com/avatars/${rawUser.id}/${rawUser.avatar}.png` },
            color: 0x13cbd8,
            title: `Ban appeal`,
            fields: [
              { name: 'Why did you get banned?', value: `${reason}` },
              { name: 'Why do you believe that your appeal should be accepted?', value: `${justification}` },
              { name: 'Is there anything else you would like us to know?', value: `${extra}` }],
            footer: { text: `User ID: ${rawUser.id}` },
            timestamp: new Date().toISOString()
          }],
          components: [{
            type: ComponentType.ActionRow,
            components: [
              { type: ComponentType.Button, custom_id: `unban_approve_${interaction.user.id}`, label: 'Approve', style: ButtonStyle.Success },
              { type: ComponentType.Button, custom_id: `unban_reject_${interaction.user.id}`, label: 'Reject', style: ButtonStyle.Danger }
            ]
          }]
        })
        await discordFetch(`https://discord.com/api/v10/channels/${appealChannel}/messages/${appealMsg.id}/threads`, 'POST', { type: ChannelType.PublicThread, name: `${rawUser.username}` })
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'Your appeal has been submitted!', flags: MessageFlags.Ephemeral } })
        await appealsinsert(rawUser.id, guildId, reason, justification, extra);
      }
      if (customId.startsWith('situations')) {
        const fields = interactionData.components;
        const applications = await load(filepath);
        const application = applications[interaction.member.user.id]
        const guild = await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}`)
        application.dmmember = fields[0].component.value;
        application.argument = fields[1].component.value;
        application.ambiguous = fields[2].component.value;
        application.staffbreakrule = fields[3].component.value;
        application.illegal = fields[4].component.value;
        const applicationChannelid = guildChannelMap[guild_id].modChannels.applicationChannel
        await discordFetch(`https://discord.com/api/v10/channels/${applicationChannelid}/messages`, 'POST', {
          embeds: [{
            author: { name: `@${interaction.member.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${interaction.member.user.id}/${interaction.member.user.avatar}.png` },
            color: 0x13b6df,
            title: `Mod Application for ${guild.name}`,
            fields: [
              { name: 'Age Range:', value: `${application.Agerange}`, inline: false },
              { name: 'Prior Experience:', value: `${application.Experience}`, inline: false },
              { name: 'Have you been warned/muted/kicked/banned before?(be honest)', value: `${application.History}`, inline: false },
              { name: 'Timezone:', value: `${application.Timezone}`, inline: false },
              { name: `How long have you been a member in ${guild.name}?`, value: `${application.Stayed}` },
              { name: `How active are you in ${guild.name}?`, value: `${application.Activity}`, inline: false },
              { name: 'Why do you want to be a mod?:', value: `${application.Why}`, inline: false },
              { name: 'What is your definition of a troll?', value: `${application.Trolldef}`, inline: false },
              { name: 'What is your definition of a raid?', value: `${application.Raiddef}` },
              { name: 'You disagree with a staff punishment. What would you do?', value: `${application.Staffissues}`, inline: false },
              { name: 'How would you handle a member report?', value: `${application.Memberreport}`, inline: false },
              { name: 'A member messages you about being harrassed. How would you handle the situation?', value: `${application.dmmember}`, inline: false },
              { name: 'Users are arguing in general chat. explain your de-escalation steps.', value: `${application.argument}`, inline: false },
              { name: 'A member DMs you about a rule-breaking DM. What is your course of action?', value: `${application.ambiguous}`, inline: false },
              { name: 'A moderator is breaking a rule. What is your course of action?', value: `${application.staffbreakrule}`, inline: false },
              { name: 'A user share illegal content. What are the steps you take?', value: `${application.illegal}`, inline: false }]
          }],
          timestamp: new Date().toISOString()
        })
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'your application was successfuly submitted!!' } })
        delete applications[interaction.member.user.id];
        save(filepath, applications)
      }
      if (customId.startsWith('Defs, reasons, and issues')) {
        const fields = interactionData.components;
        const applications = await load(filepath)
        const application = applications[interaction.member.user.id]
        if (application.Memberreport) {
          await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: 'You have already filled out this section. Click below to continue to the next section.',
              components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, custom_id: 'next_modal_three', label: 'skip section', style: ButtonStyle.Primary }] }],
              flags: MessageFlags.Ephemeral
            }
          })
          return;
        } else {
          application.Why = fields[0].component.value;
          application.Trolldef = fields[1].component.value;
          application.Raiddef = fields[2].component.value;
          application.Staffissues = fields[3].component.value;
          application.Memberreport = fields[4].component.value;
          await save(filepath, applications);
          await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: 'Part 2 of your application has saved! Click below to continue to the next section.',
              components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, custom_id: 'next_modal_three', label: 'Next Section', style: ButtonStyle.Primary }] }],
              flags: MessageFlags.Ephemeral
            }
          })
        }
      }
      if (customId.startsWith('server')) {
        const fields = interactionData.components;
        const applications = await load(filepath)
        const application = applications[interaction.member.user.id]
        application.Agerange = fields[0].component.values[0];
        application.Experience = fields[1].component.value;
        application.History = fields[2].component.value;
        application.Timezone = fields[3].component.value;
        application.Activity = fields[4].component.value;
        await save(filepath, applications)
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: 'Part 1 of your application has been saved! Click below to continue to the next section.',
            components: [{ type: ComponentType.ActionRow, components: [{ type: 2, custom_id: 'next_modal_two', label: 'Next Section', style: ButtonStyle.Primary }] }],
            flags: MessageFlags.Ephemeral
          }
        })
      }
    }
    if (interaction.type === InteractionType.MessageComponent) {
      const customId = interactionData.custom_id;
      if (customId.startsWith('ban_')) {
        const guild = await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}/`)
        const [, targetId, inviterId, inviteCode] = customId.split('_');
        const permissions = BigInt(member.permissions);
        if (!(permissions & 0x4n)) {
          return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'jrs cannot use this button.', flags: MessageFlags.Ephemeral } })
        }
        const memberToBan = await discordFetch(`https://discord.com/api/v10/users/${targetId}/`)
        if (!interaction.member.permissions.has('BAN_MEMBERS')) {
          return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'Missing permission.', flags: MessageFlags.Ephemeral } })
        }
        const messageid = interaction.message.id;
        let finalMessage = ``;
        punishUser({ interaction: interaction, guild: guild, target: memberToBan, moderatorUser: interaction.member.user, reason: 'troll', channelId: channel_id, banflag: true, messageid: messageid });
        finalMessage = `Banned ${memberToBan}`;

        if (inviterId !== 'no inviter') {
          const friend = await discordFetch(`https://discord.com/api/v10/users/${inviterId}/`)
          punishUser({ interaction: interaction, guild: guild, target: friend, moderatorUser: interaction.member.user, reason: 'troll', channelId: channel_id, banflag: true, messageid: messageid });
          finalMessage += `, inviter <@${inviterId}>.`;
        }

        if (inviteCode !== 'no invite code') {
          const invites = await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}/invites`)
          const targetinvite = invites.filter(inv => inv.code === inviteCode)
          if (targetinvite) { targetinvite.delete(); finalMessage += ' Associated Invite was deleted' }
        }
        await discordFetch(`https://discord.com/api/v10/channel/${interaction.channel.id}/messages${interaction.message.id}`, 'POST', {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: { embeds: [{ description: finalMessage }] }
        })
      }
      else if (customId.startsWith('unban_')) {
        const customIdParts = customId.split('_')
        const targetUser = await discordFetch(`https://discord.com/api/v10/users/${customIdParts[2]}`)
        const guild = await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}`)
        const appeals = await appealsget(targetUser.id, guild_id)
        const Adminchannelid = guildChannelMap[guild_id].modChannels.adminChannel;
        if ((BigInt(interaction.member.permissions) & 0x8n) == 0x0n) {
          await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST',
            { data: { content: `Please wait for an admin to make a decision. `, flags: MessageFlags.Ephemeral } })
          await discordFetch(`https://discord.com/api/v10/channels/${Adminchannelid}/messages`, 'POST', { content: `Letting you know <@${interaction.user.id}> tried to jump the gun on an appeal.` })
          return;
        }
        const ext = targetUser.avatar.startsWith('a_') ? 'gif' : 'png'
        const appealEmbed = {
          color: 0x13cbd8,
          title: `Ban appeal`,
          author: { name: `${targetUser.username}`, iconURL: `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.${ext}` },
          fields: [
            { name: 'Why did you get banned?', value: `${appeals.reason} ` },
            { name: 'Why do you believe that your appeal should be accepted?', value: `${appeals.justification} ` },
            { name: 'Is there anything else you would like us to know?', value: `${appeals.extra}` }
          ],
          footer: { text: `User ID: ${targetUser.id}` },
          timestamp: new Date().toISOString()
        }
        const response = { author: { name: `${targetUser.username} `, iconURL: `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.${ext}` }, color: null, title: null, description: null }
        let outcome = null
        switch (customIdParts[1]) {
          case 'reject':
            response.color = 0x890000; response.title = 'Appeal Denied...';
            response.description = `<@${targetUser.id}> your ban appeal has been denied from ${guild.name}.`;
            appealEmbed.color = 0x890000; appealEmbed.fields.push({ name: 'Denied by:', value: `<@${interaction.member.user.id}> `, inline: true });
            break;
          case 'approve': {
            const appealinvites = { '1231453115937587270': 'https://discord.gg/xpYnPrSXDG', '1342845801059192913': 'https://discord.gg/nWj5KvgUt9' }
            try { await guild.bans.fetch({ userId: targetUser.id, force: true }) }
            catch {
              await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST',
                { type: InteractionResponseType.UpdateMessage, data: { content: `No recent ban for ${targetUser} found` } }); return;
            }
            await discordFetch(`https://discord.com/api/v10/guilds/${guild_id}/bans/${rawUser.id}`, 'DELETE')
            response.color = 0x008900; response.title = 'Appeal Accepted!';
            response.description = `<@${targetUser.id}> your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealinvites[guild_id]}`;
            appealEmbed.color = 0x008900; appealEmbed.fields.push({ name: 'Approved by:', value: `<@${interaction.member.user.id}> `, inline: true });
            outcome = true
            break;
          }
        }
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.UpdateMessage,
          data: {
            embeds: [appealEmbed],
            components: [{
              type: ComponentType.ActionRow,
              components: [
                { type: ComponentType.Button, custom_id: `unban_approve_${targetUser.id}_${guild_id}`, label: 'Approve', style: ButtonStyle.Success, disabled: true },
                { type: ComponentType.Button, custom_id: `unban_reject_${targetUser.id}_${guild_id}`, label: 'Reject', style: ButtonStyle.Danger, disabled: true }]
            }]
          }
        })
        await appealupdate(targetUser.id, guild_id, outcome)
        const dmchannel = await discordFetch(`https://discord.com/api/v10/users/@me/channels`, 'POST', { recipient_id: targetUser.id });
        await discordFetch(`https://discord.com/api/v10/channels/${dmchannel.id}/messages`, 'POST', { embeds: [response] });
      }
      else if (customId.startsWith('next_modal_three')) {
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.Modal,
          data: {
            custom_id: 'situations', title: 'Situations (3/3)',
            components: [
              { type: ComponentType.Label, label: 'A member messages you about being harrassed', component: { type: ComponentType.TextInput, custom_id: 'dmmember', required: true, style: TextInputStyle.Paragraph, max_length: 350 } },
              { type: ComponentType.Label, label: 'Users are arguing in general chat', component: { type: ComponentType.TextInput, custom_id: 'arguments', style: TextInputStyle.Paragraph, required: true, max_length: 350 } },
              { type: ComponentType.Label, label: 'A member DMs you about a rule-breaking DM', component: { type: ComponentType.TextInput, custom_id: 'rulebreakdm', required: true, style: TextInputStyle.Paragraph, max_length: 350 } },
              { type: ComponentType.Label, label: 'Staff is failing to follow the rules', component: { type: ComponentType.TextInput, custom_id: 'staffrulebreak', required: true, style: TextInputStyle.Paragraph, max_length: 350 } },
              { type: ComponentType.Label, label: 'A user shares illegal content', component: { type: ComponentType.TextInput, custom_id: 'illegal', required: true, style: TextInputStyle.Paragraph, max_length: 350 } }]
          }
        })
      }
      else if (customId.startsWith('next_modal_two')) {
        const applications = await load(filepath);
        const application = applications[interaction.member.user.id]
        if (application.Memberreport) {
          await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: 'You have already filled out this part. Click the button below to continue to the next section.',
              components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, custom_id: 'next_modal_three', label: 'skip Section', style: ButtonStyle.Primary }] }],
              flags: MessageFlags.Ephemeral
            }
          })
        } else {
          await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
            type: InteractionResponseType.Modal,
            data: {
              custom_id: 'Defs, reasons, and issues',
              title: 'Definitions, Why mod, and Staff issues (2/3)',
              components: [
                { type: ComponentType.Label, label: 'Why should you be on the team?', component: { type: ComponentType.TextInput, custom_id: 'why', required: true, style: TextInputStyle.Paragraph, max_length: 500 } },
                { type: ComponentType.Label, label: 'What is your definition of a troll?', component: { type: ComponentType.TextInput, custom_id: 'trolldef', required: true, style: TextInputStyle.Short, max_length: 65 } },
                { type: ComponentType.Label, label: 'What is your definition of a raid?', component: { type: ComponentType.TextInput, custom_id: 'raiddef', required: true, style: TextInputStyle.Short, max_length: 65 } },
                { type: ComponentType.Label, label: 'You disagree with an action from staff', component: { type: ComponentType.TextInput, custom_id: 'staffissues', required: true, style: TextInputStyle.Paragraph, max_length: 300 } },
                { type: ComponentType.Label, label: 'How would you handle a member report?', component: { type: ComponentType.TextInput, custom_id: 'memberreport', required: true, style: TextInputStyle.Paragraph, max_length: 300 } }
              ]
            }
          })
        }
      }
      else if (customId.startsWith('role_select')) {
        const reactions = guildChannelMap[guild_id].roles
        const roles = interactionData.values
        let currentRoles = [...member.roles]
        let added = []
        let removed = []
        for (const [key, roleID] of Object.entries(reactions)) {
          if (roles.includes(key) && !currentRoles.includes(roleID)) {
            currentRoles.push(roleID);
            added.push(roleID);
          }
          else if (!roles.includes(key) && currentRoles.includes(roleID)) {
            currentRoles = currentRoles.filter(id => id !== roleID);
            removed.push(roleID);
          }
        }
        added = added.map(role => { return `<@&${role}>` })
        removed = removed.map(role => { return `<@&${role}>` })
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST',
          {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content: `Added roles: ${added.join(',')} removed roles: ${removed.join(',')}`, flags: MessageFlags.Ephemeral }
          }
        )
      }
      else if (customId.startsWith('note')) {
        const [, action, target, index, opener, timestamp] = customId.split('-')
        let allnotes = await viewNotes(target, guild_id)
        if (interaction.member.user.id !== opener)
          return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'You did not initate this command', flags: MessageFlags.Ephemeral } })
        const isAdmin = (BigInt(interaction.member.permissions) & PermissionFlagsBits.Administrator) !== 0n;
        let currentIndex = Number(index)
        if (Date.now() - parseInt(timestamp) > 15 * 60 * 1000) {
          return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
            type: InteractionResponseType.UpdateMessage,
            data: {
              components: [{
                type: ComponentType.ActionRow, components: [
                  { type: ComponentType.Button, custom_id: `note-prev-${target}-${currentIndex}-${opener}-${Date.now()}`, label: '⬅️ Back', style: ButtonStyle.Secondary, disabled: true },
                  { type: ComponentType.Button, custom_id: `note-next-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Next ➡️', style: ButtonStyle.Secondary, disabled: true },
                  isAdmin ? { type: ComponentType.Button, custom_id: `note-del-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Delete', style: ButtonStyle.Danger, disabled: true } : []
                ]
              }]
            }
          });
        }
        let currentNote = allnotes[currentIndex]
        switch (action) {
          case 'del': {
            if (currentNote.timestamp - Date.now() < 48 * 60 * 60 * 1000 || isAdmin) {
              editNote({ userId: target, guildId: guild_id, id: currentNote._id })
              allnotes = await viewNotes(target, interaction.guild.id);
              if (allnotes.length === 0) return
              await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
                type: InteractionResponseType.UpdateMessage,
                data: { embeds: [{ description: "All notes deleted.", color: 0xdddddd }] }
              })
              currentIndex = Math.min(currentIndex, allnotes.length - 1)
            } else
              await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
                type: InteractionResponseType.UpdateMessage,
                data: { content: `${interaction.user}, please contact an admin as time has expired.`, flags: MessageFlags.Ephemeral }
              })
            break;
          }
          default: currentIndex = action == 'next' ? currentIndex + 1 : currentIndex - 1
            break;
        }
        currentNote = allnotes[currentIndex]
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.UpdateMessage,
          data: {
            embeds: [await buildNoteEmbed(target, currentIndex, currentNote, allnotes.length)],
            components: [{
              type: ComponentType.ActionRow, components: [
                { type: ComponentType.Button, custom_id: `note-prev-${target}-${currentIndex}-${opener}-${Date.now()}`, label: '⬅️ Back', style: ButtonStyle.Secondary, disabled: currentIndex === 0 },
                { type: ComponentType.Button, custom_id: `note-next-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Next ➡️', style: ButtonStyle.Secondary, disabled: currentIndex >= allnotes.length - 1 },
                { type: ComponentType.Button, custom_id: `note-del-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Delete', style: ButtonStyle.Danger, disabled: false }
              ]
            }]
          }
        })
      }
      else if (customId.startsWith('modlog')) {
        const [, action, target, index, opener] = customId.split('-')
        const isAdmin = (BigInt(interaction.member.permissions) & PermissionFlagsBits.Administrator) !== 0n;
        if (interaction.member.user.id !== opener)
          return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'You did not initate this command', flags: 64 } })
        let currentIndex = parseInt(index);
        let allLogs = await getPunishments(target, guild_id);
        let currentLog = allLogs[index]
        switch (action) {
          case 'del':
            await editPunishment({ userId: target, guildId: guild_id, id: currentLog._id })
            allLogs = await getPunishments(target, guild_id);
            if (allLogs.length < 1)
              return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', { type: InteractionResponseType.UpdateMessage, data: { embeds: [{ description: `All logs for <@${target}> deleted.` }], components: [] } })
            currentIndex -= 1
            if (currentIndex < 0) currentIndex = 0
            break;
          default: currentIndex = action == 'next' ? currentIndex + 1 : currentIndex - 1
            break;
        }
        currentLog = allLogs[currentIndex];
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.UpdateMessage,
          data: {
            embeds: [await buildLogEmbed(target, currentLog, currentIndex, allLogs.length)],
            components: [{
              type: 1, components: [
                { type: 2, custom_id: `modlog-prev-${target}-${currentIndex}-${opener}-${Date.now()}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
                { type: 2, custom_id: `modlog-next-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allLogs.length - 1 },
                ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${target}-${currentIndex}-${opener}-${Date.now()}`, label: 'Delete', style: 4, disabled: false }] : [])
              ]
            }]
          }
        })
      }
      else if (customId.startsWith('rps')) {
        const [, move] = customId.split('-');
        const opponentchoices = ['Rock', 'Paper', 'Scissors']
        const opponentchoice = opponentchoices[Math.floor(Math.random() * 3)];
        const beats = { Rock: 'Scissors', Paper: 'Rock', Scissors: 'Paper' }
        let result = '';
        beats[move] === opponentchoice ? result = 'you win!!!'
          : beats[opponentchoice] === move ? result = 'Febot Wins!!!'
            : result = "it's a tie!!"
        if (result === 'you win!!!') {
          const { userData } = await getUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, modflag: true })
          userData.coins += 20;
          saveUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, userData: userData });
        }
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.UpdateMessage,
          data: {
            embeds: [{ title: result, description: `You chose **${move}**.\nOpponent chose **${opponentchoice}**.`, color: 0xffa500 }],
            components: []
          }
        })
      }
      else if (customId.startsWith('logos')) {
        const [, guess, logo] = customId.split('-')
        const updatedbuttons = interaction.message.components[0].components.map(button => {
          const buttonbrand = button.custom_id.split('-')[1];
          let style = ButtonStyle.Secondary;
          if (buttonbrand === logo) style = ButtonStyle.Success;
          else if (buttonbrand === guess && guess !== logo) style = ButtonStyle.Danger
          return { type: ComponentType.Button, label: button.label, custom_id: button.custom_id, style: style, disabled: true }
        })
        await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.UpdateMessage,
          data: { components: [{ type: ComponentType.ActionRow, components: updatedbuttons }] }
        })
        if (guess === logo) {
          const { userData } = await getUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, modflag: true });
          userData.coins += 20;
          saveUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, userData: userData });
        }
      }
      else if (customId.startsWith('tictactoe')) {
        const winningConditions = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        let [, gameBoard, player1, player2, currentplayer, index] = customId.split('-');

        if (interaction.member.user.id !== currentplayer)
          return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
            type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'You are not in this game or It\'s not your turn.', flags: MessageFlags.Ephemeral }
          })
        gameBoard = gameBoard.split(',');
        const marker = (currentplayer === player1) ? 'X' : 'O';
        gameBoard[index] = marker
        const tie = gameBoard.every(cell => cell !== ' ')
        const win = winningConditions.some(condition => { return condition.every(index => { return gameBoard[index] === marker }); })
        if (tie || win) {
          if (win) {
            const { userData } = await getUser({ userId: currentplayer.id, guildId: interaction.guild.id, modflag: true })
            userData.coins += 100;
            saveUser({ userId: currentplayer.id, guildId: interaction.guild.id, userData: userData })
          }
          return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
            type: InteractionResponseType.UpdateMessage,
            data: {
              embeds: [{ color: win ? 0xceab10 : 0x555555, title: 'TicTacToe', description: win ? `<@${currentplayer}> wins!!` : `It's a draw!` }],
              components: generateButtons(gameBoard, player1, player2, currentplayer, true)
            }
          })
        }
        currentplayer = (currentplayer === player1) ? player2 : player1;
        return await discordFetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, 'POST', {
          type: InteractionResponseType.UpdateMessage,
          data: {
            embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: ` It's <@${currentplayer}> turn!` }],
            components: generateButtons(gameBoard, player1, player2, currentplayer)
          }
        })
      }
    }
  }
}

async function main() {
  initializeRankCardBase();
  Object.entries(handlers).forEach(([eventName, listenerFunc]) => { client.addListener(eventName, listenerFunc); });
  await gateway.connect(process.env.TOKEN)
  const commands = await getCommandData(await findFiles('commands'))
  await discordFetch(`https://discord.com/api/v10/applications/1420927654701301951/commands`, 'PUT', commands)
  updateStatus(); setInterval(updateStatus, 5000)
  await clearExpiredWarns(db.collection('users')); setInterval(async () => { await clearExpiredWarns(db.collection('users')) }, 5 * 60 * 1000)
  const invites = {}
  const guilds = await discordFetch(`https://discord.com/api/v10/users/@me/guilds`)
  for (const guild of await guilds) {
    const guildinvites = await discordFetch(`https://discord.com/api/v10/guilds/${guild.id}/invites`)
    invites[guild.id] = guildinvites.map(invite => { return { code: invite.code, uses: invite.uses } })
    const guildChannelMap = await load("./Extravariables/guildconfiguration.json")
    if (!messageIDs[guild.id]) messageIDs[guild.id] = [];
    const messageconfigs = guildChannelMap[guild.id].messageConfigs ?? null
    if (!messageconfigs) { console.log(`No config found for guild ID: ${guild.id}`); return; }
    const embedTasks = Object.entries(messageconfigs).map(async ([embedName, config]) => {
      const { channelid, embeds, components, reactions } = config;
      const embed = embeds.map(e => { if (typeof e.color === 'string') e.color = parseInt(e.color.replace('#', ''), 16); return e; });
      try {
        const existingdata = messageIDs[guild.id]?.find(m => m.name === embedName)
        const message = await discordFetch(`https://discord.com/api/v10/channels/${channelid}/messages/${existingdata.messageId}`)
        const different = message.embeds.map(embed => getComparableEmbed(embed)).join('|||') !== embed.map(embed => getComparableEmbed(embed)).join('|||')
        if (different) { await discordFetch(`https://discord.com/api/v10/channels/${channelid}/messages/${message.id}`, 'PATCH', { embeds: embed, ...components }) }
      } catch {
        const msg = await discordFetch(`https://discord.com/api/v10/channels/${channelid}/messages`, 'POST', { embeds: embed, components: components })
        messageIDs[guild.id] = messageIDs[guild.id].filter((message) => message.name !== embedName);
        if (reactions)
          for (const reaction of reactions) {
            await discordFetch(`https://discord.com/api/v10/channels/${channelid}/messages/${msg.id}/reactions/${reaction}/@me`, 'PUT');
            await sleep(750)
          }
        console.log(`📝 Sent '${embedName}'. Message ID: `, msg.id);
        messageIDs[guild.id].push({ name: embedName, messageId: msg.id })
      }
    })
    await Promise.allSettled(embedTasks);
    await save('./Extravariables/EmbedIDs.json', messageIDs);
    if (guildChannelMap[guild.id].publicChannels?.countingChannel) {
      const counting = guildChannelMap[guild.id].publicChannels.countingChannel
      const messages = await discordFetch(`https://discord.com/api/v10/channels/${counting}/messages?limit=5`)
      for (let i = 0; i < 5; i++) { if (parseInt(messages[i].content.trim())) { await initialize(guild.id, parseInt(messages[i].content.trim())); break; } else continue; }
    }
  }
  save("Extravariables/invites.json", invites)
  console.log(`logged in.`)
}
await main().catch(console.error());
