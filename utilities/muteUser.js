import { EmbedBuilder } from 'discord.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { addMute } from '../Database/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/channelids.js';
import { getWarnStats } from '../moderation/simulatedwarn.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const MAX_TIMEOUT_MS = 21600000; // 6 hours max timeout for automod

export async function muteUser({
  guild,
  targetUser,
  moderatorUser,
  reason,
  duration,
  unit,
  channel,
  isAutomated = true,
  violations = [],
  violationType = 'Mute',
}) {
  // Fetch guild members safely
  const target = await guild.members.fetch(targetUser).catch(() => null);
  const issuer = await guild.members.fetch(moderatorUser).catch(() => null);
  if (!target || !issuer) return '❌ Could not find target or issuer.';

  // Validate duration and unit
  const multiplier = unitMap[unit];
  if (!multiplier || duration <= 0) return '❌ Invalid duration or unit.';
  // Get warn stats for target user
  const warnStats = await getWarnStats(target.id, violations);
  const { currentWarnWeight, activeWarnings, weightedWarns } = warnStats;

  // Calculate mute duration in ms capped at max timeout
  const durationMs = Math.min(duration * multiplier * weightedWarns, MAX_TIMEOUT_MS);
  const expiresAt = new Date(Date.now() + durationMs);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  // Save mute to database once
  addMute(target.id, issuer.id, reason, durationMs, currentWarnWeight, violationType);

  const updatedWarnStats = await getWarnStats(target.id, violations);
  const { activeWarnings: updatedActiveWarnings } = updatedWarnStats;

  const { label } = getNextPunishment(updatedActiveWarnings.length + currentWarnWeight);

  const getDurationDisplay = ms => {
    if (ms >= unitMap.day) return `${Math.ceil(ms / unitMap.day)} day(s)`;
    if (ms >= unitMap.hour) return `${Math.ceil(ms / unitMap.hour)} hour(s)`;
    return `${Math.ceil(ms / unitMap.min)} minute(s)`;
  };
  const durationStr = getDurationDisplay(durationMs);

  // DM embed to user
  const dmEmbed = new EmbedBuilder()
    .setColor(0xffa500)
    .setAuthor({ name: target.user.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(guild.iconURL())
    .setDescription(`${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
    .addFields(
      { name: 'Reason:', value: `\`${reason}\`` },
      { name: 'Punishments:', value: `\`${currentWarnWeight} warn, ${durationStr}\`` },
      { name: 'Next Punishment:', value: `\`${label}\``, inline: false },
      { name: 'Active Warnings:', value: `\`${activeWarnings.length}\``, inline: false },
      { name: 'Mute expires on:', value: formattedExpiry, inline: false },
    )
    .setTimestamp();

  // Log embed for mod log
  const logEmbed = new EmbedBuilder()
    .setColor(0xffa500)
    .setThumbnail(target.displayAvatarURL())
    .setAuthor({
      name: `${issuer.user.tag} muted a member`,
      iconURL: issuer.displayAvatarURL({ dynamic: true }),
    })
    .addFields(
      { name: 'Target:', value: `${target}`, inline: true },
      { name: 'Channel:', value: `${channel}`, inline: true },
      { name: 'Punishments:', value: `\`${currentWarnWeight} warn, ${durationStr}\`` },
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      { name: 'Next Punishment:', value: `\`${label}\``, inline: false },
      { name: 'Active Warnings:', value: `\`${activeWarnings.length}\``, inline: false },
    )
    .setTimestamp();

  // Attempt to timeout user
  try {
    await target.timeout(durationMs, reason);
  } catch (err) {
    console.log(`Failed to mute user ${target.user.tag}:`, err.message);
    // Owners or admins might not be mutable
  }

  // Attempt to DM user
  try {
    await target.send({ embeds: [dmEmbed] });
    logEmbed.setFooter({ text: 'User was DMed.' });
  } catch {
    logEmbed.setFooter({ text: 'User could not be DMed.' });
  }

  // Send log to mute log channel
  const logChannel = guild.channels.cache.get(mutelogChannelid);
  if (logChannel) await logChannel.send({ embeds: [logEmbed] });

  // Log command for audit
  logRecentCommand(`mute - ${target.user.tag} - ${reason} - issuer: ${issuer.user.tag}`);

  // Command confirmation embed for channel
  const commandEmbed = new EmbedBuilder()
    .setColor(0xffa500)
    .setAuthor({
      name: `${target.user.tag} was issued a ${durationStr} mute.`,
      iconURL: target.displayAvatarURL({ dynamic: true }),
    });

  if (isAutomated) {
    await channel.send({ embeds: [commandEmbed] });
    return;
  } else {
    return commandEmbed;
  }
}
