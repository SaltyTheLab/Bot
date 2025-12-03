import { EmbedBuilder, GuildMember } from 'discord.js';
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
export default async function punishUser({ interaction = null, guild, target, moderatorUser, reason, channel, isAutomated = false, currentWarnWeight = 1, banflag = false, messageid = null, kick = false }) {
  if (!await getUser({ userId: target.id, guildId: guild.id, modflag: true }) && interaction) { interaction.reply('❌ User does not exist in the Database.'); return; }
  const user = target instanceof GuildMember ? target.user : target;
  const userTag = user.tag;
  const icon = user.displayAvatarURL({ dynamic: true });
  const bans = await load("Extravariables/commandsbans.json");
  const modchannels = guildChannelMap[guild.id].modChannels;
  let activeWarns = await getPunishments(target.id, guild.id, true);
  let dmDescription = `<@${target.id}>, you were given a \`warning\` in ${guild.name}.`;
  let logAuthor = `${moderatorUser.tag} warned a member`;
  let commandTitle = `${userTag} was issued a warning`;
  let action = Promise.resolve();
  let logChannelid = modchannels.mutelogChannel;
  let logcolor = LOG_COLORS['Warn']
  let sentMessage = null;
  let warnType = banflag ? 'Ban' : kick ? 'Kick' : (interaction && interaction.options.getSubcommand() === 'mute') ? 'Mute' : 'Warn';
  let durationMs = 0;
  let durationStr = '';
  switch (warnType) {
    case 'Ban':
      bans.push(target.id);
      await save("Extravariables/commandsbans.json", bans)
      commandTitle = `${userTag} was banned`;
      dmDescription = `${target}, you have been \`banned\` from ** ${guild.name} **.\n\n ** Reason **: \n\`${reason}\`\nPlease use /appeal to appeal your ban.\n\nYou can use this invite link to enable dms: https://discord.gg/qMjjyXyYbr`
      logAuthor = `${moderatorUser.tag} banned a member`
      logChannelid = modchannels.banlogChannel;
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
      action = target.timeout(Math.min(durationMs, MAX_TIMEOUT_MS), reason)
      logcolor = LOG_COLORS['Mute'];
      break;
    case 'Kick':
      commandTitle = `${userTag} was kicked`
      dmDescription = `<@${target.id}>, you were kicked from ${guild.name}.`;
      logAuthor = `${moderatorUser.tag} kicked a member`;
      action = target.kick({ reason: reason })
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
        action = target.timeout(durationMs, reason)
        logcolor = LOG_COLORS['Mute'];
        warnType = 'Mute'
      }
      break;
    }
  }
  const buttonmessage = messageid ? `https://discord.com/channels/${guild.id}/${channel.id}/${messageid}` : null
  isAutomated ? sentMessage = await channel.send({ embeds: [new EmbedBuilder({ color: logcolor, author: { name: commandTitle, iconURL: icon } })] })
    : !buttonmessage ? sentMessage = await interaction.reply({ embeds: [new EmbedBuilder({ color: logcolor, author: { name: commandTitle, iconURL: icon } })], withResponse: true })
      : null
  editPunishment({ userId: target.id, guildId: guild.id, moderatorId: moderatorUser.id, reason: reason, durationMs: durationMs, warnType: warnType, weight: currentWarnWeight, channel: channel.id, messagelink: buttonmessage ?? `https://discord.com/channels/${guild.id}/${channel.id}/${sentMessage.id}` }).catch(err => console.warn(err));
  activeWarns = await getPunishments(target.id, guild.id, true);
  const refrences = (warnType === 'Ban' ? activeWarns.filter(r => r.type === 'Ban') : activeWarns.filter(r => r.type !== 'Kick'))
    .slice(0, 10)
    .map((punishment, index) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)
  const punishmentFields = (warnType !== 'Ban' && warnType !== 'Kick') ? [
    { name: 'Punishments:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
    { name: 'Active Warnings:', value: `\`${activeWarns.length}\``, inline: false },
    { name: 'Next Punishment:', value: `\`${getNextPunishment(activeWarns.length).label}\``, inline: false }
  ] : [];
  const logEmbed = new EmbedBuilder({
    color: logcolor,
    author: { name: logAuthor, iconURL: moderatorUser.displayAvatarURL({ dynamic: true }) },
    thumbnail: { url: icon },
    fields: [
      { name: 'Target:', value: `${target}`, inline: true },
      { name: 'Channel:', value: `${channel}`, inline: true },
      ...refrences ? [{ name: 'History:', value: `${refrences.join(' | ')}`, inline: true }] : [],
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      ...punishmentFields],
    timestamp: Date.now(),
    footer: { text: 'User DMed ✅' }
  })
  const dmExtraFields = (warnType !== 'Ban' && warnType !== 'Kick') ? [
    { name: 'Punishments:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
    { name: 'Active Warnings:', value: `\`${activeWarns.length}\``, inline: false },
    ...(warnType !== 'Mute' ? [
      { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + unitMap.day) / 1000)}:F>` },
      { name: 'Next Punishment:', value: `\`${getNextPunishment(activeWarns.length).label}\``, inline: false }
    ] : []),
  ] : [];
  try {
    target.send({
      embeds: [new EmbedBuilder({
        color: logcolor, author: { name: `${userTag}`, iconURL: icon }, thumbnail: { url: guild.iconURL() }, description: dmDescription, fields: [{ name: 'Reason:', value: `\`${reason}\``, inline: false }, ...dmExtraFields], timestamp: Date.now()
      })]
    })
  } catch { logEmbed.setFooter({ text: 'User DMed 🚫' }) }
  const logChannel = guild.channels.cache.get(logChannelid);
  logChannel.send({ embeds: [logEmbed] });
  action
}