import { EmbedBuilder } from 'discord.js';
import { mutelogChannelid } from '../BotListeners/Extravariables/channelids.js';
import getWarnStats from '../moderation/simulatedwarn.js';
import getNextPunishment from '../moderation/punishments.js';
import { addWarn } from '../Database/databasefunctions.js';
import logRecentCommand from '../Logging/recentcommands.js';


const THRESHOLD = 24 * 60 * 60 * 1000; // 24h

export default async function warnUser({
  guild,
  targetUser,
  moderatorUser,
  reason,
  channel,
  isAutomated = true,
  currentWarnWeight = 1
}) {

  // --- Database Operations (getUser, getWarnStats, addWarn) ---

  // Add the new warning to the DB.
  addWarn(targetUser.id, moderatorUser.id, reason, currentWarnWeight, channel.id);

  // Fetch updated active warnings for the user after the new warn has been added.
  const { activeWarnings } = await getWarnStats(targetUser.id);

  // Get label for the next punishment stage based on the *total* active warnings.
  const { label } = getNextPunishment(activeWarnings.length);

  // --- 3. Calculating Expiry Time ---
  const expiresAt = new Date(Date.now() + THRESHOLD);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  // --- Common fields for Embed Building ---
  const commonFields = (warnReason, warnWeight, nextPunishmentLabel, activeWarnsCount) => [
    { name: 'Reason:', value: `\`${warnReason}\``, inline: false },
    { name: 'Punishments:', value: `\`${warnWeight} warn\``, inline: false },
    { name: 'Next Punishment:', value: `\`${nextPunishmentLabel}\``, inline: false },
    { name: 'Active Warnings:', value: `\`${activeWarnsCount}\``, inline: false },
  ];

  // Build DM embed to notify the user
  const dmEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${targetUser.user.tag} was issued a warning`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(guild.iconURL())
    .setDescription(`<@${targetUser.id}>, you were given a \`warning\` in Salty's Cave.`)
    .addFields( // Use addFields consistently
      ...commonFields(reason, currentWarnWeight, label, activeWarnings.length),
      { name: 'Warn expires on:', value: formattedExpiry, inline: false },
    )
    .setTimestamp();

  // Embed for confirmation in the channel or return
  const commandEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${targetUser.user.tag} was issued a warning`,
      iconURL: targetUser.displayAvatarURL({ dynamic: true }),
    });

  // Embed for moderation log channel
  const logEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${moderatorUser.tag} warned a member`,
      iconURL: moderatorUser.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true })) // Use dynamic for animated avatars
    .addFields( // Use addFields consistently
      { name: 'Target:', value: `${targetUser}`, inline: true },
      { name: 'Channel:', value: `${channel}`, inline: true },
      ...commonFields(reason, currentWarnWeight, label, activeWarnings.length)
    )
    .setTimestamp();

  // --- 5. DMing User & Logging ---
  try {
    await targetUser.send({ embeds: [dmEmbed] });
    logEmbed.setFooter({ text: 'User was DMed.' });
  } catch (dmError) {
    console.warn(`[WarnUser] Could not DM user ${targetUser.tag}: ${dmError.message}`);
    logEmbed.setFooter({ text: 'User could not be DMed.' });
  }

  const logChannel = guild.channels.cache.get(mutelogChannelid);
  if (logChannel) {
    try {
      await logChannel.send({ embeds: [logEmbed] });
    } catch (logSendError) {
      console.error(`[WarnUser] Failed to send warn log to channel ${mutelogChannelid}: ${logSendError.message}`);
    }
  } else {
    console.warn(`[WarnUser] Mute log channel with ID ${mutelogChannelid} not found.`);
  }

  // --- Log Command ---
  logRecentCommand(`warn - ${targetUser.tag} - ${reason} - issuer: ${moderatorUser.tag}`);

  // Send confirmation embed if automated, else return the embed for manual use
  if (isAutomated) {
    try {
      await channel.send({ embeds: [commandEmbed] });
    } catch (sendError) {
      console.error(`[WarnUser] Failed to send command confirmation to channel ${channel.id}: ${sendError.message}`);
    }
  } else
    return commandEmbed;
}