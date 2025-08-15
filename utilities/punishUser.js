import { EmbedBuilder } from 'discord.js';
import getWarnStats from '../moderation/simulatedwarn.js';
import getNextPunishment from '../moderation/punishments.js';
import { addPunishment } from '../Database/databasefunctions.js';
import logRecentCommand from '../Logging/recentcommands.js';
import { guildModChannelMap } from '../BotListeners/Extravariables/channelids.js';

const THRESHOLD = 24 * 60 * 60 * 1000; // 24h
const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const MAX_TIMEOUT_MS = 21600000; // 6 hours max timeout for automated timeouts

const LOG_COLORS = {
  Warn: 0xffcc00,
  Mute: 0xff4444,
  Ban: 0xd10000
};
// Helper function for display string of duration
const getDurationDisplay = ms => {
  if (ms >= unitMap.day) return `${Math.ceil(ms / unitMap.day)} day(s)`;
  if (ms >= unitMap.hour) return `${Math.ceil(ms / unitMap.hour)} hour(s)`;
  return `${Math.ceil(ms / unitMap.min)} minute(s)`;
};

/**
 * Executes a punishment (warn, mute, or ban) on a user.
 * Handles duration calculation, database logging, DMing the user,
 * sending log embeds, and applying the Discord API action.
 *
 * @param {import('discord.js').Guild} options.guild - The guild where the punishment is applied.
 * @param {string} options.target - The ID of the target user.
 * @param {import('discord.js').User} options.moderatorUser - The user who issued the punishment.
 * @param {string} options.reason - The reason for the punishment.
 * @param {import('discord.js').TextChannel} options.channel - The channel where the command was executed (for replies).
 * @param {boolean} [options.isAutomated=true] - Whether the punishment is automated (e.g., by automod).
 * @param {number} [options.currentWarnWeight=1] - The weight of the current warning (for database logging).
 * @param {number} [options.duration=0] - The duration for mutes (in units or milliseconds based on isAutomated).
 * @param {string} [options.unit='min'] - The unit for duration (if isAutomated is true).
 * @param {number} [options.banflag=0] - Flag to indicate if the action is a ban.
 * @param {number} [options.buttonflag=0] - Flag to indicate if the action came from a button interaction.
 * @returns {Promise<object>} returns an embed based on if it is automated or not
 */

