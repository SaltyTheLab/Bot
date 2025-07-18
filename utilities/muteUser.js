import { EmbedBuilder } from 'discord.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { getActiveWarns, addMute, addWarn } from '../Logging/database.js';
import { mutelogChannelid } from '../BotListeners/channelids.js';

const unitMap = { min: 60000, hour: 3600000, day: 86400000 };

export async function muteUser({
    guild,
    targetUser,
    moderatorUser,
    reason,
    duration,
    unit,
    channel,
    isAutomated = false
}) {

    const target = await guild.members.fetch(targetUser).catch(() => null);
    const issuer = await guild.members.fetch(moderatorUser).catch(() => null);
    const issuerembed = moderatorUser?.user ?? moderatorUser;
    const messagechannel = guild.channels.cache.get(channel.id);
    const logreason = reason;
    const multiplier = unitMap[unit];
    const MAX_TIMEOUT_MS = 2419200000;

    let warnings = await getActiveWarns(targetUser);
    if (isAutomated && activewarnings.length < 7) {
        addWarn(target.id, issuer.id, logreason)
        warnings = await getActiveWarns(targetUser.id);
    }

    if (!multiplier || duration <= 0) {
        return channel.send({ content: 'content: ❌ Invalid duration or unit.' });
    }

    let timeMs = duration * multiplier;
    if (isNaN(timeMs)) {
        return '❌ Failed to calculate mute duration.';
    }

    timeMs = Math.min(timeMs, MAX_TIMEOUT_MS);
    const durationMs = Math.min(duration * unitMap[unit], 2419200000);
    await addMute(target.id, issuer.id, logreason, durationMs);


    const nextPunishment = getNextPunishment(warnings.length);
    const updatedWarnings = warnings;
    const warnCount = getActiveWarns(targetUser.id);

    const durationStr = `${duration} ${unit}`;
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({ name: target.user.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(` ${target}, you have been issued a \`${durationStr} mute\` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },
            { name: "Punishments: ", value: `\`${updatedWarnings.length} warn, ${durationStr}\`` },
            { name: 'Next Punishment:', value: `\`${nextPunishment}\``, inline: false },
            { name: 'Active Warnings:', value: `\`${warnCount}\``, inline: false }
        )
        .setTimestamp();

    const logEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setThumbnail(target.displayAvatarURL())
        .setAuthor({
            name: `${issuerembed.tag} muted a member`,
            iconURL: issuerembed.displayAvatarURL({ dynamic: true })
        })
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `${channel}`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: 'Next Punishment:', value: `\`${nextPunishment}\``, inline: false },
            { name: 'Active Warnings:', value: `\`${warnCount}\``, inline: false }
        )
        .setTimestamp();

    try {
        logEmbed.setFooter({ text: 'User was DMed.' });
        await target.send({ embeds: [dmEmbed] });
    } catch {
        logEmbed.setFooter({ text: 'User could not be DMed.' });
    }

    await target.timeout(durationMs, reason).catch(err => {
        return 'User was not muted.';
    });
    const commandEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setAuthor({
            name: `${target.user.tag} was issued a ${durationStr} mute.`,
            iconURL: target.displayAvatarURL({ dynamic: true })
        });

    const logChannel = guild.channels.cache.get(mutelogChannelid);
    if (logChannel) await logChannel.send({ embeds: [logEmbed] });
    return commandEmbed;
}