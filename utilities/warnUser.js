import { EmbedBuilder } from 'discord.js';
import { addWarn } from '../Database/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/channelids.js'; // Log channel for warnings
import { THRESHOLD } from '../moderation/constants.js';
import { getWarnStats } from '../moderation/simulatedwarn.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

export async function warnUser({
  guild,
  targetUser,
  moderatorUser,
  reason,
  channel,
  isAutomated = true,
  violations = [],
  violationType = 'Warn'
}) {
  // Fetch members safely, accept either ID or User object
  const target = await guild.members.fetch(targetUser.id || targetUser).catch(() => null);
  const issuer = await guild.members.fetch(moderatorUser.id || moderatorUser).catch(() => null);
  if (!target || !issuer) return '❌ Could not find the user(s) in this guild.';

  // Calculate warn expiry time (for display)
  const expiresAt = new Date(Date.now() + THRESHOLD);
  const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

  // Get current warn weight considering new violations
  const { currentWarnWeight } = await getWarnStats(target.id, violations);

  // Add the new warning to the DB
   addWarn(target.id, issuer.id, reason, currentWarnWeight, violationType);

  // Fetch updated active warnings for the user
  const { activeWarnings } = await getWarnStats(target.id);

  // Get label for the next punishment stage
  const { label } = getNextPunishment(activeWarnings.length);

  // Build DM embed to notify the user
  const dmEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${target.user.tag} was issued a warning`,
      iconURL: target.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(guild.iconURL())
    .setDescription(`<@${target.id}>, you were given a \`warning\` in Salty's Cave.`)
    .addFields(
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      { name: 'Punishments:', value: `\`${currentWarnWeight} warn\``, inline: false },
      { name: 'Next Punishment:', value: `\`${label}\``, inline: false },
      { name: 'Active Warnings:', value: `\`${Array.isArray(activeWarnings) ? activeWarnings.length : 0}\``, inline: false },
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
    .addFields(
      { name: 'Target:', value: `${target}`, inline: true },
      { name: 'Channel:', value: `${channel}`, inline: true },
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      { name: 'Punishments:', value: `\`${currentWarnWeight} warn\``, inline: false },
      { name: 'Next Punishment:', value: `\`${label}\``, inline: false },
      { name: 'Active Warnings:', value: `\`${Array.isArray(activeWarnings) ? activeWarnings.length : 0}\``, inline: false },
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
