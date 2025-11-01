import { EmbedBuilder, GuildMember } from 'discord.js';
import { addPunishment, getPunishments, getUser } from '../Database/databasefunctions.js';
import logRecentCommand from '../WebsiteTool/recentcommands.js';
import { load, save } from '../utilities/jsonloaders.js';
import guildChannelMap from "../BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};
const THRESHOLD = 24 * 60 * 60 * 1000;
const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000 };
const MAX_TIMEOUT_MS = 2419200000;
function getNextPunishment(weightedWarns) {
  weightedWarns -= 1
  const punishmentStages = [
    { type: 'Warn', label: '15 min mute', minutes: 0 },
    { type: 'Mute', label: '30 min mute', minutes: 15 },
    { type: 'Mute', label: '45 min mute', minutes: 30 },
    { type: 'Mute', label: '1 hour mute', minutes: 45 },
    { type: 'Mute', label: '2 hour mute', minutes: 60 },
    { type: 'Mute', label: '4 hour mute', minutes: 120 },
    { type: 'Mute', label: '6 hour mute', minutes: 240 },
    { type: 'Mute', label: '6 hour mute', minutes: 360 }
  ];
  let index = Math.floor(weightedWarns);
  if (index >= punishmentStages.length) index = punishmentStages.length - 1;
  const { type, label, minutes } = punishmentStages[index];;
  const unit = minutes >= 60 ? 'hour' : 'min';
  const duration = unit === 'hour' ? Math.ceil(minutes / 60) : minutes;

  return { type, duration, unit, label };
}
export default async function punishUser({ interaction = null, guild, target, moderatorUser, reason, channel, isAutomated = false, currentWarnWeight = 1, banflag = false, buttonflag = false, messageid = null
}) {
  const targetUser = await guild.members.fetch(target).catch(() => null) ?? await guild.client.users.fetch(target).catch(() => null);
  const userTag = targetUser instanceof GuildMember ? targetUser.user.tag : targetUser.tag
  const usercheck = await getUser(targetUser.id, guild.id);
  const buttonmessage = messageid ? await channel.messages.fetch(messageid) : null
  const activeWarns = await getPunishments(targetUser.id, guild.id, true)
  let bans = await load("BotListeners/Extravariables/commandsbans.json")
  let dmDescription = `<@${targetUser.id}>, you were given a \`warning\` in ${guild.name}.`;
  let logAuthor = `${moderatorUser.tag} warned a member`;
  let commandTitle = `${userTag} was issued a warning`;
  let action = Promise.resolve();
  let logChannel = guild.channels.cache.get(guildChannelMap[guild.id].modChannels.mutelogChannel);
  let logcolor = LOG_COLORS['Warn']
  let sentMessage = null;
  let warnType = banflag ? 'Ban' : (interaction && interaction.options.getSubcommand() === 'mute') ? 'Mute' : 'Warn';
  let durationMs = 0;
  let durationStr = '';

  if (!usercheck && interaction) {
    interaction.reply('❌ User does not exist in the Database. Likely bot.'); return;
  }

  switch (warnType) {
    case 'Ban':
      bans.push(targetUser.id);
      await save("BotListeners/Extravariables/commandsbans.json", bans)
      commandTitle = `${userTag} was banned`;
      dmDescription = `${targetUser}, you have been \`banned\` from ** ${guild.name} **.\n\n ** Reason **: \n\`${reason}\`\nPlease use /appeal to appeal your ban.\n\n Incase if I do not have a mutual server with you, you can use this invite link: https://discord.gg/qMjjyXyYbr`
      logAuthor = `${moderatorUser.tag} banned a member`
      logChannel = guild.channels.cache.get(guildChannelMap[guild.id].modChannels.banlogChannel)
      action = await guild.bans.create(targetUser.id, { reason: `Ban command: ${reason}`, deleteMessageSeconds: 604800 })
      logcolor = LOG_COLORS['Ban'];
      break;
    case 'Mute': {
      durationMs = interaction.options.getInteger('duration') * unitMap[interaction.options.getString('unit')];
      durationMs = Math.min(durationMs, MAX_TIMEOUT_MS);
      durationStr = durationMs >= unitMap.day ? `${Math.ceil(durationMs / unitMap.day)} day(s)`
        : durationMs >= unitMap.hour ? `${Math.ceil(durationMs / unitMap.hour)} hour(s)`
          : `${Math.ceil(durationMs / unitMap.min)} minute(s)`;
      commandTitle = `${userTag} was issued a ${durationStr} mute`
      dmDescription = `<@${targetUser.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`;
      logAuthor = `${moderatorUser.tag} muted a member`;
      action = targetUser.timeout(durationMs, reason)
      logcolor = LOG_COLORS['Mute'];
      break;
    }
    case 'Warn': {
      const punishment = getNextPunishment(activeWarns.length + currentWarnWeight);
      if (punishment.type === 'Mute') {
        durationMs = Math.min(punishment.duration * unitMap[punishment.unit], MAX_TIMEOUT_MS);
        durationStr = punishment.unit === 'day' ? `${Math.ceil(durationMs / unitMap.day)} day(s)`
          : punishment.unit === 'hour' ? `${Math.ceil(durationMs / unitMap.hour)} hour(s)`
            : `${Math.ceil(durationMs / unitMap.min)} minute(s)`;
        commandTitle = `${userTag} was issued a ${durationStr} mute`
        dmDescription = `<@${targetUser.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`;
        logAuthor = `${moderatorUser.tag} muted a member`;
        action = targetUser.timeout(durationMs, reason)
        logcolor = LOG_COLORS['Mute'];
        warnType = 'Mute'
      }
      break;
    }
  }
  const commandEmbed = new EmbedBuilder()
    .setColor(logcolor)
    .setAuthor({ name: commandTitle, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })

  if (!buttonflag && isAutomated)
    sentMessage = await channel.send({ embeds: [commandEmbed] });
  else if (!isAutomated && sentMessage == null)
    sentMessage = await interaction.reply({ embeds: [commandEmbed], withResponse: true });

  const messageLink = buttonmessage ?? `https://discord.com/channels/${guild.id}/${channel.id}/${sentMessage.id}`;
  const formattedReason = buttonflag ? `Button Ban: ${reason}`
    : banflag ? `Ban Command: ${reason}`
      : reason
  await addPunishment(targetUser.id, moderatorUser.id, reason, durationMs, warnType, currentWarnWeight, channel.id, guild.id, messageLink).catch(err => console.warn(err));

  const activeWarnings = await getPunishments(targetUser.id, guild.id, true);
  const refrences = warnType === 'Ban' ?
    activeWarnings.filter(r => r.type === 'Ban').slice(0, 10).map((punishment, index) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)
    : activeWarnings.slice(0, 10).map((punishment, index) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)

  const { label } = getNextPunishment(activeWarnings.length);
  const expiresAt = new Date(Date.now() + THRESHOLD);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  function commonFields(warnReason, warnWeight, activeWarnsCount, durationStr = '', formattedExpiry, warnType) {
    if (warnType == 'Ban')
      return [{ name: 'Reason:', value: `\`${warnReason}\``, inline: false }]
    else return [
      { name: 'Reason:', value: `\`${warnReason}\``, inline: false },
      { name: 'Punishments:', value: `\`${warnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
      { name: 'Active Warnings:', value: `\`${activeWarnsCount}\``, inline: false },
      { name: warnType == 'mute' ? 'Mute expires:' : 'Warn expires:', value: `${formattedExpiry}` }
    ];
  };
  const bancheck = warnType !== 'Ban' ? { name: 'Next Punishment:', value: `\`${label}\``, inline: false } : null

  const dmEmbed = new EmbedBuilder()
    .setColor(logcolor)
    .setAuthor({ name: `${userTag}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(guild.iconURL())
    .setDescription(dmDescription)
    .addFields(...commonFields(formattedReason, currentWarnWeight, activeWarnings.length, durationStr, formattedExpiry, warnType))
    .setTimestamp();

  const logEmbed = new EmbedBuilder()
    .setColor(logcolor)
    .setAuthor({ name: logAuthor, iconURL: moderatorUser.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Target:', value: `${targetUser}`, inline: true },
      { name: 'Channel:', value: `${channel}`, inline: true },
      { name: 'History:', value: `${refrences.length > 0 ? refrences.join(' | ') : 'none'}`, inline: true },
      ...commonFields(formattedReason, currentWarnWeight, activeWarnings.length, durationStr, formattedExpiry, warnType),
      ...(warnType !== 'Ban' ? [bancheck] : [])
    )
    .setTimestamp();

  try {
    await targetUser.send({ embeds: [dmEmbed] });
    logEmbed.setFooter({ text: 'User DMed ✅' });
  } catch {
    logEmbed.setFooter({ text: 'User DMed 🚫' });
  }
  await logChannel.send({ embeds: [logEmbed] });
  await action
  if (!isAutomated)
    logRecentCommand(`${warnType} - ${userTag} - ${reason} - issuer: ${moderatorUser.tag} ${durationMs > 0 ? `- duration: ${durationStr}` : ``}`)
}