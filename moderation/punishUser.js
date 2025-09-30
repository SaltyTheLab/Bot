import { EmbedBuilder, GuildMember } from 'discord.js';
import getWarnStats from './getActiveWarns.js';
import getNextPunishment from './punishments.js';
import { addPunishment, getUser } from '../Database/databasefunctions.js';
import logRecentCommand from '../WebsiteTool/recentcommands.js';
import guildChannelMap from "../BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};
import { addBan } from '../utilities/jsonloaders.js';
const THRESHOLD = 24 * 60 * 60 * 1000;
const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000 };

export default async function punishUser({ interaction, guild, target, moderatorUser, reason, channel, isAutomated = true, currentWarnWeight = 1, duration = 0, banflag = false, buttonflag = false, messagelink = null
}) {
  const targetUser = await guild.members.fetch(target).catch(() => null) ?? await guild.client.users.fetch(target).catch(() => null);
  const userTag = targetUser instanceof GuildMember ? targetUser.user.tag : targetUser.tag
  const usercheck = await getUser(targetUser.id, guild.id);
  const warnType = banflag ? 'Ban' : duration > 0 ? 'Mute' : 'Warn'
  let durationStr, effectiveDurationMs, sentMessage, dmDescription, logAuthor, commandTitle, action, logChannel;

  if (!usercheck && interaction) {
    interaction.reply('❌ User does not exist in the Database. Likely bot.'); return;
  }

  switch (warnType) {
    case 'Ban':
      addBan(target)
      commandTitle = `${userTag} was banned`;
      dmDescription = `${targetUser}, you have been \`banned\` from ** ${guild.name} **.\n\n` + ` ** Reason **: \n\`${reason}\`\n` + `Please use /appeal to appeal your ban.\n\n Incase if I do not have a mutual server with you, you can use this invite link: https://discord.gg/Aszq4EDB`
      logAuthor = `${moderatorUser.tag} banned a member`
      logChannel = guild.channels.cache.get(guildChannelMap[guild.id].modChannels.banlogChannel)
      action = await guild.bans.create(targetUser.id, { reason: `Ban command: ${reason}`, deleteMessageSeconds: 604800 })
      break;
    case 'Mute':
      effectiveDurationMs = Math.min(duration, 100000000);
      durationStr = effectiveDurationMs >= unitMap.day ? `${Math.ceil(effectiveDurationMs / unitMap.day)} day(s)`
        : effectiveDurationMs >= unitMap.hour ? `${Math.ceil(effectiveDurationMs / unitMap.hour)} hour(s)`
          : `${Math.ceil(effectiveDurationMs / unitMap.min)} minute(s)`;
      commandTitle = `${userTag} was issued a ${durationStr} mute`
      dmDescription = `<@${targetUser.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`;
      logChannel = guild.channels.cache.get(guildChannelMap[guild.id].modChannels.mutelogChannel);
      logAuthor = `${moderatorUser.tag} muted a member`;
      action = targetUser.timeout(effectiveDurationMs, reason)
      break;
    default:
      commandTitle = `${userTag} was issued a warning`
      dmDescription = `<@${targetUser.id}>, you were given a \`warning\` in ${guild.name}.`
      logAuthor = `${moderatorUser.tag} warned a member`
      action = Promise.resolve();
      break;
  }
  const commandEmbed = new EmbedBuilder()
    .setColor(LOG_COLORS[warnType])
    .setAuthor({
      name: commandTitle,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })

  if (!buttonflag && isAutomated)
    sentMessage = await channel.send({ embeds: [commandEmbed] }).catch(() => null);
  else
    sentMessage = await interaction.reply({ embeds: [commandEmbed], fetchReply: true }).catch(() => null);

  const messageLink = `https://discord.com/channels/${guild.id}/${channel.id}/${sentMessage.id}`;
  const formattedReason = buttonflag ? `Button Ban: ${reason}`
    : banflag ? `Ban Command: ${reason}`
      : reason

  try {
    await addPunishment(targetUser.id, moderatorUser.id, reason, isAutomated ? effectiveDurationMs : duration, warnType, currentWarnWeight, channel.id, guild.id, buttonflag ? messagelink : messageLink);
  } catch (err) {
    console.warn(err);
  }

  const { activeWarnings } = await getWarnStats(targetUser.id, guild.id);

  const refrences = activeWarnings.slice(0, 10).map((punishment, index) => {
    if (punishment.refrence) {
      return `[Case ${index + 1}](${punishment.refrence})`
    }
  })

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
    .setColor(LOG_COLORS[warnType])
    .setAuthor({
      name: `${userTag}`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })
    .setThumbnail(guild.iconURL())
    .setDescription(dmDescription)
    .addFields(...commonFields(formattedReason, currentWarnWeight, activeWarnings.length, durationStr, formattedExpiry, warnType))
    .setTimestamp();

  const logEmbed = new EmbedBuilder()
    .setColor(LOG_COLORS[warnType])
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

  logEmbed.setFooter({ text: 'User DMed ✅' })
  await targetUser.send({ embeds: [dmEmbed] }).catch(() => logEmbed.setFooter({ text: 'User DMed 🚫' }));

  const logPromise = logChannel?.send({ embeds: [logEmbed] }).catch(logSendErr => {
    console.error(`[WarnUser] Failed to send warn log to channel ${logChannel || 'unknown'}:`, logSendErr);
  });

  try {
    await Promise.allSettled([logPromise, action].filter(Boolean));
  } catch (err) {
    console.log(`❌ Failed to perform action: ${err.message ?? err}`);
  }

  if (!isAutomated)
    logRecentCommand(`${warnType} - ${userTag} - ${reason} - issuer: ${moderatorUser.tag} ${duration > 0 ? `- duration: ${durationStr}` : ``}`)
}