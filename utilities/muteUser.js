import { EmbedBuilder } from 'discord.js';
import getNextPunishment from '../moderation/punishments.js';
import { mutelogChannelid } from '../BotListeners/Extravariables/channelids.js';
import getWarnStats from '../moderation/simulatedwarn.js';
import { addMute } from '../Database/databasefunctions.js';
import logRecentCommand from '../Logging/recentcommands.js';


const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const MAX_TIMEOUT_MS = 21600000; // 6 hours max timeout for automated timeouts

// Helper function for display string of duration
const getDurationDisplay = ms => {
    if (ms >= unitMap.day) return `${Math.ceil(ms / unitMap.day)} day(s)`;
    if (ms >= unitMap.hour) return `${Math.ceil(ms / unitMap.hour)} hour(s)`;
    return `${Math.ceil(ms / unitMap.min)} minute(s)`;
};

export default async function muteUser({
    guild,
    targetUser,
    moderatorUser,
    reason,
    channel,
    isAutomated = true,
    currentWarnWeight = 1,
    duration,
    unit
}) {

    // Prepare the unit in ms
    const multiplier = unitMap[unit];
    if (!multiplier || duration <= 0) {
        return '❌ Invalid duration or unit specified for mute.';
    }

    // Calculate the effective duration and apply a hard cap of six hours
    const calculatedDurationMs = duration * multiplier * (isAutomated ? currentWarnWeight : 1);
    const effectiveDurationMs = Math.min(calculatedDurationMs, MAX_TIMEOUT_MS);
    const durationStr = getDurationDisplay(effectiveDurationMs);

    // Add the mute to the database
    addMute(targetUser.id, moderatorUser.id, reason, effectiveDurationMs, currentWarnWeight, channel.id);

    const { activeWarnings } = await getWarnStats(targetUser.id);

    // Get the label for the next punishment
    const { label: nextPunishmentLabel } = getNextPunishment(activeWarnings.length + currentWarnWeight);

    // --- Helper for Common Embed Fields ---
    const buildBasicFields = (reason, currentWarnWeight, durationStr, activeWarnsCount) => {
        return [
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: 'Punishments:', value: `\`${currentWarnWeight} warn, ${durationStr}\``, inline: false },
            { name: 'Active Warnings:', value: `\`${activeWarnsCount}\``, inline: true }
        ];
    };

    // --- DM Embed to User ---
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({ name: targetUser.user.tag, iconURL: targetUser.user.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(`${targetUser}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
        .addFields(
            ...buildBasicFields(reason, currentWarnWeight, durationStr, activeWarnings.length + currentWarnWeight),
            { name: 'Warn expires:', value: `<t:${Math.floor(Date.now() / 1000) + unitMap.day / 1000}:F>`, inline: false },
        )
        .setTimestamp();

    // --- Log Embed for Mod Log ---
    const logEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({
            name: `${moderatorUser.tag} muted a member`,
            iconURL: moderatorUser.displayAvatarURL({ dynamic: true }),
        })
        .addFields(
            { name: 'Target:', value: `${targetUser.user}`, inline: true },
            { name: 'Channel:', value: `${channel.id}`, inline: true },
            ...buildBasicFields(reason, currentWarnWeight, durationStr, activeWarnings.length + currentWarnWeight),
            { name: 'Warn expires:', value: `<t:${Math.floor(Date.now() / 1000) + unitMap.day / 1000}:F>`, inline: false },
            { name: 'Next Punishment:', value: `\`${nextPunishmentLabel}\``, inline: false },
        )
        .setTimestamp();

    // --- Attempt to DM user ---
    try {
        await targetUser.user.send({ embeds: [dmEmbed] });
        logEmbed.setFooter({ text: 'User was Dmed.' });
    } catch (dmErr) {
        console.error(`[muteUser] Failed to DM user ${targetUser.user.tag}:`, dmErr.message);
        logEmbed.setFooter({ text: 'User could not be DMed.' });
    }

    // --- Attempt to Timeout User ---
    try {
        await targetUser.timeout(effectiveDurationMs, reason);
        logRecentCommand(`Mute: Target: ${targetUser.user.user.tag} | Moderator: ${moderatorUser.tag} | Reason: ${reason} | Duration : ${durationStr}`);
    } catch (err) {
        console.error(`[muteUser] Failed to timeout user ${targetUser.user.tag}:`, err.message);
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

    // --- Command Confirmation Embed for Channel ---
    const commandEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({
            name: `${targetUser.user.tag} was issued a ${durationStr} mute.`,
            iconURL: targetUser.user.displayAvatarURL({ dynamic: true }),
        });

    if (isAutomated) {
        await channel.send({ embeds: [commandEmbed] });
        return;
    } else
        return commandEmbed;
}
