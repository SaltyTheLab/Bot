import { clearactive, editPunishment, getPunishments, addone } from './Database/databaseAndFunctions.js';
import guildChannelMap from "./guildconfiguration.json" with {type: 'json'}
import { get, put, pull, patch, post } from './root.js';
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
  return [stage.type, duration, unit, stage.label];
}
const getDefaultAvatar = (userId, discriminator) => {
  const index = discriminator === "0" ? Number(BigInt(userId) >> 22n) % 6 : Number(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
};
const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
const MAX_TIMEOUT_MS = 2419200000;
export default async function punishUser({ guildId, target, moderatorUser, reason, channelId, interaction = null, isAutomated = false, currentWarnWeight = 1, banflag = false, messageid = null, kick = false }) {
  const user = await get(`/users/${target}`)
  if (user.bot) {
    return await patch(`webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
      embeds: [{ description: `You cannot moderate verified bots.` }],
      flags: 64
    })
  }
  const ext = user.avatar ? (user.avatar.startsWith('a_') ? 'gif' : 'png') : null
  const avatar = ext ? `https://cdn.discordapp.com/avatars/${target}/${user.avatar}.${ext}` : getDefaultAvatar(target, user.discriminator);
  const modavatarext = moderatorUser.avatar.startsWith('a_') ? 'gif' : 'png'
  const guild = await get(`guilds/${guildId}`);
  let activeWarns = await getPunishments(target, guildId, true);
  const [type, duration, unit, label] = getNextPunishment(activeWarns.length + currentWarnWeight)
  let durationMs = 0;
  let durationStr = '';
  let refrences = null;
  let warnType = banflag ? 'Ban' : kick ? 'Kick' : (interaction && interaction.data.options[0].name === 'mute') ? 'Mute' : 'Warn';
  if (warnType == "Mute" || warnType == "Warn") {
    if (warnType == 'Mute') {
      durationMs = interaction.options.getInteger('duration') * unitMap[interaction.options.getString('unit')];
      durationStr = `${interaction.options.getInteger('duration')} ${interaction.options.getString('unit')}`;
    }
    else if (type == 'Mute') {
      durationMs = duration * unitMap[unit];
      durationStr = unit === 'hour' ? `${Math.ceil(durationMs / unitMap.hour)} hour` : `${Math.ceil(durationMs / unitMap.min)} min`;
      warnType = 'Mute'
    }
    refrences = activeWarns.length > 0 ? ((warnType === 'Ban' ? activeWarns.filter(r => r.type === 'Ban')
      : activeWarns.filter(r => r.type !== 'Kick')).slice(0, 10).map((punishment, index) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)) : []
  }
  const statusMap = {
    Ban: { log: 'banned a member', cmd: 'was banned', dm: `you were banned from [${guild.name}](https://discord.com/channels/${guildId}).\n\n\nYou may appeal your ban after clicking on the invite here incase you only had this server in common: https://discord.gg/qMjjyXyYbr \n\n Then use the /Appeal command here.` },
    Kick: { log: 'kicked a member', cmd: 'was kicked', dm: `you were kicked from ${guild.name}` },
    Mute: { log: 'muted a member', cmd: `was issued a ${durationStr} mute`, dm: `you were given a \`${durationStr}\` mute in ${guild.name}` },
    Warn: { log: 'warned a member', cmd: 'was issued a warning', dm: `you were given a warning in ${guild.name}` }
  }
  const { log, cmd, dm } = statusMap[warnType];
  const logColor = LOG_COLORS[warnType]
  const finalMessage = isAutomated ? await post(`channels/${channelId}/messages`, { embeds: [{ color: logColor, author: { name: `${user.username} ${cmd}`, icon_url: avatar } }] })
    : await patch(`webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, { embeds: [{ color: logColor, author: { name: `${user.username} ${cmd}`, icon_url: avatar } }] })
  const object = await editPunishment({ userId: target, guildId: guildId, moderatorId: isAutomated ? finalMessage.author.id : moderatorUser.id, reason, durationMs, warnType: warnType, weight: currentWarnWeight, channel: channelId, messagelink: `https://discord.com/channels/${guildId}/${channelId}/${messageid ? messageid : finalMessage.id}` }).catch(console.warn);
  const logEmbed = {
    color: logColor,
    author: { name: `${moderatorUser.username} ${log}`, icon_url: `https://cdn.discordapp.com/avatars/${moderatorUser.id}/${moderatorUser.avatar}.${modavatarext}` },
    thumbnail: { url: avatar },
    fields: [
      { name: 'Target:', value: `<@${target}>`, inline: true },
      { name: 'Channel:', value: `<#${channelId}>`, inline: true },
      ...refrences ? [{ name: 'History:', value: `${refrences.join(' | ')}`, inline: true }] : [],
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      ...(warnType !== 'Ban' && warnType !== 'Kick') ? [{ name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false }, { name: 'Active Warnings:', value: `\`${activeWarns.length + 1}\``, inline: false }, { name: 'Next Punishment:', value: `\`${label}\``, inline: false }] : [],
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'User DMed ✅' }
  }
  try {
    const dmchannel = await post(`users/@me/channels`, { recipient_id: target })
    await post(`channels/${dmchannel.id}/messages`, {
      embeds: [{
        color: logColor,
        author: { name: `${user.username}`, icon_url: avatar },
        thumbnail: { url: `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png` },
        description: `<@${target}>, ${dm}`,
        fields: [
          { name: 'Reason:', value: `\`${reason}\``, inline: false },
          ...(warnType !== 'Ban' && warnType !== 'Kick') ? [{ name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
          { name: 'Active Warnings:', value: `\`${activeWarns.length + 1}\``, inline: false },
          { name: 'Next Punishment:', value: `\`${label}\``, inline: false },
          { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + unitMap.day) / 1000)}:F>` }] : []
        ],
        timestamp: new Date().toISOString()
      }]
    })
  } catch { logEmbed.footer = { text: 'User DMed 🚫' } }
  switch (warnType) {
    case 'Ban':
      await addone(target)
      await put(`guilds/${guildId}/bans/${target}`, { delete_message_seconds: 604800 }, `Ban Command: ${reason}`)
      break;
    case 'Mute': {
      const expiry = new Date(Date.now() + Math.min(durationMs, MAX_TIMEOUT_MS)).toISOString()
      await patch(`guilds/${guildId}/members/${target}`, { communication_disabled_until: expiry }, reason)
      break;
    }
    case 'Kick':
      await pull(`guilds/${guildId}/members/${target}`)
      break;
  }
  const logChannelId = warnType == 'Ban' ? guildChannelMap[guildId].modChannels.banlogChannel : guildChannelMap[guildId].modChannels.mutelogChannel;
  await post(`channels/${logChannelId}/messages`, { embeds: [logEmbed] })
  if (warnType == 'Warn' || warnType == 'Mute')
    setTimeout(async () => { await clearactive(target, guildId, object) }, 24 * 60 * 60 * 1000);
}