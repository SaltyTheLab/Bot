import { Client, ActivityType, API, GatewayIntentBits, GatewayOpcodes, GatewayDispatchEvents, InteractionType, ChannelType } from '@discordjs/core';
import { WebSocketManager } from '@discordjs/ws';
import { REST } from '@discordjs/rest';
import { getCommandData, findFiles, save, load } from './utilities/fileeditors.js';
import { config } from 'dotenv';
import { LRUCache } from 'lru-cache';
import punishUser from './moderation/punishUser.js';
import { initializeRankCardBase } from './utilities/rankcardgenerator.js';
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'}
import embedsenders from './embeds/embeds.js';
import forbbidenWordsData from './moderation/forbiddenwords.json' with {type: 'json'};
import globalwordsData from './moderation/globalwords.json' with {type: 'json'}
import { handleinvites, handleban, MemberHandler, handleReactionChange } from './utilities/listenerfunctions.js';
import db, { increment, reset, getUser, saveUser, initialize, appealsinsert, appealsget, appealupdate, editNote, viewNotes, editPunishment, getPunishments } from './Database/databaseAndFunctions.js';
config();
const rest = new REST({ version: 10 }).setToken(process.env.TOKEN)
const api = new API(rest)
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
const starttime = Date.now()
const forbiddenWords = new Set(forbbidenWordsData);
const globalWords = new Set(globalwordsData);
const userMessageTrackers = new LRUCache({ max: 50, ttl: 15 * 60 * 1000, updateAgeOnGet: true, ttlAutopurge: true });
const messageCache = new LRUCache({ max: 50, ttl: 15 * 60 * 1000, updateAgeOnGet: true, ttlAutopurge: true });
const memberCache = new LRUCache({ max: 200, ttl: 15 * 60 * 1000, ttlAutopurge: true });
const filepath = "Extravariables/applications.json"
const commands = await getCommandData(await findFiles('commands'))
const replies = new Map([
  ['bark', 'bark'],
  ['cute', 'You\'re Cute'],
  ['adorable', 'You\'re adorable'],
  ['potato', 'tomato, potato, potato, patato'],
  ['grr', 'Don\'t you growl at me'],
  ['<@364089951660408843>', 'awooooooooo']
])
const multireplies = [
  { keyword: ['bark', 'at', 'you'], reply: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark" },
  { keyword: ['say', 'the', 'line'], reply: 'stay frosty :3' },
  { keyword: ['execute', 'order', '66'], reply: 'Not the Padawans!!!' },
  { keyword: ['hello', 'there'], reply: 'general Kenobi' }
];
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
    d: {
      since: null,
      activities: [{
        name: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        type: ActivityType.Watching
      }],
      status: 'online',
      afk: false
    }
  })
}
async function buildNoteEmbed(api, target, index, currentNote, length) {
  const mod = await api.users.get(currentNote.moderatorId);
  const user = await api.users.get(target)
  const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  const modext = mod.avatar.startsWith('a_') ? 'gif' : 'png';
  return {
    color: 0xdddddd,
    thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}` },
    description: `<@${user.id}> notes |  \`${index + 1} of ${length}\`\n\n> ${currentNote.note}`,
    footer: { text: `${mod.username} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.${modext}` }
  }
};
async function buildLogEmbed(api, targetUser, log, idx, totalLogs) {
  const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
  const mod = await api.users.get(log.moderatorId);
  const user = await api.users.get(targetUser)
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  const modext = mod.avatar.startsWith('a_') ? 'gif' : 'png';
  const formattedDate = new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
  const mins = Math.round(log.duration / 60000);
  const hours = Math.floor(mins / 60);
  return {
    color: LOG_COLORS[log.type],
    thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}` },
    fields: [
      { name: 'Member', value: `<@${log.userId}>`, inline: true },
      { name: 'Type', value: `\`${log.type}\``, inline: true },
      ...log.duration ? [{ name: 'Duration', value: `\`${hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${mins} minute${mins !== 1 ? 's' : ''}`}\``, inline: false }] : [],
      { name: 'Reason', value: `\`${log.reason}\``, inline: false },
      { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: true },
      { name: 'Log Status', value: log.active == 1 ? '✅ Active' : '❌ Inactive/cleared', inline: true },
      { name: 'Channel', value: `<#${log.channel}>\n\n [Event Link](${log.refrence})`, inline: false }
    ],
    footer: { text: `Staff: ${mod.username} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png${modext}` }
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
        type: 2, custom_id: `tictactoe-${boardStr}-${player1}-${player2}-${currentplayer}-${index}`, label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index], style: gameBoard[index] === 'X' ? 1 : gameBoard[index] === 'O' ? 4 : 2, disabled: gameBoard[index] !== ' ' || disabled
      })
    }
    rows.push(row);
  }
  return rows;
}
const handlers = {
  [GatewayDispatchEvents.GuildMemberAdd]: async ({ data: member }) => { MemberHandler(member, api, 'add') },
  [GatewayDispatchEvents.GuildMemberRemove]: async ({ data: member }) => { MemberHandler(member, api, 'remove') },
  [GatewayDispatchEvents.GuildBanAdd]: async ({ data: ban }) => { handleban(ban, api, 'add') },
  [GatewayDispatchEvents.GuildBanRemove]: async ({ data: ban }) => { handleban(ban, api, 'remove') },
  [GatewayDispatchEvents.InviteCreate]: async (invite) => { await handleinvites(invite, 'add') },
  [GatewayDispatchEvents.InviteDelete]: async (invite) => { await handleinvites(invite, 'remove') },
  [GatewayDispatchEvents.MessageReactionAdd]: async ({ data: reaction }) => { await handleReactionChange(reaction, api, 'add'); },
  [GatewayDispatchEvents.MessageReactionRemove]: async ({ data: reaction }) => { await handleReactionChange(reaction, api, 'remove'); },
  [GatewayDispatchEvents.GuildMemberUpdate]: async ({ data: member }) => {
    const guildId = member.guild_id;
    const userId = member.user.id;
    const oldMember = memberCache.get(`${guildId}-${userId}`);
    const oldNick = oldMember?.nick ?? oldMember?.user?.username;
    const newNick = member.nick ?? member.user.username;
    memberCache.set(`${guildId}-${userId}`, member);
    if (!oldMember || oldNick === newNick) return;
    const logChannelId = guildChannelMap[guildId]?.modChannels?.namelogChannel;
    if (!logChannelId) return;
    await api.channels.createMessage(logChannelId, {
      embeds: [{
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${userId}/${member.user.avatar}.png` },
        color: 0x4e85b6,
        description: `<@${userId}> **changed their nickname**\n\n` +
          `**Before:**\n${oldNick}\n\n` +
          `**After:**\n${newNick}`,
        timestamp: new Date().toISOString()
      }]
    }).catch(err => console.error('❌ Failed to send name log:', err));
  },
  [GatewayDispatchEvents.MessageDelete]: async ({ data: deletedData }) => {
    const { id, channel_id, guild_id } = deletedData;
    const message = messageCache.get(id);
    if (!message || message.author.bot) return;
    const messageLink = `https://discord.com/channels/${guild_id}/${channel_id}/${id}`;
    const attachments = message.attachments || [];
    const hasAttachment = attachments.length > 0;
    let title = `Message by <@${message.author.id}> was deleted in <#${channel_id}>\n`;
    if (hasAttachment && !message.content) title = `Image by <@${message.author.id}> was deleted in <#${channel_id}>\n`;
    else if (hasAttachment && message.content) title = `Image and text by <@${message.author.id}> was deleted in <#${channel_id}>\n`;
    const imageAttachments = attachments.filter(att => att.content_type?.startsWith('image/')).map(att => att.proxy_url);
    const mainEmbed = {
      color: 0xf03030,
      description: [title, message.content || '_No content_\n', `\n[Event Link](${messageLink})`].join('\n'),
      thumbnail: { url: `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png` },
      footer: { text: `ID: ${id}` },
      timestamp: new Date().toISOString()
    };
    if (imageAttachments.length > 0) mainEmbed.image = { url: imageAttachments[0] };
    const additionalImageEmbeds = imageAttachments.slice(1, 9).map(url => ({ url: messageLink, image: { url: url } }));
    await api.channels.createMessage(guildChannelMap[guild_id].modChannels.deletedlogChannel, { embeds: [mainEmbed, ...additionalImageEmbeds] });
  },
  [GatewayDispatchEvents.MessageCreate]: async ({ data: message }) => {
    const { guild_id, author, member, content, channel_id, attachments, flags, type, mentions, embeds } = message;
    const staffroles = ['1235295120665088030', '1409208962091585607']
    const guild = await api.guilds.get(guild_id)
    if (author.bot || !guild_id || !member || message.type !== 0) return;
    const sentByStaff = member.roles.some(roleId => staffroles.includes(roleId))
    // eslint-disable-next-line no-useless-escape
    const messageWords = content.replace(/<a?:\w+:\d+>/g, '').replace(/[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '');
    if (channel_id == guildChannelMap[guild_id].publicChannels.countingChannel) {
      const state = await fetch(guild_id);
      const number = parseInt(content);
      if (!number) return;
      if (state.count + 1 == number && state.lastuser !== author.id) { increment(guild_id, author.id); await api.channels.addMessageReaction(channel_id, message.id, '✅'); }
      else {
        reset(guild_id);
        await api.channels.addMessageReaction(channel_id, message.id, '❌');
        await api.channels.createMessage(channel_id, { content: `<@${author.id}> missed or already counted!` });
      }
      return;
    }
    const text = messageWords.toLowerCase()
    for (const [keyword, reply] of replies) if (text.includes(keyword)) { await api.channels.createMessage(channel_id, { content: reply, message_reference: { message_id: message.id } }); }
    for (const { keyword, reply } of multireplies) { if (keyword.every(k => text.includes(k))) await api.channels.createMessage(channel_id, { content: reply, message_reference: { message_id: message.id } }); }
    if (text.includes('<@857445139416088647>')) await api.channels.addMessageReaction(channel_id, message.id, 'SaltyEyes:1257522749635563561')
    if (text.includes('bad') && text.includes('bot')) await api.channels.addMessageReaction(channel_id, message.id, '😡');
    if (type !== 7) {
      const { userData, rank } = await getUser({ userId: author.id, guildId: guild_id });
      userData.xp += 20; userData.totalmessages += 1;
      if (userData.xp >= Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20) {
        userData.level++; userData.xp = 0;
        await api.channels.createMessage(channel_id, {
          embeds: [{
            author: { name: `${author.username} you reached level ${userData.level}!`, icon_url: `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png` },
            color: 0x00AE86,
            footer: { text: `you are now #${rank} in the server` }
          }]
        });
      }
      if (userData.level >= 3 && !member.roles.includes("1334238580914131026"))
        try { await api.guilds.addRoleToMember(guild_id, author.id, "1334238580914131026") } catch { /* empty*/ }
      await saveUser({ userId: author.id, guildId: guild_id, userData: userData });
    }
    messageCache.set(message.id, message);
    if (sentByStaff || author.id === "521404063934447616") return;
    let { total, mediaCount, duplicateCounts, timestamps } = userMessageTrackers.get(`${author.id}-${guild_id}`) ?? ({ total: 0, mediaCount: 0, duplicateCounts: new Map(), timestamps: [] });
    const currentContentCount = (duplicateCounts.get(messageWords) || 0) + 1;
    const embedcheck = embeds.some(embed => { { return embed.type == 'image' || embed.type == "video" || embed.type == "gifv" || embed.type == "rich" } })
    timestamps.push(Date.now())
    if ((attachments.length > 0 || embedcheck) && (flags & 8192) === 0 && !Object.values(guildChannelMap[guild_id].mediaexclusions).some(id => id === channel_id)) {
      mediaCount += 1;
    }
    total += 1;
    userMessageTrackers.set(`${author.id}-${guild_id}`, { total: total, mediaCount: mediaCount, duplicateCounts: duplicateCounts, timestamps: timestamps })
    const { Duplicatespamthreshold, mediathreshold, messagethreshold } = guildChannelMap[guild_id].automodsettings
    const [hasInvite, everyonePing, duplicateSpam, mediaViolation, generalspam] = [
      /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i.test(content),
      mentions.some(m => m.id === guild_id),
      currentContentCount >= Duplicatespamthreshold,
      (mediaCount > mediathreshold && total < messagethreshold),
      timestamps.filter(stamp => Date.now - stamp < 1000 * 8).length >= 8
    ];
    let globalword, matchedWord, capSpam = false;
    const words = messageWords.split(/\s+/g);
    const isChannelExcluded = Object.values(guildChannelMap[guild_id].exclusions).some(id => id === id === channel_id);
    for (const word of words) { if (globalWords.has(word)) { globalword = word; break; } if (!isChannelExcluded && forbiddenWords.has(word)) { matchedWord = word; break; } }
    if (messageWords) { duplicateCounts.set(messageWords, currentContentCount); if (messageWords.length >= 20) { const caps = messageWords.match(/[A-Z]/g); if (caps) capSpam = caps.length / messageWords.length > 0.7; } }
    if (duplicateSpam) duplicateCounts.clear();
    if (total >= messagethreshold) { total = 0; mediaCount = 0; }
    else if (mediaViolation) mediaCount = 0;
    if (globalword || matchedWord || hasInvite || everyonePing || generalspam || duplicateSpam) await api.channels.deleteMessage(channel_id, message.id).catch(() => { });
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
    const { userData } = await getUser({ userId: author.id, guildId: guild_id, modflag: true })
    const isNewUser = Date.now() - Date.parse(member.joined_at) < 2 * 24 * 60 * 60 * 1000 && userData.level < 3
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const commoninputs = { api: api, guild: guild, target: author, moderatorUser: member, reason: reasonText, channelId: channel_id, isAutomated: true }
    const bannable = isNewUser && (totalWeight >= 3 || everyonePing || hasInvite)
    if (bannable) await punishUser({ ...commoninputs, banflag: true });
    else await punishUser({ ...commoninputs, currentWarnWeight: totalWeight })

  },
  [GatewayDispatchEvents.MessageUpdate]: async ({ data: newMessage }) => {
    const oldMessage = messageCache.get(newMessage.id);
    if (!oldMessage || oldMessage.author.bot) return;
    const guildId = newMessage.guild_id;
    const channelId = newMessage.channel_id;
    messageCache.set(newMessage.id, { ...oldMessage, ...newMessage });
    const embed = {
      description: `<@${oldMessage.author.id}> edited a message in <#${channelId}>\n\n` +
        `**Before:**\n${oldMessage.content || '_No content_'}\n\n` +
        `**After:**\n${newMessage.content || '_No content_'}\n\n` +
        `[Jump to Message](${`https://discord.com/channels/${guildId}/${channelId}/${newMessage.id}`})`,
      color: 0x309eff,
      thumbnail: {
        url: `https://cdn.discordapp.com/avatars/${oldMessage.author.id}/${oldMessage.author.avatar}.png`
      },
      footer: { text: `ID: ${newMessage.id}` },
      timestamp: new Date().toISOString()
    };
    await api.channels.createMessage(guildChannelMap[guildId].modChannels.updatedlogChannel, { embeds: [embed] });
  },
  [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction }) => {
    const { guild_id, member, user: rawUser, data: interactionData, channel_id } = interaction;
    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = commands.get(interactionData.name);
      if (command) {
        try { await command({ interaction, api }); }
        catch (error) {
          console.error(`❌ Command Error:`, error);
          await api.interactions.reply(interaction.id, interaction.token, { content: 'Error executing command!', flags: 64 });
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
        const modchannels = guildChannelMap[guildId].modChannels;
        const appealMsg = await api.channels.createMessage(modchannels.appealChannel, {
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
            type: 1,
            components: [
              { type: 2, custom_id: `unban_approve_${interaction.user.id}_${guild_id}`, label: 'Approve', style: 3 },
              { type: 2, custom_id: `unban_reject_${interaction.user.id}_${guild_id}`, label: 'Reject', style: 4 }
            ]
          }]
        })
        await api.channels.createThread(modchannels.appealChannel, { type: ChannelType.PublicThread, name: `${rawUser.username}` }, appealMsg.id);
        await api.interactions.reply(interaction.id, interaction.token, { content: 'Your appeal has been submitted!', flags: 64 });
        await appealsinsert(rawUser.id, guildId, reason, justification, extra);
      }
      if (customId.startsWith('situations')) {
        const fields = interactionData.components;
        const applications = await load(filepath);
        const application = applications[interaction.member.user.id]
        const guild = await api.guilds.get(guild_id)
        application.dmmember = fields[0].component.value;
        application.argument = fields[1].component.value;
        application.ambiguous = fields[2].component.value;
        application.staffbreakrule = fields[3].component.value;
        application.illegal = fields[4].component.value;
        const applicationChannelid = guildChannelMap[guild_id].modChannels.applicationChannel
        console.log(rawUser)
        api.channels.createMessage(applicationChannelid, {
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
        await api.interactions.reply(interaction.id, interaction.token, { content: 'your application was successfuly submitted!!' })
        delete applications[interaction.member.user.id];
        save(filepath, applications)
      }
      if (customId.startsWith('Defs, reasons, and issues')) {
        const fields = interactionData.components;
        const applications = await load(filepath)
        const application = applications[interaction.member.user.id]
        if (application.Memberreport) {
          await api.interactions.reply(interaction.id, interaction.token, {
            content: 'You have already filled out this section. Click below to continue to the next section.',
            components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'skip section', style: 1 }] }],
            flags: 64
          });
          return;
        } else {
          application.Why = fields[0].component.value;
          application.Trolldef = fields[1].component.value;
          application.Raiddef = fields[2].component.value;
          application.Staffissues = fields[3].component.value;
          application.Memberreport = fields[4].component.value;
          await save(filepath, applications);
          await api.interactions.reply(interaction.id, interaction.token, {
            content: 'Part 2 of your application has saved! Click below to continue to the next section.',
            components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'Next Section', style: 1 }] }],
            flags: 64
          });

        }
      }
      if (customId.startsWith('server')) {
        const fields = interactionData.components;
        const applications = await load(filepath)
        const application = applications[interaction.member.user.id]
        console.log(fields)
        application.Agerange = fields[0].component.values[0];
        application.Experience = fields[1].component.value;
        application.History = fields[2].component.value;
        application.Timezone = fields[3].component.value;
        application.Activity = fields[4].component.value;
        await save(filepath, applications)
        await api.interactions.reply(interaction.id, interaction.token, {
          content: 'Part 1 of your application has been saved! Click below to continue to the next section.',
          components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'Next Section', style: 1 }] }],
          flags: 64
        })
      }
    }
    if (interaction.type === InteractionType.MessageComponent) {
      const customId = interactionData.custom_id;
      if (customId.startsWith('ban_')) {
        const guild = await api.guilds.get(guild_id)
        const [, targetId, inviterId, inviteCode] = customId.split('_');
        const permissions = BigInt(member.permissions);
        if (!(permissions & 0x4n)) {
          return await api.interactions.reply(interaction.id, interaction.token, { content: 'jrs cannot use this button.', flags: 64 });
        }
        const memberToBan = await api.users.get(targetId);
        if (!interaction.member.permissions.has('BAN_MEMBERS')) { await interaction.reply({ content: 'Missing permission.', flags: 64 }); return; }

        if (Date.now() - interaction.message.createdTimestamp > 15 * 60 * 1000) {
          await interaction.reply({ content: 'This ban button has expired (15 mins have already passed since they joined).', flags: 64 });
          const banbuttonLabel = interaction.message.components[0].components[0].label;
          if (banbuttonLabel == '🔨 Ban User & Delete Invite' || banbuttonLabel === '🔨 Ban') {
            await interaction.message.edit({
              components: [{
                type: 1,
                components: { type: 2, custom_id: interaction.customId, label: banbuttonLabel == '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)' : '🔨 Ban (Expired)', style: 4, disabled: true }
              }]
            })
          }
          return;
        }
        const messageid = interaction.message.id;
        let finalMessage = ``;
        punishUser({ api, interaction: interaction, guildId: guild, target: memberToBan, reason: 'troll', channelId: channel_id, banflag: true, messageid: messageid });
        finalMessage = `Banned ${memberToBan}`;

        if (inviterId !== 'no inviter') {
          const friend = await api.users.get(inviterId)
          punishUser({ interaction: interaction, guildId: guild, target: friend, reason: 'troll', channelId: channel_id, banflag: true, messageid: messageid });
          finalMessage += `, inviter <@${inviterId}>.`;
        }

        if (inviteCode !== 'no invite code') {
          const invites = await api.guilds.getInvites(guild.id);
          const targetinvite = invites.filter(inv => inv.code === inviteCode)
          if (targetinvite) { targetinvite.delete(); finalMessage += ' Associated Invite was deleted' }
        }
        interaction.reply({ embeds: [{ description: finalMessage }] });
        const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
        originalMessage.edit({
          components: [{
            type: 1,
            components: { type: 2, custom_id: interaction.customId, label: inviterId !== 'no inviter' ? '🔨 Banned User and Inviter!' : '🔨 Banned!', style: 4, disabled: true }
          }]
        });
      }
      if (customId.startsWith('unban_')) {
        console.log(interaction)
        await interaction.deferReply();
        const customIdParts = interaction.customId.split('_')
        const targetUser = await api.users.get(customIdParts[2])
        const guild = await api.guilds.get(guild_id)
        const appeals = await appealsget(targetUser.id, guild_id)
        const Adminchannelid = guildChannelMap[guild_id].modChannels.adminChannel;
        if (!interaction.member.permissions.has(0x8n)) {
          await api.interactions.editReply(interaction.application_id, interaction.token, { content: `Please wait for an admin to make a decision. `, flags: 64 })
          await api.channel.createMessage(Adminchannelid, { content: `Letting you know ${interaction.user} tried to jump the gun on an appeal.` })
          return;
        }
        const appealEmbed = {
          color: 0x13cbd8,
          title: `Ban appeal`,
          author: { name: `${targetUser.tag}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) },
          fields: [
            { name: 'Why did you get banned?', value: `${appeals.reason} ` },
            { name: 'Why do you believe that your appeal should be accepted?', value: `${appeals.justification} ` },
            { name: 'Is there anything else you would like us to know?', value: `${appeals.extra}` }
          ],
          footer: { text: `User ID: ${targetUser.id}` },
          timestamp: new Date().toISOString()
        }
        const response = { author: { name: `${targetUser.tag} `, iconURL: targetUser.displayAvatarURL({ dynamic: true }) }, color: null, title: null, description: null }
        let outcome = null
        switch (customIdParts[1]) {
          case 'reject':
            response.color = 0x890000;
            response.title = 'Appeal Denied...'
            response.description = `${targetUser} your ban appeal has been denied from ${guild.name}.`
            appealEmbed.color = 0x890000;
            appealEmbed.fields = [{ name: 'Denied by:', value: `${interaction.user} `, inline: true }]
            break;
          case 'approve': {
            const appealinvites = { '1231453115937587270': 'https://discord.gg/xpYnPrSXDG', '1342845801059192913': 'https://discord.gg/nWj5KvgUt9' }
            try { await guild.bans.fetch({ userId: targetUser.id, force: true }) }
            catch { interaction.editReply(`No recent ban for ${targetUser} found`); return; }
            await guild.bans.remove(targetUser, `Ban Command: ${appeals[0].reason}`)
            response.color = 0x008900;
            response.title = 'Appeal Accepted!';
            response.description = `${targetUser} your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealinvites[guild_id]}`;
            appealEmbed.color = 0x008900;
            appealEmbed.fields = [{ name: 'Approved by:', value: `${interaction.user} `, inline: true }]
            outcome = true
            break;
          }
        }
        await interaction.message.edit({
          embeds: [appealEmbed],
          components: [{
            type: 1,
            components: [
              { type: 2, custom_id: `unban_approve_${targetUser.id}_${guild_id}`, label: 'Approve', style: 3, disabled: true },
              { type: 2, custom_id: `unban_reject_${targetUser.id}_${guild_id}`, label: 'Reject', style: 4, disabled: true }]
          }]
        })
        await appealupdate(targetUser.id, guild_id, outcome)
        targetUser.send({ embeds: [response] })
        interaction.deleteReply();
      }
      if (customId.startsWith('next_modal_three')) {
        await api.interactions.createModal(interaction.id, interaction.token, {
          custom_id: 'situations', title: 'Situations (3/3)',
          components: [
            { type: 18, label: 'A member messages you about being harrassed', component: { type: 4, custom_id: 'dmmember', required: true, style: 2, max_length: 350 } },
            { type: 18, label: 'Users are arguing in general chat', component: { type: 4, custom_id: 'arguments', style: 2, required: true, max_length: 350 } },
            { type: 18, label: 'A member DMs you about a rule-breaking DM', component: { type: 4, custom_id: 'rulebreakdm', required: true, style: 2, max_length: 350 } },
            { type: 18, label: 'Staff is failing to follow the rules', component: { type: 4, custom_id: 'staffrulebreak', required: true, style: 2, max_length: 350 } },
            { type: 18, label: 'A user shares illegal content', component: { type: 4, custom_id: 'illegal', required: true, style: 2, max_length: 350 } }]
        })
      }
      if (customId.startsWith('next_modal_two')) {
        const applications = await load(filepath);
        const application = applications[interaction.member.user.id]
        if (application.Memberreport) {
          await api.interactions.reply(interaction.id, interaction.token, {
            content: 'You have already filled out this part. Click the button below to continue to the next section.',
            components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'skip Section', style: 1 }] }],
            flags: 64
          });
        } else {
          await api.interactions.createModal(interaction.id, interaction.token, {
            components: [
              { type: 18, label: 'Why should you be on the team?', component: { type: 4, custom_id: 'why', required: true, style: 2, max_length: 500 } },
              { type: 18, label: 'What is your definition of a troll?', component: { type: 4, custom_id: 'trolldef', required: true, style: 1, max_length: 65 } },
              { type: 18, label: 'What is your definition of a raid?', component: { type: 4, custom_id: 'raiddef', required: true, style: 1, max_length: 65 } },
              { type: 18, label: 'You disagree with an action from staff', component: { type: 4, custom_id: 'staffissues', required: true, style: 2, max_length: 300 } },
              { type: 18, label: 'How would you handle a member report?', component: { type: 4, custom_id: 'memberreport', required: true, style: 2, max_length: 300 } }
            ],
            custom_id: 'Defs, reasons, and issues',
            title: 'Definitions, Why mod, and Staff issues (2/3)'
          });
        }
      }
      if (customId.startsWith('role_select')) {
        await interaction.deferReply({ flags: 64 })
        const member = interaction.member;
        const reactions = guildChannelMap[guild_id].roles
        const rolesAdded = [];
        const rolesRemoved = [];
        const allPossibleSelectValues = Object.keys(reactions)
        for (const roleValue of allPossibleSelectValues) {
          const roleID = reactions[roleValue];
          if (!roleID) { console.warn(`⚠️ No role mapped for select menu value: ${roleValue}.Skipping.`); continue; }
          await member.roles.add(roleID); rolesAdded.push(`<@&${roleID}> `);
          if (member.roles.cache.has(roleID)) { await member.roles.remove(roleID); rolesRemoved.push(`<@&${roleID}> `); }
        }
        let replyContent = '';
        if (rolesAdded.length > 0) replyContent += `Added: ${rolesAdded.join(', ')} \n`;
        if (rolesRemoved.length > 0) replyContent += `Removed: ${rolesRemoved.join(', ')} \n`;
        interaction.editReply({ content: replyContent, flags: 64 });
      }
      if (customId.startsWith('note')) {
        const [, action, target, index] = customId.split('-')
        await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
        let allnotes = await viewNotes(target, guild_id)
        const isAdmin = (BigInt(interaction.member.permissions) & 0x8n) === 0x8n;
        let currentIndex = index
        switch (action) {
          case 'del': {
            const noteToDelete = allnotes[currentIndex]
            if (noteToDelete.timestamp - Date.now() < 48 * 60 * 60 * 1000 || isAdmin) {
              editNote({ userId: target, guildId: guild_id, id: noteToDelete._id })
              allnotes = await viewNotes(target, interaction.guild.id);
              if (allnotes.length === 0) return await api.interactions.editReply(interaction.application_id, interaction.token, { embeds: [{ description: "All notes deleted.", color: 0xdddddd }] });
              currentIndex = Math.min(currentIndex, allnotes.length - 1)
            } else await api.interactions.followup(interaction.token, { content: `${interaction.user}, please contact an admin as time has expired.`, flags: 64 })
            break;
          }
          default: currentIndex = action == 'next' ? Math.min(allnotes.length - 1, index + 1)
            : Math.max(0, index - 1)
            break;
        }
        let currentNote = allnotes[currentIndex]
        const newEmbed = await buildNoteEmbed(api, target, currentIndex, currentNote, allnotes.length);
        await api.interactions.editReply(interaction.application_id, interaction.token, {
          embeds: [newEmbed],
          components: [{
            type: 1, components: [
              { type: 2, style: 2, label: '◀️ prev', custom_id: `note-prev-${target}-${currentIndex}`, disabled: currentIndex === 0 },
              { type: 2, style: 2, label: '▶️ next', custom_id: `note-next-${target}-${currentIndex}`, disabled: currentIndex >= allnotes.length - 1 },
              { type: 2, style: 4, label: '🗑️ delete', custom_id: `note-del-${target}-${currentIndex}` }]
          }]
        });
      }
      if (customId.startsWith('modlog')) {
        const [, action, target, index] = customId.split('-')
        const isAdmin = (BigInt(interaction.member.permissions) & 0x8n) === 0x8n;
        await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
        let allLogs = await getPunishments(target, guild_id);
        let currentIndex = index;
        let currentLog = allLogs[index]
        switch (action) {
          case 'del':
            await editPunishment({ userId: target, guildId: guild_id, id: currentLog._id })
            allLogs = await getPunishments(target, guild_id);
            if (allLogs.length < 1) {
              return await api.interactions.editReply(interaction.application_id, interaction.token, { embeds: [{ description: `All logs for <@${target}> deleted.` }], components: [] });
            }
            currentIndex = Math.min(index, allLogs.length - 1)
            break;
          default: currentIndex = action == 'next' ? Math.min(allLogs.length - 1, index + 1)
            : Math.max(0, index - 1)
            break;
        }
        currentLog = allLogs[currentIndex];
        await api.interactions.edit(interaction.id, interaction.token, {
          embeds: [await buildLogEmbed(interaction, target, currentLog, currentIndex, allLogs.length)],
          components: [{
            type: 1, components: [
              { type: 2, custom_id: `modlog-prev-${target}-${currentIndex}`, label: '⬅️ Back', style: 2, disabled: currentIndex === 0 },
              { type: 2, custom_id: `modlog-next-${target}-${currentIndex}`, label: 'Next ➡️', style: 2, disabled: currentIndex >= allLogs.length - 1 },
              isAdmin ? { type: 2, custom_id: `modlog-del-${target}-${currentIndex}`, label: 'Delete', style: 4, disabled: false } : []
            ]
          }]
        })

      }
      if (customId.startsWith('rps')) {
        await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
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
        await api.interactions.editReply(interaction.application_id, interaction.token, {
          embeds: [{ title: result, description: `You chose **${move}**.\nOpponent chose **${opponentchoice}**.`, color: 0xffa500 }],
          components: []
        });
      }
      if (customId.startsWith('logos')) {
        const [, guess, logo] = customId.split('-')
        await api.interactions.deferMessageUpdate(interaction.id, interaction.token)
        const updatedbuttons = interaction.message.components[0].components.map(button => {
          const buttonbrand = button.custom_id.split('-')[1];
          let style = 2;
          if (buttonbrand === logo)
            style = 3;
          else if (buttonbrand === guess && guess !== logo) {
            style = 4
          }
          return {
            type: 2, label: button.label, custom_id: button.custom_id, style: style, disabled: true
          }
        })
        await api.interactions.editReply(interaction.application_id, interaction.token, { components: [{ type: 1, components: updatedbuttons }] });
        if (guess === logo) {
          const { userData } = await getUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, modflag: true });
          userData.coins += 20;
          saveUser({ userId: interaction.member.user.id, guildId: interaction.guild_id, userData: userData });
        }
      }
      if (customId.startsWith('tictactoe')) {
        const winningConditions = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        let [, gameBoard, player1, player2, currentplayer, index] = customId.split('-');
        if (interaction.member.user.id !== currentplayer) return await api.interactions.reply(interaction.id, interaction.token, { content: 'You are not in this game or It\'s not your turn.', flags: 64 })
        await api.interactions.deferMessageUpdate(interaction.id, interaction.token)
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
          return await api.interactions.editReply(interaction.application_id, interaction.token, {
            embeds: [{ color: win ? 0xceab10 : 0x555555, title: 'TicTacToe', description: win ? `<@${currentplayer}> wins!!` : `It's a draw!` }],
            components: generateButtons(gameBoard, player1, player2, currentplayer, true)
          });
        }
        currentplayer = (currentplayer === player1) ? player2 : player1;
        await api.interactions.editReply(interaction.application_id, interaction.token, {
          embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: ` It's <@${currentplayer}> turn!` }],
          components: generateButtons(gameBoard, player1, player2, currentplayer)
        });
      }
    }
  }
}
async function main() {
  if (!process.env.CLIENT_ID || !process.env.TOKEN) { console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.'); process.exit(1) }
  initializeRankCardBase();
  Object.entries(handlers).forEach(([eventName, listenerFunc]) => { client.on(eventName, listenerFunc); });
  await gateway.connect();
  client.commands = await getCommandData(await findFiles('commands'));
  updateStatus(); setInterval(updateStatus, 5000)
  await clearExpiredWarns(db.collection('users')); setInterval(async () => { await clearExpiredWarns(db.collection('users')) }, 5 * 60 * 1000)
  const invites = {}
  for (const guild of await api.users.getGuilds()) {
    const guildinvites = await api.guilds.getInvites(guild.id);
    invites[guild.id] = guildinvites.map(invite => { return { code: invite.code, uses: invite.uses } })
    await embedsenders(guild.id, api);
    if (guildChannelMap[guild.id].publicChannels?.countingChannel) {
      let messages = await api.channels.getMessages(guildChannelMap[guild.id].publicChannels.countingChannel, { limit: 5 });
      for (let i = 0; i < 5; i++) { if (parseInt(messages[i].content.trim())) { await initialize(guild.id, parseInt(messages[i].content.trim())); break; } else continue; }
    }
  }
  save("Extravariables/invites.json", invites)
  console.log(client.commands)
}
await main().catch(console.error());
