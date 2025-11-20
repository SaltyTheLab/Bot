import { EmbedBuilder, GuildMember } from 'discord.js';
import { editPunishment, getPunishments, getUser } from '../Database/databasefunctions.js';
import { load, save } from '../utilities/fileeditors.js';
import guildChannelMap from "../Extravariables/guildconfiguration.js";
function getNextPunishment(weightedWarns) {
  weightedWarns -= 1
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
  let index = Math.floor(weightedWarns);
  if (index >= punishmentStages.length) index = punishmentStages.length - 1;
  const { type, label, minutes } = punishmentStages[index];;
  const unit = minutes >= 60 ? 'hour' : 'min';
  const duration = unit === 'hour' ? Math.ceil(minutes / 60) : minutes;

  return { type, duration, unit, label };
}
export default async function punishUser({ interaction = null, guild, target, moderatorUser, reason, channel, isAutomated = false, currentWarnWeight = 1, banflag = false, messageid = null, kick = false }) {
  const userTag = target instanceof GuildMember ? target.user.tag : target.tag
  const bans = await load("Extravariables/commandsbans.json")
  const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
  const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
  const MAX_TIMEOUT_MS = 2419200000;
  const icon = target instanceof GuildMember ? target.user.displayAvatarURL({ dynamic: true }) : target.displayAvatarURL({ dynamic: true })
  let activeWarns = await getPunishments(target.id, guild.id, true) ?? [];
  let dmDescription = `<@${target.id}>, you were given a \`warning\` in ${guild.name}.`;
  let logAuthor = `${moderatorUser.tag} warned a member`;
  let commandTitle = `${userTag} was issued a warning`;
  let action = Promise.resolve();
  let logChannel = guild.channels.cache.get(guildChannelMap[guild.id].modChannels.mutelogChannel);
  let logcolor = LOG_COLORS['Warn']
  let sentMessage = null;
  let warnType = banflag ? 'Ban' : kick ? 'Kick' : (interaction && interaction.options.getSubcommand() === 'mute') ? 'Mute' : 'Warn';
  let durationMs = 0;
  let durationStr = '';
  if (!await getUser(target.id, guild.id) && interaction) { interaction.reply('❌ User does not exist in the Database.'); return; }
  switch (warnType) {
    case 'Ban':
      bans.push(target.id);
      await save("Extravariables/commandsbans.json", bans)
      commandTitle = `${userTag} was banned`;
      dmDescription = `${target}, you have been \`banned\` from ** ${guild.name} **.\n\n ** Reason **: \n\`${reason}\`\nPlease use /appeal to appeal your ban.\n\nYou can use this invite link to enable dms: https://discord.gg/qMjjyXyYbr`
      logAuthor = `${moderatorUser.tag} banned a member`
      logChannel = guild.channels.cache.get(guildChannelMap[guild.id].modChannels.banlogChannel)
      action = guild.bans.create(target.id, { reason: `Ban command: ${reason}`, deleteMessageSeconds: 604800 })
      logcolor = LOG_COLORS['Ban'];
      break;
    case 'Mute':
      durationMs = interaction.options.getInteger('duration') * unitMap[interaction.options.getString('unit')];
      durationStr = durationMs >= unitMap.day ? `${Math.ceil(durationMs / unitMap.day)} day(s)`
        : durationMs >= unitMap.hour ? `${Math.ceil(durationMs / unitMap.hour)} hour(s)`
          : `${Math.ceil(durationMs / unitMap.min)} minute(s)`;
      commandTitle = `${userTag} was issued a ${durationStr} mute`
      dmDescription = `<@${target.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`;
      logAuthor = `${moderatorUser.tag} muted a member`;
      action = await target.timeout(Math.min(durationMs, MAX_TIMEOUT_MS), reason)
      logcolor = LOG_COLORS['Mute'];
      break;
    case 'Kick':
      commandTitle = `${userTag} was kicked`
      dmDescription = `<@${target.id}>, you were kicked from ${guild.name}.`;
      logAuthor = `${moderatorUser.tag} kicked a member`;
      action = await target.kick({ reason: reason })
      logcolor = LOG_COLORS['Kick'];
      break;
    default: {
      const { type, duration, unit } = getNextPunishment(activeWarns.length + currentWarnWeight);
      if (type === 'Mute') {
        durationMs = Math.min(duration * unitMap[unit], MAX_TIMEOUT_MS);
        durationStr = unit === 'hour' ? `${Math.ceil(durationMs / unitMap.hour)} hour(s)`
          : `${Math.ceil(durationMs / unitMap.min)} minute(s)`;
        commandTitle = `${userTag} was issued a ${durationStr} mute`
        dmDescription = `<@${target.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`;
        logAuthor = `${moderatorUser.tag} muted a member`;
        action = await target.timeout(durationMs, reason)
        logcolor = LOG_COLORS['Mute'];
        warnType = 'Mute'
      }
      break;
    }
  }
  const commandEmbed = new EmbedBuilder({
    color: logcolor,
    author: { name: commandTitle, iconURL: icon }
  })
  const buttonmessage = messageid ? `https://discord.com/channels/${guild.id}/${channel.id}/${messageid}` : null
  isAutomated ? sentMessage = await channel.send({ embeds: [commandEmbed] })
    : !buttonmessage ? sentMessage = await interaction.reply({ embeds: [commandEmbed], withResponse: true })
      : null
  const messageLink = buttonmessage ?? `https://discord.com/channels/${guild.id}/${channel.id}/${sentMessage.id}`;
  await editPunishment({ userId: target.id, moderatorId: moderatorUser.id, reason: reason, durationMs: durationMs, warnType: warnType, weight: currentWarnWeight, channel: channel.id, guildId: guild.id, messagelink: messageLink, }).catch(err => console.warn(err));
  activeWarns = await getPunishments(target.id, guild.id, true);
  const refrences = (warnType === 'Ban' ? activeWarns.filter(r => r.type === 'Ban') : activeWarns.filter(r => r.type !== 'Kick'))
    .slice(0, 10)
    .map((punishment, index) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)
  const { label } = getNextPunishment(activeWarns.length);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dmEmbed = new EmbedBuilder({
    color: logcolor,
    author: { name: `${userTag}`, iconURL: icon },
    thumbnail: { url: guild.iconURL() },
    description: dmDescription,
    fields: [{ name: 'Reason:', value: `\`${reason}\``, inline: false },
    ...(warnType == 'Ban' ? []
      : [
        { name: 'Punishments:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
        { name: 'Active Warnings:', value: `\`${activeWarns.length}\``, inline: false },
        ...(warnType == 'Mute' ? []
          : [
            { name: 'Warn expires:', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` },
            { name: 'Next Punishment:', value: `\`${label}\``, inline: false }
          ]),
      ])],
    timestamp: Date.now()
  })

  const logEmbed = new EmbedBuilder({
    color: logcolor,
    author: { name: logAuthor, iconURL: moderatorUser.displayAvatarURL({ dynamic: true }) },
    thumbnail: { url: icon },
    fields: [{ name: 'Target:', value: `${target}`, inline: true },
    { name: 'Channel:', value: `${channel}`, inline: true },
    { name: 'History:', value: `${refrences.length > 0 ? refrences.join(' | ') : 'none'}`, inline: true },
    { name: 'Reason:', value: `\`${reason}\``, inline: false },
    ...(warnType == 'Ban' ? []
      : [
        { name: 'Punishments:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
        { name: 'Active Warnings:', value: `\`${activeWarns.length}\``, inline: false },
        { name: 'Next Punishment:', value: `\`${label}\``, inline: false }
      ])],
    timestamp: Date.now(),
    footer: { text: 'User DMed ✅' }
  })
  try { await target.send({ embeds: [dmEmbed] }) } catch { logEmbed.setFooter({ text: 'User DMed 🚫' }) }
  await logChannel.send({ embeds: [logEmbed] });
  action
}