export default async function punishUser({
  guild,
  target,
  moderatorUser,
  reason,
  channel,
  isAutomated = true,
  currentWarnWeight = 1,
  duration = 0,
  unit = 'min',
  banflag = false,
  buttonflag = false
}) {
  const targetUser = await guild.members.fetch(target);
  let durationStr;
  let effectiveDurationMs;
  let warnType;
  const multiplier = unitMap[unit]

  // --- Define what type it is ---
  if (banflag)
    warnType = 'Ban'
  else if (duration > 0) {
    warnType = 'Mute'
    if (!multiplier || duration <= 0)
      return '❌ Invalid duration or unit specified for mute.';
    const calculatedDurationMs = isAutomated ? duration * multiplier : duration;
    effectiveDurationMs = Math.min(calculatedDurationMs, isAutomated ? MAX_TIMEOUT_MS : 100000000);
    durationStr = getDurationDisplay(effectiveDurationMs);
  }
  else
    warnType = 'Warn'
  if (!targetUser.bot) {
    try {
      addPunishment(targetUser.id, moderatorUser.id, reason, effectiveDurationMs, warnType, currentWarnWeight, channel.id, guild.id);
    } catch (err) {
      console.warn(err)
    }
  } else
    `${targetUser.tag} is a bot.`

  // Fetch updated active warnings for the user after the new warn has been added.
  const { activeWarnings } = await getWarnStats(targetUser.id, guild.id);

  // Get label for the next punishment stage based on the *total* active warnings.
  const { label } = getNextPunishment(activeWarnings.length);

  // --- 3. Calculating Expiry Time ---
  const expiresAt = new Date(Date.now() + THRESHOLD);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  // --- Common fields for Embed Building ---
  const commonFields = (warnReason, warnWeight, activeWarnsCount, durationStr = '', formattedExpiry, warnType) => {
    if (warnType == 'Ban')
      return [{ name: 'Reason:', value: `\`${warnReason}\``, inline: false }]
    else
      return [
        { name: 'Reason:', value: `\`${warnReason}\``, inline: false },
        { name: 'Punishments:', value: `\`${warnWeight} warn${durationStr ? `, ${durationStr}` : ''}\``, inline: false },
        { name: 'Active Warnings:', value: `\`${activeWarnsCount}\``, inline: false },
        { name: duration > 0 ? 'Mute expires:' : 'Warn expires:', value: `${formattedExpiry}` },
      ];
  };

  // Build DM embed to notify the user
  const dmEmbed = new EmbedBuilder()
    .setColor(LOG_COLORS[warnType])
    .setAuthor({
      name: `${targetUser.user.tag}`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(guild.iconURL())
    .setDescription(warnType == 'Ban' ? `${targetUser}, you have been **banned** from **${guild.name}**.\n\n` +
      `Please [click here](https://dyno.gg/form/9dd2f880) to appeal your ban.`
      : duration > 0 ? `<@${targetUser.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`
        : `<@${targetUser.id}>, you were given a \`warning\` in ${guild.name}.`)
    .addFields(
      ...commonFields(reason, currentWarnWeight, activeWarnings.length, durationStr, formattedExpiry, warnType),
    )
    .setTimestamp();

  const fields = [
    { name: 'Target:', value: `${targetUser}`, inline: true },
    { name: 'Channel:', value: `${channel}`, inline: true },
    // Use the spread operator to include all fields from commonFields
    ...commonFields(reason, currentWarnWeight, activeWarnings.length, durationStr, formattedExpiry, warnType),
    // The conditional field for 'Next Punishment'
    warnType !== 'Ban' ? { name: 'Next Punishment:', value: `\`${label}\``, inline: false } : null
  ];

  // Embed for moderation log channel
  const logEmbed = new EmbedBuilder()
    .setColor(LOG_COLORS[warnType])
    .setAuthor({
      name: warnType == 'Ban' ? `${moderatorUser.tag} banned a member`
        : duration > 0 ? `${moderatorUser.tag} muted a member`
          : `${moderatorUser.tag} warned a member`,
      iconURL: moderatorUser.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setFields(fields.filter(field => field !== null))
    .setTimestamp();

  // --- 5. DMing User & Logging ---
  logEmbed.setFooter({ text: 'User was DMed.' })
  await targetUser.send({ embeds: [dmEmbed] }).catch(dmError => {
    console.warn(`[punishUser] Could not DM user ${targetUser.user.tag}: ${dmError.message}`);
    logEmbed.setFooter({ text: 'User could not be DMed.' });
  })

  let logChannel;
  const guildLogChannelConfig = warnType == 'Ban' ? guildModChannelMap[guild.id].banlogChannel
    : guildModChannelMap[guild.id].mutelogChannel

  if (guildLogChannelConfig) {
    logChannel = guild.channels.cache.get(guildLogChannelConfig);
  } else {
    console.warn(`❌ No log channel configured for guild: ${guild.name} (${guild.id}). Mute log will not be sent.`);
  }

  const logPromise = logChannel?.send({ embeds: [logEmbed] }).catch(logSendErr => {
    console.error(`[WarnUser] Failed to send warn log to channel ${guildLogChannelConfig?.mutelogChannel || 'unknown'}:`, logSendErr);
  });


  const actionPromise = warnType === 'Ban' ?
    targetUser.ban({ reason: `Ban command: ${reason}`, deleteMessageSeconds: 604800 })
    : duration > 0 ? targetUser.timeout(effectiveDurationMs, reason) :
      Promise.resolve();

  try {
    await Promise.all([logPromise, actionPromise].filter(Boolean));
  } catch (err) {
    console.log(`❌ Failed to perform action: ${err.message ?? err}`);
  }

  // --- Log Command ---
  logRecentCommand(warnType == 'Ban' ? `Ban - ${targetUser.tag} - ${reason} - issuer: ${moderatorUser.tag}`
    : duration > 0 ? `Mute- ${targetUser.user.tag} - ${reason} - issuer: ${moderatorUser.tag} duration: ${durationStr}`
      : `warn - ${targetUser.user.tag} - ${reason} - issuer: ${moderatorUser.tag}`);

  const commandEmbed = new EmbedBuilder()
    .setColor(LOG_COLORS[warnType])
    .setAuthor({
      name: warnType == 'Ban' ? `${targetUser.user.tag} was banned`
        : duration > 0 ? `${targetUser.user.tag} was issued a ${durationStr} mute`
          : `${targetUser.user.tag} was issued a warning`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })

  // Send confirmation embed if automated, else return the embed for manual use
  if (!buttonflag) {
    if (isAutomated) {
      try {
        await channel.send({
          embeds: [commandEmbed]
        });
      } catch (sendError) {
        console.error(`[WarnUser] Failed to send command confirmation to channel ${channel.id}: ${sendError.message}`);
      }
    } else
      return commandEmbed
  }
}