import { EmbedBuilder } from 'discord.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { addMute, addWarn } from '../Logging/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/channelids.js';
import { getWarnStats } from './simulatedwarn.js';
import { logRecentCommand } from '../Logging/recentcommands.js';
import { THRESHOLD } from '../moderation/constants.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const MAX_TIMEOUT_MS = 21600000; // 6 hour max timeout for automod

export async function muteUser({
    guild,
    targetUser,
    moderatorUser,
    reason,
    duration,
    unit,
    channel,
    isAutomated = true,
    violationType = 'mute'
}) {
    console.log(`[muteUser] called for userId=${targetUser}, duration=${duration} ${unit}`);
    console.log(duration, unit);
    // Fetch members safly
    const target = await guild.members.fetch(targetUser).catch(() => null);
    const issuer = await guild.members.fetch(moderatorUser).catch(() => null);
    const expiresAt = new Date(Date.now() + THRESHOLD);
    const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;
    if (!target || !issuer) return '❌ Could not find target or issuer.';

    const multiplier = unitMap[unit];
    if (!multiplier || duration <= 0) return '❌ Invalid duration or unit.';

    let warnStats = await getWarnStats(target.id, violationType);
    let { currentWarnWeight, weightedWarns, activeWarnings, futureWeightedWarns } = warnStats;

    if (!isAutomated) {
        await addMute(target.id, issuer.id, reason, currentWarnWeight, violationType);
        warnStats = await getWarnStats(target.id, violationType);
        ({ currentWarnWeight, weightedWarns, activeWarnings, futureWeightedWarns } = warnStats);
    }


    const { label } = getNextPunishment(futureWeightedWarns)
    // Calculate duration in ms with violation weight scaling and cap
    const durationMs = Math.min(duration * multiplier, MAX_TIMEOUT_MS);


    function getDurationDisplay(durationMs) {
        if (durationMs >= 86400000) {
            const days = Math.ceil(durationMs / 86400000);
            return `${days} day${days !== 1 ? 's' : ''}`;
        }

        if (durationMs >= 3600000) {
            const hours = Math.ceil(durationMs / 3600000);
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }

        const minutes = Math.ceil(durationMs / 60000);
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const durationStr = getDurationDisplay(durationMs);
    // DM Embed
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({ name: target.user.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(`${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },
            { name: 'Punishments:', value: `\`${weightedWarns} warn, ${durationStr}\`` },
            { name: "Next Punishment:", value: `\`${label}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${Array.isArray(activeWarnings) ? activeWarnings.length : 0}\``, inline: false },
            { name: "Mute expires on: ", value: formattedExpiry, inline: false }
        )
        .setTimestamp();

    // Log Embed
    const logEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setThumbnail(target.displayAvatarURL())
        .setAuthor({
            name: `${issuer.user.tag} muted a member`,
            iconURL: issuer.displayAvatarURL({ dynamic: true })
        })
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `${channel}`, inline: true },
            { name: 'Punishments:', value: `\`${weightedWarns} warn, ${durationStr}\`` },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: "Next Punishment:", value: `\`${label}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${Array.isArray(activeWarnings) ? activeWarnings.length : 0}\``, inline: false }
        )
        .setTimestamp();

    try {
        await target.timeout(durationMs, reason);
    } catch (err) {
        console.log('you\`be muted but unfortunantly you are owner')
        // return '❌ User was not muted.';
    }

    try {
        logEmbed.setFooter({ text: 'User was DMed.' });
        await target.send({ embeds: [dmEmbed] });
    } catch {
        logEmbed.setFooter({ text: 'User could not be DMed.' });
    }

    await addMute(targetUser, issuer.id, reason, durationMs, currentWarnWeight, violationType);

    // Command confirmation embed
    const commandEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({
            name: `${target.user.tag} was issued a ${durationStr} mute.`,
            iconURL: target.displayAvatarURL({ dynamic: true })
        });

    // Send to mute log channel
    const logChannel = guild.channels.cache.get(mutelogChannelid);
    if (logChannel) await logChannel.send({ embeds: [logEmbed] });
    logRecentCommand(`warn - ${target.tag} - ${reason} - issuer: ${issuer.tag}`);

    // Send confirmation if automated
    if (isAutomated) {
        await channel.send({ embeds: [commandEmbed] });
        return;
    } else {
        return commandEmbed;
    }
}