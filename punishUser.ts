import { clearactive, editPunishment, getPunishments, addone } from './databaseAndFunctions';
import { get, put, pull, patch, post } from './root.js';
import { Punishment, userObject, messageObject, guildObject, channelObject, BaseInteraction, AppCommandInteraction } from './types';
import guildChannelMap from './guildconfiguration';
import { ObjectId } from 'mongodb';
interface UserObject {
  username: string,
  id: string,
  avatar: string
}
interface cmdOutput {
  log: string,
  cmd: string,
  dm: string
}
interface status {
  [cmd: string]: cmdOutput
}
interface logtype {
  [cmd: string]: number
}
function getNextPunishment(weightedWarns: number) {
  const index = Math.max(0, weightedWarns - 1);
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
  const { type, label, minutes } = punishmentStages[Math.min(index, punishmentStages.length - 1)];
  const unit = minutes >= 60 ? 'hour' : 'min';
  const duration = unit === 'hour' ? minutes / 60 : minutes;
  return { type, duration, unit, label };
}
const getDefaultAvatar = (userId: string, discriminator: string) => {
  const index = discriminator === "0" ? Number(BigInt(userId) >> 22n) % 6 : Number(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
};
const unitMap = { min: 60000, hour: 3600000, day: 86400000 } as logtype
const Log_Type = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 } as logtype
const MAX_TIMEOUT_MS = 2419200000;
export default async function punishUser(guildId: string, target: string, moderatorUser: UserObject, reason: string, channelId: string, isAutomated: boolean, interaction: BaseInteraction<AppCommandInteraction> | null, currentWarnWeight: number, banflag: boolean, messageid: string | null, kick: boolean) {
  const user = await get(`/users/${target}`) as userObject
  if (user.bot && interaction) {
    return await patch(`webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
      embeds: [{ description: `You cannot moderate verified bots.` }],
      flags: 64
    })
  }
  const ext = user.avatar ? (user.avatar.startsWith('a_') ? 'gif' : 'png') : null
  const avatar = ext ? `https://cdn.discordapp.com/avatars/${target}/${user.avatar}.${ext}` : getDefaultAvatar(target, user.discriminator);
  const modavatarext = moderatorUser.avatar.startsWith('a_') ? 'gif' : 'png'
  const guild = await get(`guilds/${guildId}`) as guildObject;
  const activeWarns = await getPunishments(target, guildId, true);
  let warns: number = 0;
  if (activeWarns.length > 0) warns = activeWarns.reduce((acc: number, entry: Punishment) => acc + (entry.weight || 1), 0);
  const { type, duration, unit, label } = getNextPunishment(warns + currentWarnWeight)
  let durationMs: number = 0;
  let durationStr: string = '';
  let refrences: Punishment[] = [];
  let warnType: string = banflag ? 'Ban' : kick ? 'Kick' : (interaction && interaction.data.options[0].options[0].name === 'mute') ? 'Mute' : 'Warn';
  if ((warnType == "Mute" || warnType == "Warn")) {
    if (interaction && interaction.data.options[0].name === 'mute') {
      durationMs = interaction.data.options[0].options[2].value as number * unitMap[interaction.data.options[0].options[3].value];
      durationStr = `${interaction.data.options[0].options[2].value} ${interaction.data.options[0].options[3].value}`;
    }
    else if (type == 'Mute') {
      durationMs = duration * unitMap[unit];
      durationStr = unit === 'hour' ? `${Math.ceil(durationMs / unitMap.hour)} hour` : `${Math.ceil(durationMs / unitMap.min)} min`;
      warnType = 'Mute'
    }
    refrences = activeWarns.length > 0 ? ((warnType === 'Ban' ? activeWarns.filter((r: Punishment) => r.type === 'Ban')
      : activeWarns.filter((r: Punishment) => r.type !== 'Kick')).slice(0, 10).map((punishment: Punishment, index: number) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)) : [];
  }
  const statusMap = {
    Ban: { log: 'banned a member', cmd: 'was banned', dm: `you were banned from [${guild.name}](https://discord.com/channels/${guildId}).\n\n\nYou may appeal your ban after clicking on the invite here incase you only had this server in common: https://discord.gg/qMjjyXyYbr \n\n Then use the /Appeal command here.` },
    Kick: { log: 'kicked a member', cmd: 'was kicked', dm: `you were kicked from ${guild.name}` },
    Mute: { log: 'muted a member', cmd: `was issued a ${durationStr} mute`, dm: `you were given a \`${durationStr}\` mute in ${guild.name}` },
    Warn: { log: 'warned a member', cmd: 'was issued a warning', dm: `you were given a warning in ${guild.name}` }
  } as status
  const { log, cmd, dm } = statusMap[warnType];
  const logColor = Log_Type[warnType];
  const finalMessage = !isAutomated && interaction ?
    await patch(`webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, { embeds: [{ color: logColor, author: { name: `${user.username} ${cmd}`, icon_url: avatar } }] }) as messageObject
    : await post(`channels/${channelId}/messages`, { embeds: [{ color: logColor, author: { name: `${user.username} ${cmd}`, icon_url: avatar } }] }) as messageObject
  const object = await editPunishment(target, guildId, isAutomated ? finalMessage.author.id : moderatorUser.id, reason, durationMs, warnType, currentWarnWeight, channelId, `https://discord.com/channels/${guildId}/${channelId}/${messageid ? messageid : finalMessage.id}`).catch(console.warn) as ObjectId;
  const logEmbed = {
    color: logColor,
    author: { name: `${moderatorUser.username} ${log}`, icon_url: `https://cdn.discordapp.com/avatars/${moderatorUser.id}/${moderatorUser.avatar}.${modavatarext}` },
    thumbnail: { url: avatar },
    fields: [
      { name: 'Target:', value: `<@${target}>`, inline: true },
      { name: 'Channel:', value: `<#${channelId}>`, inline: true },
      { name: 'History:', value: `${refrences.length > 0 ? refrences.join(' | ') : "none"}`, inline: true },
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      ...(warnType !== 'Ban' && warnType !== 'Kick') ? [{ name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false }, { name: 'Warns at log time:', value: `\`${warns}\``, inline: false }, { name: 'Next Punishment:', value: `\`${label}\``, inline: false }] : [],
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'User DMed ✅' }
  }
  try {
    const dmchannel = await post(`users/@me/channels`, { recipient_id: target }) as channelObject;
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
  const logChannelId: string = warnType == 'Ban' ? guildChannelMap[guildId].modChannels.banlogChannel : guildChannelMap[guildId].modChannels.mutelogChannel;
  await post(`channels/${logChannelId}/messages`, { embeds: [logEmbed] })
  if (warnType == 'Warn' || warnType == 'Mute')
    setTimeout(async () => { await clearactive(target, guildId, object) }, 24 * 60 * 60 * 1000);
}