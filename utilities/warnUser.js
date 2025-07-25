import { EmbedBuilder } from 'discord.js';
import { addWarn } from '../Database/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/channelids.js'; // Log channel for warnings
import { getWarnStats } from '../moderation/simulatedwarn.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

const THRESHOLD = 24 * 60 * 60 * 1000; // 24h

export async function warnUser({
  guild,
  targetUser,
  moderatorUser,
  reason,
  channelid,
  isAutomated = true,
  violations = []
}) {
  // Fetch members safely, accept either ID or User object
  const [target, issuer, channel] = await Promise.all([
    guild.members.fetch(targetUser.id || targetUser).catch(() => null),
    guild.members.fetch(moderatorUser.id || moderatorUser).catch(() => null),
    guild.channels.fetch(channelid)
  ]);

  if (!target || !issuer) return '❌ Could not find the user(s) in this guild.';

  // Calculate warn expiry time (for display)
  const expiresAt = new Date(Date.now() + THRESHOLD);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  // Get current warn weight considering new violations
  const { currentWarnWeight } = await getWarnStats(target.id, violations);

  // Add the new warning to the DB
  addWarn(target.id, issuer.id, reason, currentWarnWeight, channelid);

  // Fetch updated active warnings for the user
  const { activeWarnings } = await getWarnStats(target.id);

  // Get label for the next punishment stage
  const { label } = getNextPunishment(activeWarnings.length);

  function buildcommon(reason, currentWarnWeight, label, activeWarnings = []) {
    return [
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      { name: 'Punishments:', value: `\`${currentWarnWeight} warn\``, inline: false },
      { name: 'Next Punishment:', value: `\`${label}\``, inline: false },
      { name: 'Active Warnings:', value: `\`${Array.isArray(activeWarnings) ? activeWarnings.length : 0}\``, inline: false },
    ]
  }
  // Build DM embed to notify the user
  const dmEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${target.user.tag} was issued a warning`,
      iconURL: target.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(guild.iconURL())
    .setDescription(`<@${target.id}>, you were given a \`warning\` in Salty's Cave.`)
    .setFields(
      ...buildcommon(reason, currentWarnWeight, label, activeWarnings),
      { name: 'Warn expires on:', value: formattedExpiry, inline: false },
    )
    .setTimestamp();

  // Embed for confirmation in the channel or return
  const commandEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${target.user.tag} was issued a warning`,
      iconURL: target.displayAvatarURL({ dynamic: true }),
    });

  // Embed for moderation log channel
  const logEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${issuer.user.tag} warned a member`,
      iconURL: issuer.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(target.displayAvatarURL())
    .setFields(
      { name: 'Target:', value: `${target}`, inline: true },
      { name: 'Channel:', value: `<#${channelid}>`, inline: true },
      ...buildcommon(reason, currentWarnWeight, label, activeWarnings)
    )
    .setTimestamp();

  // Try DMing the user about their warning
  try {
    await target.send({ embeds: [dmEmbed] });
    logEmbed.setFooter({ text: 'User was DMed.' });
  } catch {
    logEmbed.setFooter({ text: 'User could not be DMed.' });
  }

  // Send log embed to the warning log channel, if it exists
  const logChannel = guild.channels.cache.get(mutelogChannelid);
  if (logChannel) await logChannel.send({ embeds: [logEmbed] });

  // Log this command usage for audit
  logRecentCommand(`warn - ${target.user.tag} - ${reason} - issuer: ${issuer.user.tag}`);

  // Send confirmation embed if automated, else return the embed for manual use
  if (isAutomated) {
    await channel.send({ embeds: [commandEmbed] });
  } else {
    return commandEmbed;
  }
}
