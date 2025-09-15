import { EmbedBuilder, GuildMember, PermissionFlagsBits } from 'discord.js';
import getWarnStats from '../moderation/simulatedwarn.js';
import getNextPunishment from '../moderation/punishments.js';
import { addPunishment, getUser } from '../Database/databasefunctions.js';
import logRecentCommand from '../Logging/recentcommands.js';
import guildChannelMap from "../BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};
import { commandbans } from '../BotListeners/Extravariables/mapsandsets.js';
const BAN_CACHE_TIMEOUT = 5000;

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
  interaction,
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
  buttonflag = false,
  messagelink = null
}) {
  const modChannels = guildChannelMap[guild.id].modChannels
  const targetUser = await guild.members.fetch(target).catch(() => null) ?? await guild.client.users.fetch(target).catch(() => null);
  const staffcheck = targetUser.permissions.has(PermissionFlagsBits.ModerateMembers)
  const userTag = targetUser instanceof GuildMember ? targetUser.user.tag : targetUser.tag
  if (staffcheck) {
    interaction.reply(
      {
        embeds: [new EmbedBuilder()
          .setAuthor({
            name: userTag + ' is staff, please handle this with an admin or co-owner.', iconURL: targetUser.displayAvatarURL({ dynamic: true })
          })]
        , ephemeral: true
      })
    return;
  }

  const usercheck = await getUser(targetUser.id, guild.id);
  if (!usercheck && interaction)
    interaction.reply('❌ User does not exist in the Database. Likely bot.');
  let durationStr;
  let effectiveDurationMs;
  let warnType;
  let sentMessage;
  if (banflag) {
    warnType = 'Ban'
    commandbans.add(target);
    setTimeout(() => commandbans.delete(target), BAN_CACHE_TIMEOUT)
  }
  else if (duration > 0) {
    warnType = 'Mute'
    const multiplier = unitMap[unit]
    if (!multiplier || duration <= 0)
      return '❌ Invalid duration or unit specified for mute.';
    const calculatedDurationMs = isAutomated ? duration * multiplier : duration;
    effectiveDurationMs = Math.min(calculatedDurationMs, isAutomated ? MAX_TIMEOUT_MS : 100000000);
    durationStr = getDurationDisplay(effectiveDurationMs);
  }
  else
    warnType = 'Warn'

  const commandEmbed = new EmbedBuilder()
    .setColor(LOG_COLORS[warnType])
    .setAuthor({
      name: warnType == 'Ban' ? `${userTag} was banned`
        : duration > 0 ? `${userTag} was issued a ${durationStr} mute`
          : `${userTag} was issued a warning`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })

  // --- Send Reply and get the Message ID ---
  if (!buttonflag && isAutomated) {
    sentMessage = await channel.send({ embeds: [commandEmbed] }).catch(() => null);
  } else {
    // This is the key change: reply to the interaction and fetch the reply message
    sentMessage = await interaction.reply({ embeds: [commandEmbed], fetchReply: true }).catch(() => null);
  }


  const messageId = sentMessage ? sentMessage.id : null;
  const messageLink = messageId ? `https://discord.com/channels/${guild.id}/${channel.id}/${messageId}` : null;
  const formattedReason = buttonflag ? `Button Ban: ${reason}`
    : banflag ? `Ban Command: ${reason}`
      : reason

  //add the database entry
  try {
    await addPunishment(targetUser.id, moderatorUser.id, formattedReason, isAutomated ? effectiveDurationMs : duration, warnType, currentWarnWeight, channel.id, guild.id, buttonflag ? messagelink : messageLink);
  } catch (err) {
    console.warn(err);
  }

  // Fetch updated active warnings for the user after the new warn has been added.
  const { activeWarnings } = await getWarnStats(targetUser.id, guild.id);

  // get the users previous punishments and get the links from the
  // database, slice to keep it within discords field character limit
  const pastinfractions = activeWarnings.slice(0, 10);
  const refrences = pastinfractions.map((punishment, index) => {
    if (punishment.refrence) {
      return `[Case ${index + 1}](${punishment.refrence})`
    }
  })
  const displayrefs = refrences.length > 0 ? refrences.join(' | ') : 'none'

  const { label } = getNextPunishment(activeWarnings.length);

  // --- 3. Calculating Expiry Time ---
  const expiresAt = new Date(Date.now() + THRESHOLD);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  // --- Common fields for Embed Building ---
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
  // Build DM embed to notify the user
  const dmEmbed = new EmbedBuilder()
    .setColor(LOG_COLORS[warnType])
    .setAuthor({
      name: `${targetUser instanceof GuildMember ? targetUser.user.tag : targetUser.tag}`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })
    .setThumbnail(guild.iconURL())
    .setDescription(warnType == 'Ban' ? `${targetUser}, you have been \`banned\` from ** ${guild.name} **.\n\n` + ` ** Reason **: \n\`${reason}\`\n` +
      `Please use /appeal to appeal your ban.\n\n Incase if I do not have a mutual server with you, you can use this invite link: https://discord.gg/Aszq4EDB`
      : duration > 0 ? `<@${targetUser.id}>, you were given a \`${durationStr} mute\` in ${guild.name}.`
        : `<@${targetUser.id}>, you were given a \`warning\` in ${guild.name}.`)
    .addFields(...commonFields(formattedReason, currentWarnWeight, activeWarnings.length, durationStr, formattedExpiry, warnType))
    .setTimestamp();
  const bancheck = warnType !== 'Ban' ? { name: 'Next Punishment:', value: `\`${label}\``, inline: false } : null
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
    .addFields(
      { name: 'Target:', value: `${targetUser}`, inline: true },
      { name: 'Channel:', value: `${channel}`, inline: true },
      { name: 'History:', value: `${displayrefs}`, inline: true },
      ...commonFields(formattedReason, currentWarnWeight, activeWarnings.length, durationStr, formattedExpiry, warnType),
      ...(warnType !== 'Ban' ? [bancheck] : [])
    )
    .setTimestamp();

  // --- 5. DMing User & Logging ---
  logEmbed.setFooter({ text: 'User DMed ✅' })
  await targetUser.send({
    embeds: [dmEmbed],
  })
    .catch(() => logEmbed.setFooter(
      { text: 'User DMed 🚫' }
    ));

  let logChannel = guild.channels.cache.get(warnType == 'Ban' ? modChannels.banlogChannel
    : modChannels.mutelogChannel);

  if (!logChannel)
    console.warn(`❌ No log channel configured for guild: ${guild.name} (${guild.id}). Mute log will not be sent.`);

  const logPromise = logChannel?.send({ embeds: [logEmbed] }).catch(logSendErr => {
    console.error(`[WarnUser] Failed to send warn log to channel ${logChannel || 'unknown'}:`, logSendErr);
  });

  const actionPromise = warnType === 'Ban' ?
    await guild.bans.create(targetUser.id, { reason: `Ban command: ${reason}`, deleteMessageSeconds: 604800 })
    : duration > 0 ? targetUser.timeout(effectiveDurationMs, reason) :
      Promise.resolve();

  try {
    await Promise.allSettled([logPromise, actionPromise].filter(Boolean));
  } catch (err) {
    console.log(`❌ Failed to perform action: ${err.message ?? err}`);
  }

  // --- Log Command ---
  if (!isAutomated)
    logRecentCommand(warnType == 'Ban' ? `Ban - ${userTag} - ${reason} - issuer: ${moderatorUser.tag}`
      : duration > 0 ? `Mute- ${userTag} - ${reason} - issuer: ${moderatorUser.tag} duration: ${durationStr}`
        : `warn - ${userTag} - ${reason} - issuer: ${moderatorUser.tag}`);
}