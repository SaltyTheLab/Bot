import { EmbedBuilder } from 'discord.js';
import { mutelogChannelid } from '../BotListeners/Extravariables/channelids.js';
import  getWarnStats  from '../moderation/simulatedwarn.js';
import  getNextPunishment  from '../moderation/punishments.js';
import { addWarn } from '../Database/databaseFunctions.js';
import logRecentCommand from '../Logging/recentCommands.js';


const THRESHOLD = 24 * 60 * 60 * 1000; // 24h

export default async function warnUser({
  guild,
  targetUserId,
  moderatorUser,
  reason,
  channelid,
  isAutomated = true,
  currentWarnWeight = 1
}) {
  // --- 1. Fetching Members and Channels ---
  // Use Promise.all to fetch target, issuer, and channel concurrently.
  // Directly fetch by ID if targetUser/moderatorUser are objects, access their ID.
  const [targetMember, moderatorMember, currentChannel] = await Promise.all([
    guild.members.fetch(targetUserId).catch(() => null),
    guild.members.fetch(moderatorUser.id || moderatorUser).catch(() => null),
    guild.channels.fetch(channelid).catch(() => null) // Add catch for channel fetch too
  ]);

  // Check if target or moderator were found
  if (!targetMember || !moderatorMember) {
    console.error(`[WarnUser] Target (${ targetUserId}) or Moderator (${moderatorUser.id || moderatorUser}) not found in guild ${guild.id}.`);
    // Consider returning a more descriptive error or throwing if this is a critical failure.
    // For now, adhering to existing return type:
    return '❌ Could not find the user(s) in this guild.';
  }

  // --- 2. Database Operations (getUser, getWarnStats, addWarn) ---
 

  // Add the new warning to the DB.
  addWarn(targetMember.id, moderatorMember.id, reason, currentWarnWeight, channelid);

  // Fetch updated active warnings for the user after the new warn has been added.
  const { activeWarnings } = await getWarnStats(targetMember.id);

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
      name: `${targetMember.user.tag} was issued a warning`,
      iconURL: targetMember.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(guild.iconURL())
    .setDescription(`<@${targetMember.id}>, you were given a \`warning\` in Salty's Cave.`)
    .addFields( // Use addFields consistently
      ...commonFields(reason, currentWarnWeight, label, activeWarnings.length),
      { name: 'Warn expires on:', value: formattedExpiry, inline: false },
    )
    .setTimestamp();

  // Embed for confirmation in the channel or return
  const commandEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${targetMember.user.tag} was issued a warning`,
      iconURL: targetMember.displayAvatarURL({ dynamic: true }),
    });

  // Embed for moderation log channel
  const logEmbed = new EmbedBuilder()
    .setColor(0xffff00)
    .setAuthor({
      name: `${moderatorMember.user.tag} warned a member`,
      iconURL: moderatorMember.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(targetMember.displayAvatarURL({ dynamic: true })) // Use dynamic for animated avatars
    .addFields( // Use addFields consistently
      { name: 'Target:', value: `${targetMember}`, inline: true },
      { name: 'Channel:', value: `<#${channelid}>`, inline: true },
      ...commonFields(reason, currentWarnWeight, label, activeWarnings.length)
    )
    .setTimestamp();

  // --- 5. DMing User & Logging ---
  try {
    await targetMember.send({ embeds: [dmEmbed] });
    logEmbed.setFooter({ text: 'User was DMed.' });
  } catch (dmError) {
    console.warn(`[WarnUser] Could not DM user ${targetMember.user.tag}: ${dmError.message}`);
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
  logRecentCommand(`warn - ${targetMember.user.tag} - ${reason} - issuer: ${moderatorMember.user.tag}`);

  // Send confirmation embed if automated, else return the embed for manual use
  if (isAutomated) {
    if (currentChannel) { // Only send if the channel was successfully fetched
      try {
        await currentChannel.send({ embeds: [commandEmbed] });
      } catch (sendError) {
        console.error(`[WarnUser] Failed to send command confirmation to channel ${channelid}: ${sendError.message}`);
      }
    } else {
      console.warn(`[WarnUser] Original command channel with ID ${channelid} not found, cannot send confirmation.`);
    }
  } else {
    return commandEmbed;
  }
}