import { EmbedBuilder } from 'discord.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { getActiveWarns, addMute, addWarn } from '../Logging/database.js';
import { mutelogChannelid } from '../BotListeners/channelids.js';
import { violationWeights } from '../moderation/violationTypes.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };

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
    const target = await guild.members.fetch(targetUser).catch(() => null);
    const issuer = await guild.members.fetch(moderatorUser).catch(() => null);
    const logreason = reason;
    const multiplier = unitMap[unit];
    const violationWeight = violationWeights[violationType] || 1;
    const MAX_TIMEOUT_MS = 2419200000;

    console.log(targetUser);
    let warnings = await getActiveWarns(targetUser);
    if (isAutomated) {
        await addWarn(targetUser, issuer.id, logreason)
        warnings = await getActiveWarns(targetUser);
    }

    if (!multiplier || duration <= 0) {
        return '❌ Invalid duration or unit.';
    }



    const durationMs = Math.min(duration * multiplier * violationWeight, MAX_TIMEOUT_MS);

    await addMute(targetUser, issuer.id, logreason, durationMs);


    const nextPunishment = getNextPunishment(warnings.length);

    const activeWarnings = await getActiveWarns(targetUser);
    const weightedWarns = activeWarnings.reduce((acc, warn) => {
        const weight = violationWeights[warn.type] || 1;
        return acc + weight;
    }, 0);


    const durationStr = `${Math.ceil(duration * violationWeight)} ${unit}${violationWeight > 1 ? '(scaled)' : ''}`;
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({ name: target.user.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(` ${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },
            { name: "Punishments: ", value: `\`${weightedWarns} warn, ${durationStr}\`` },
            { name: 'Next Punishment:', value: `\`${nextPunishment}\``, inline: false },
            { name: 'Active Warnings:', value: `\`${activeWarnings.length}\``, inline: false }
        )
        .setTimestamp();

    const logEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setThumbnail(target.displayAvatarURL())
        .setAuthor({
            name: `${issuer.tag} muted a member`,
            iconURL: issuer.displayAvatarURL({ dynamic: true })
        })
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `${channel}`, inline: true },
            { name: 'Punishment', value: `${weightedWarns}  warn, ${durationStr}` },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: 'Next Punishment:', value: `\`${nextPunishment}\``, inline: false },
            { name: 'Active Warnings:', value: `\`${activeWarnings.length}\``, inline: false }
        )
        .setTimestamp();

    try {
        logEmbed.setFooter({ text: 'User was DMed.' });
        await target.send({ embeds: [dmEmbed] });
    } catch {
        logEmbed.setFooter({ text: 'User could not be DMed.' });
    }
    try {
        await target.timeout(durationMs, reason);
    } catch (err) {
        return '❌ User was not muted.';
    }

    const commandEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({
            name: `${target.user.tag} was issued a ${durationStr} mute.`,
            iconURL: target.displayAvatarURL({ dynamic: true })
        })


    const logChannel = guild.channels.cache.get(mutelogChannelid);
    if (logChannel) await logChannel.send({ embeds: [logEmbed] });
    if (isAutomated) {
        await channel.send({ embeds: [commandEmbed] });
        return;
    }
    else
        return commandEmbed;
}