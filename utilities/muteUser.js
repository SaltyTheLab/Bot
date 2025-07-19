import { EmbedBuilder } from 'discord.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { addMute, addWarn } from '../Logging/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/channelids.js';
import { violationWeights } from '../moderation/violationTypes.js';
import { getWarnStats } from './simulatedwarn.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };
const MAX_TIMEOUT_MS = 2419200000; // 28 days max timeout

export async function muteUser({
    guild,
    targetUser,
    moderatorUser,
    reason,
    duration,
    unit,
    channel,
    isAutomated = false,
    violationType = null,
}) {
    console.log(duration, unit);
    // Fetch members safly
    const target = await guild.members.fetch(targetUser).catch(() => null);
    const issuer = await guild.members.fetch(moderatorUser).catch(() => null);
    if (!target || !issuer) return '❌ Could not find target or issuer.';

    const multiplier = unitMap[unit];
    if (!multiplier || duration <= 0) return '❌ Invalid duration or unit.';
    let currentWarnWeight = violationWeights[violationType] || 1;
    // If automated, add a warn and refresh warnings
    if (!isAutomated) {
        await addWarn(targetUser, issuer.id, reason, currentWarnWeight, violationType);
    }

    let { activeWarnings, weightedWarns } = await getWarnStats(target.id, violationType);

    // Calculate duration in ms with violation weight scaling and cap
    const violationWeight = violationWeights[violationType] || 1;
    const durationMs = Math.min(duration * multiplier * violationWeight, MAX_TIMEOUT_MS);

    // Calculate the next punishment string
    const label = getNextPunishment(weightedWarns, { context: 'muteUser' });

    // Prepare duration display string (minutes, hours, days)
    let unitDisplay = 'minute';
    let displayAmount = Math.ceil(durationMs / 60000);

    if (durationMs >= 86400000) {
        unitDisplay = 'day';
        displayAmount = Math.ceil(durationMs / 86400000);
    } else if (durationMs >= 3600000) {
        unitDisplay = 'hour';
        displayAmount = Math.ceil(durationMs / 3600000);
    }

    const durationStr = `${displayAmount} ${unitDisplay}${displayAmount !== 1 ? 's' : ''}`;
    // DM Embed
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({ name: target.user.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(`${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },
            { name: 'Punishments:', value: `\`${weightedWarns} warn, ${durationStr}\`` },
            { name: 'Next Punishment:', value: `\`${label.asString}\``, inline: false },
            { name: 'Active Warnings:', value: `\`${activeWarnings.length}\``, inline: false }
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
            { name: 'Punishment', value: `${weightedWarns} warn, ${durationStr}` },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: 'Next Punishment:', value: `\`${label.asString}\``, inline: false },
            { name: 'Active Warnings:', value: `\`${activeWarnings.length}\``, inline: false }
        )
        .setTimestamp();

    try {
        await target.timeout(durationMs, reason);
    } catch (err) {
        console.log('you\`be muted but unfortunantly you are owner')
        return '❌ User was not muted.';
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