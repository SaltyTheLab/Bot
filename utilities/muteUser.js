import { EmbedBuilder } from 'discord.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { addMute, getUser } from '../Database/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/Extravariables/channelids.js';
import { getWarnStats } from '../moderation/simulatedwarn.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const MAX_TIMEOUT_MS = 21600000; // 6 hours max timeout for automated timeouts

// Helper function for display string of duration
const getDurationDisplay = ms => {
  if (ms >= unitMap.day) return `${Math.ceil(ms / unitMap.day)} day(s)`;
  if (ms >= unitMap.hour) return `${Math.ceil(ms / unitMap.hour)} hour(s)`;
  return `${Math.ceil(ms / unitMap.min)} minute(s)`;
};

export async function muteUser({
  guild,
  targetUser,
  moderatorUser,
  reason,
  channelid,
  isAutomated = true,
  violations = [],
  duration,
  unit,
}) {
  const [target, issuer, commandChannel] = await Promise.all([
    guild.members.fetch(targetUser).catch(err => {
      console.error(`[muteUser] Failed to fetch targetUser (${targetUser}):`, err);
      return null;
    }),
    guild.members.fetch(moderatorUser).catch(err => {
      console.error(`[muteUser] Failed to fetch moderatorUser (${moderatorUser}):`, err);
      return null;
    }),
    guild.channels.fetch(channelid).catch(err => {
      console.error(`[muteUser] Failed to fetch commandChannel (${channelid}):`, err);
      return null;
    }),
  ]);

  if (!target) {
    console.error(`[muteUser] Target user not found: ${targetUser}`);
    return '❌ Could not find the target user in this guild.';
  }
  if (!issuer) {
    console.error(`[muteUser] Moderator user not found: ${moderatorUser}`);
    return '❌ Could not find the moderator user in this guild.';
  }
  if (!commandChannel) {
    console.error(`[muteUser] Command/Violation channel not found with ID: ${channelid}`);
    return '❌ Could not find the specified channel for logging/reply.';
  }

  getUser(target.id); // Ensure user exists in DB

  const multiplier = unitMap[unit];
  if (!multiplier || duration <= 0) {
    return '❌ Invalid duration or unit specified for mute.';
  }

  const calculatedDurationMs = duration * multiplier;
  const effectiveDurationMs = Math.min(calculatedDurationMs, MAX_TIMEOUT_MS);
  const durationStr = getDurationDisplay(effectiveDurationMs);

  const warnExpiresAt = new Date(Date.now() + unitMap.day); // 1 day from now
  const formattedWarnExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`; // Relative timestamp

  const initialWarnStats = await getWarnStats(target.id, violations);
  const { currentWarnWeight } = initialWarnStats;

  if (isAutomated) {
    await addMute(target.id, issuer.id, reason, effectiveDurationMs, currentWarnWeight, commandChannel.id);
  }

  const { activeWarnings } = await getWarnStats(target.id, violations);
  const { label: nextPunishmentLabel } = getNextPunishment(activeWarnings.length + currentWarnWeight);

  // --- Helper for Common Embed Fields (excluding mute-specific duration/expiry from this helper) ---
  // Now just for the reason and active warnings count, as "Punishments" field will be custom.
  const buildBasicFields = (reason,currentWarnWeight, durationStr, activeWarnsCount) => {
    return [
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      { name: 'Punishments:', value: `\`${currentWarnWeight} warn, ${durationStr}\``, inline: false },
      { name: 'Active Warnings:', value: `\`${activeWarnsCount}\``, inline: true }

    ];
  };

  // --- DM Embed to User ---
  const dmEmbed = new EmbedBuilder()
    .setColor(0xffa500)
    .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(guild.iconURL())
    .setDescription(`${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
    .addFields(
      ...buildBasicFields(reason,currentWarnWeight, durationStr, activeWarnings.length), // Use the more basic helper
      { name: 'Warn expires:', value: formattedWarnExpiry, inline: false },
    )
    .setTimestamp();

  // --- Log Embed for Mod Log ---
  const logEmbed = new EmbedBuilder()
    .setColor(0xffa500)
    .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
    .setAuthor({
      name: `${issuer.user.tag} muted a member`,
      iconURL: issuer.user.displayAvatarURL({ dynamic: true }),
    })
    .addFields(
      { name: 'Target:', value: `${target} (\`${target.id}\`)`, inline: true },
      { name: 'Moderator:', value: `${issuer} (\`${issuer.id}\`)`, inline: true },
      { name: 'Channel:', value: `${commandChannel}`, inline: true },
      ...buildBasicFields(reason, currentWarnWeight, durationStr, activeWarnings.length), // Use the more basic helper
      { name: 'Warn expires:', value: formattedWarnExpiry, inline: false },
      { name: 'Next Punishment:', value: `\`${nextPunishmentLabel}\``, inline: false },
    )
    .setTimestamp();

  // --- Attempt to DM user ---
  try {
    await target.send({ embeds: [dmEmbed] });
    logEmbed.setFooter({ text: 'User was Dmed.' });
  } catch (dmErr) {
    console.error(`[muteUser] Failed to DM user ${target.user.tag}:`, dmErr.message);
    logEmbed.setFooter({ text: 'User could not be DMed.' });
  }

  // --- Attempt to Timeout User ---
  try {
    await target.timeout(effectiveDurationMs, reason);
    logRecentCommand(`Timeout applied for ${target.user.tag} for ${durationStr} by ${issuer.user.tag}`);
  } catch (err) {
    console.error(`[muteUser] Failed to timeout user ${target.user.tag}:`, err.message);
    logEmbed.addFields({ name: 'Timeout Status:', value: `❌ Failed: ${err.message}`, inline: false });
  }

  // --- Send Log to Mod Log Channel ---
  const logChannel = guild.channels.cache.get(mutelogChannelid);
  if (logChannel) {
    try {
      await logChannel.send({ embeds: [logEmbed] });
    } catch (logSendErr) {
      console.error(`[muteUser] Failed to send mute log to channel ${mutelogChannelid}:`, logSendErr);
    }
  } else {
    console.error(`[muteUser] Mute log channel not found with ID: ${mutelogChannelid}`);
  }

  // --- Log Command for Audit ---
  logRecentCommand(`MUTE: ${target.user.tag} (${target.id}) | Reason: ${reason} | Duration: ${durationStr} | Issuer: ${issuer.user.tag} (${issuer.id})`);

  // --- Command Confirmation Embed for Channel ---
  const commandEmbed = new EmbedBuilder()
    .setColor(0xffa500)
    .setAuthor({
      name: `${target.user.tag} was issued a ${durationStr} mute.`,
      iconURL: target.user.displayAvatarURL({ dynamic: true }),
    });

  if (isAutomated) {
    if (commandChannel) {
      try {
        await commandChannel.send({ embeds: [commandEmbed] });
      } catch (commandSendErr) {
        console.error(`[muteUser] Failed to send command confirmation to channel ${commandChannel.id}:`, commandSendErr);
      }
    } else {
      console.warn(`[muteUser] No command channel available to send automated mute confirmation.`);
    }
    return;
  } else {
    return commandEmbed;
  }
}