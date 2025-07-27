import { EmbedBuilder } from 'discord.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { addMute } from '../Database/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/Extravariables/channelids.js';
import { getWarnStats } from '../moderation/simulatedwarn.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const MAX_TIMEOUT_MS = 21600000; // 6 hours max timeout for automod

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
  // Fetch guild members safely
  const [target, issuer, channel] = await Promise.all([
    guild.members.fetch(targetUser).catch(() => null),
    guild.members.fetch(moderatorUser).catch(() => null),
    guild.channels.fetch(channelid),
  ]);
  if (!target || !issuer) return '❌ Could not find target or issuer.';

  // Validate duration and unit
  const multiplier = unitMap[unit];
  if (!multiplier || duration <= 0) return '❌ Invalid duration or unit.';
  // Get warn stats for target user
  const warnStats = await getWarnStats(target.id, violations);
  let { currentWarnWeight, activeWarnings } = warnStats;

  // Calculate mute duration in ms capped at max timeout
  const durationMs = Math.min(duration * multiplier, MAX_TIMEOUT_MS);
  const expiresAt = new Date(Date.now() + durationMs);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  // Save mute to database once
  if (isAutomated)
    addMute(target.id, issuer.id, reason, durationMs, currentWarnWeight, channel.id);

  ({ activeWarnings } = await getWarnStats(target.id, violations));


  const { label } = getNextPunishment(activeWarnings.length + currentWarnWeight);

  const getDurationDisplay = ms => {
    if (ms >= unitMap.day) return `${Math.ceil(ms / unitMap.day)} day(s)`;
    if (ms >= unitMap.hour) return `${Math.ceil(ms / unitMap.hour)} hour(s)`;
    return `${Math.ceil(ms / unitMap.min)} minute(s)`;
  };
  const durationStr = getDurationDisplay(durationMs);
  function buildcommon(reason, currentWarnWeight, durationStr, activeWarnings = []) {
    return [
      { name: 'Reason:', value: `\`${reason}\`` },
      { name: 'Punishments:', value: `\`${currentWarnWeight} warn, ${durationStr}\`` },
      { name: 'Active Warnings:', value: `\`${activeWarnings.length}\``, inline: false },
    ]
  }
  // DM embed to user
  const dmEmbed = new EmbedBuilder()
    .setColor(0xffa500)
    .setAuthor({ name: target.user.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(guild.iconURL())
    .setDescription(`${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
    .addFields(
      ...buildcommon(reason, currentWarnWeight, durationStr, activeWarnings),
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
      ...buildcommon(reason, currentWarnWeight, durationStr, activeWarnings),
      { name: 'Next Punishment:', value: `\`${label}\``, inline: false },
    )
    .setTimestamp();

  // Attempt to DM user
  try {
    await target.send({ embeds: [dmEmbed] });
    logEmbed.setFooter({ text: 'User was DMed.' });
  } catch {
    logEmbed.setFooter({ text: 'User could not be DMed.' });
  }

  // Attempt to timeout user
  try {
    await target.timeout(durationMs, reason);
  } catch (err) {
    console.log(`Failed to mute user ${target.user.tag}:`, err.message);
    // Owners or admins might not be mutable
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
