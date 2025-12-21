import { editPunishment, getPunishments, getUser } from '../Database/databaseAndFunctions.js';
import { load, save } from '../utilities/fileeditors.js';
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
function getNextPunishment(weightedWarns) {
  let index = Math.max(0, weightedWarns - 1);
  const punishmentStages = [
    { type: 'Warn', label: '15 min mute', minutes: 0 },
    { type: 'Mute', label: '30 min mute', minutes: 15 },
    { type: 'Mute', label: '45 min mute', minutes: 30 },
    { type: 'Mute', label: '1 hour mute', minutes: 45 },
    { type: 'Mute', label: '2 hour mute', minutes: 60 },
    { type: 'Mute', label: '4 hour mute', minutes: 120 },
    { type: 'Mute', label: '8 hour mute', minutes: 240 },
    { type: 'Mute', label: '8 hour mute', minutes: 480 }
  ];
  const stage = punishmentStages[Math.min(index, punishmentStages.length - 1)];
  const unit = stage.minutes >= 60 ? 'hour' : 'min';
  const duration = unit === 'hour' ? stage.minutes / 60 : stage.minutes;
  return { type: stage.type, duration, unit, label: stage.label };
}
const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
const MAX_TIMEOUT_MS = 2419200000;
export default async function punishUser({ api, guild, target, moderatorUser, reason, channelId, interaction = null, isAutomated = false, currentWarnWeight = 1, banflag = false, messageid = null, kick = false }) {
  api.interactions.defer(interaction.id, interaction.token);
  const userId = target.id;
  const userTag = target.username
  const modChannels = guildChannelMap[guild.id].modChannels;
  const ext = target.avatar.startsWith('a_') ? 'gif' : 'png'
  const avatar = `https://cdn.discordapp.com/avatars/${userId}/${target.avatar}.${ext}`
  const guildIconURL = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}`
  const logavatar = `https://cdn.discordapp.com/avatars/${moderatorUser.id}/${moderatorUser.avatar}.png`
  let activeWarns = await getPunishments(userId, guild.id, true);
  let warnType = banflag ? 'Ban' : kick ? 'Kick' : (interaction && interaction.data.options[0].name === 'mute') ? 'Mute' : 'Warn';
  let durationMs = 0;
  let durationStr = '';
  let logChannelId = modChannels.mutelogChannel;
  if (!await getUser({ userId: userId, guildId: guild.id, modflag: true }) && interaction) {
    await api.interactions.reply(interaction.id, interaction.token, { content: '❌ User does not exist in the Database.' }); return;
  }
  const bans = await load("Extravariables/commandsbans.json");
  let dmDescription = `<@${userId}>, you were given a \`warning\` in ${guild.name}.`;
  let logAuthor = `${moderatorUser.username} warned a member`;
  let logcolor = LOG_COLORS['Warn']
  let command = `${userTag} was issued a warning`
  switch (warnType) {
    case 'Ban':
      bans.push(userId);
      await save("Extravariables/commandsbans.json", bans);
      logChannelId = modChannels.banlogChannel;
      await api.guilds.banUser(guild.id, userId, { delete_message_seconds: 604800, reason: `AutoMod: ${reason}` });
      dmDescription = `<@${target.id}>, you were banned from ${guild.name}.`;
      logAuthor = `${moderatorUser.username} banned a member`;
      command = `${userTag} was banned`
      break;
    case 'Mute':
      durationMs = interaction.options.getInteger('duration') * unitMap[interaction.options.getString('unit')];
      durationStr = `${interaction.options.getInteger('duration')} ${interaction.options.getString('unit')}`;
      await api.guilds.editMember(guild.id, userId, { communication_disabled_until: new Date(Date.now() + Math.min(durationMs, MAX_TIMEOUT_MS)).toISOString(), reason });
      dmDescription = `<@${target.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`;
      logAuthor = `${moderatorUser.username} muted a member`;
      break;
    case 'Kick':
      await api.guilds.removeMember(guild.id, userId, { reason });
      logAuthor = `${moderatorUser.username} kicked a member`;
      dmDescription = `<@${target.id}>, you were kicked from ${guild.name}.`;
      break;
    default: {
      const { type, duration, unit } = getNextPunishment(activeWarns.length + currentWarnWeight);
      if (type === 'Mute') {
        durationMs = Math.min(duration * unitMap[unit], MAX_TIMEOUT_MS);
        durationStr = unit === 'hour' ? `${Math.ceil(durationMs / unitMap.hour)} hour(s)`
          : `${Math.ceil(durationMs / unitMap.min)} minute(s)`;
        dmDescription = `<@${target.id}>, you were given a \`${durationStr} mute\` in ${api.guilds.name}.`;
        logAuthor = `${moderatorUser.tag} muted a member`;
        await api.guilds.editMember(guild.id, userId, { communication_disabled_until: new Date(Date.now() + durationMs).toISOString() })
        command = `${userTag} was issued a \`${durationStr} mute\``
      }
      break;
    }
  }
  const logColor = LOG_COLORS[warnType]
  let finalMessage;
  if (isAutomated) {
    finalMessage = await api.channels.createMessage(channelId, { embeds: [{ color: logColor, author: { name: command, icon_url: avatar } }] });
    console.log(finalMessage)
  } else if (interaction) {
    finalMessage = await api.interactions.editReply(interaction.application_id, interaction.token, { embeds: [{ color: logColor, author: { name: command, icon_url: avatar } }] });
  }
  const messageLink = messageid ? `https://discord.com/channels/${guild.id}/${channelId}/${messageid}` : `https://discord.com/channels/${guild.id}/${channelId}/${finalMessage.id}`
  await editPunishment({ userId: userId, guildId: guild.id, moderatorId: isAutomated ? finalMessage.author.id : moderatorUser.id, reason, durationMs, warnType: warnType, weight: currentWarnWeight, channel: channelId, messagelink: messageLink }).catch(console.warn);
  activeWarns = await getPunishments(userId, guild.id, true);
  const refrences = (warnType === 'Ban' ? activeWarns.filter(r => r.type === 'Ban') : activeWarns.filter(r => r.type !== 'Kick'))
    .slice(0, 10)
    .map((punishment, index) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)
  const logEmbed = {
    color: logcolor,
    author: { name: logAuthor, icon_url: logavatar },
    thumbnail: { url: avatar },
    fields: [
      { name: 'Target:', value: `<@${userId}>`, inline: true },
      { name: 'Channel:', value: `<#${channelId}>`, inline: true },
      ...refrences ? [{ name: 'History:', value: `${refrences.join(' | ')}`, inline: true }] : [],
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      ...(warnType !== 'Ban' && warnType !== 'Kick') ? [{ name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false }, { name: 'Active Warnings:', value: `\`${activeWarns.length}\``, inline: false }, { name: 'Next Punishment:', value: `\`${getNextPunishment(activeWarns.length).label}\``, inline: false }] : []
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'User DMed ✅' }
  }
  try {
    const dmchannel = await api.users.createDM(userId)
    await api.channels.createMessage(dmchannel.id, {
      embeds: [{
        color: logcolor,
        author: { name: `${target.username}`, icon_url: avatar },
        thumbnail: { url: guildIconURL },
        description: dmDescription,
        fields: [
          { name: 'Reason:', value: `\`${reason}\``, inline: false },
          ...(warnType !== 'Ban' && warnType !== 'Kick') ? [{ name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
          { name: 'Active Warnings:', value: `\`${activeWarns.length}\``, inline: false },
          { name: 'Next Punishment:', value: `\`${getNextPunishment(activeWarns.length).label}\``, inline: false },
          { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + unitMap.day) / 1000)}:F>` }] : []
        ],
        timestamp: new Date().toISOString()
      }]
    })
  } catch { logEmbed.footer = { text: 'User DMed 🚫' } }
  await api.channels.createMessage(logChannelId, { embeds: [logEmbed] });
}
