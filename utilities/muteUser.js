import { EmbedBuilder } from 'discord.js';
import getNextPunishment from '../moderation/punishments.js';
import { mutelogChannelid } from '../BotListeners/Extravariables/channelids.js';
import getWarnStats from '../moderation/simulatedwarn.js';
import { addMute } from '../Database/databaseFunctions.js';
import logRecentCommand from '../Logging/recentCommands.js';


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
    targetUserId,
    moderatorUser,
    reason,
    channelid,
    isAutomated = true,
    duration,
    unit,
    currentWarnWeight = 1
}) {

    // get member, interaction user, and channel objects
    const [target, issuer, commandChannel] = await Promise.all([
        guild.members.fetch(targetUserId).catch(err => {
            console.error(`[muteUser] Failed to fetch targetUser (${targetUserId}):`, err);
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

    //checks for vaild channel, user, and interaction user
    if (!target) {
        console.error(`[muteUser] Target user not found: ${targetUserId}`);
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
    addMute(target.id, issuer.id, reason, effectiveDurationMs, currentWarnWeight, commandChannel.id);

    const { activeWarnings } = await getWarnStats(targetUserId);

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
        .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(`${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
        .addFields(
            ...buildBasicFields(reason, currentWarnWeight, durationStr, activeWarnings.length + currentWarnWeight),
            { name: 'Warn expires:', value: `<t:${Math.floor(Date.now() / 1000) + unitMap.day / 1000}:F>`, inline: false },
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
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `${commandChannel}`, inline: true },
            ...buildBasicFields(reason, currentWarnWeight, durationStr, activeWarnings.length + currentWarnWeight),
            { name: 'Warn expires:', value: `<t:${Math.floor(Date.now() / 1000) + unitMap.day / 1000}:F>`, inline: false },
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
        logRecentCommand(`Mute: Target: ${target.user.tag} | Moderator: ${issuer.user.tag} | Reason: ${reason} | Duration : ${durationStr}`);
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
