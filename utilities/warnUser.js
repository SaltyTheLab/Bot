import { EmbedBuilder } from 'discord.js';
import { addWarn } from '../Logging/databasefunctions.js';
import { mutelogChannelid } from '../BotListeners/channelids.js'; // Add this if you have a warn log channel
import { THRESHOLD } from '../moderation/constants.js';
import { getWarnStats } from './simulatedwarn.js';
import { getNextPunishment } from '../moderation/punishments.js';
import { logRecentCommand } from '../Logging/recentcommands.js';

export async function warnUser({
    guild,
    targetUser,
    moderatorUser,
    reason,
    channel,
    isAutomated = true,
    violationType = 'warn'
}) {
    const target = await guild.members.fetch(targetUser.id || targetUser).catch(() => null);
    const issuer = await guild.members.fetch(moderatorUser.id || moderatorUser).catch(() => null);
    if (!target || !issuer) return '❌ Could not find the user(s) in this guild.';

    const expiresAt = new Date(Date.now() + THRESHOLD);
    const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;

    const { activeWarnings, currentWarnWeight } = await getWarnStats(target.id, violationType);
    if (!isAutomated)
        await addWarn(target.id, issuer.id, reason, currentWarnWeight, violationType);
    //update warning data
    const {futureWeightedWarns } = await getWarnStats(target.id);

    const { label } = getNextPunishment(futureWeightedWarns)



    const dmEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${target.user.tag} was issued a warning`, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(`<@${target.id}>, you were given a \`warning\` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },
            { name: 'Punishments:', value: `\`${currentWarnWeight} warn\``, inline: false },
            { name: "Next Punishment:", value: `\`${label}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${Array.isArray(activeWarnings) ? activeWarnings.length : 0}\``, inline: false },
            { name: "Warn expires on: ", value: formattedExpiry, inline: false }
        )
        .setTimestamp();

    const commandEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${target.user.tag} was issued a warning`, iconURL: target.displayAvatarURL({ dynamic: true }) });


    const logEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${issuer.user.tag} warned a member`, iconURL: issuer.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `${channel}`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: 'Punishments:', value: `\`${currentWarnWeight}\` warn`, inline: false },
            { name: "Next Punishment:", value: `\`${label}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${Array.isArray(activeWarnings) ? activeWarnings.length : 0}\``, inline: false }
        )
        .setTimestamp();

    try {
        logEmbed.setFooter({ text: 'User was DMed' });
        await target.send({ embeds: [dmEmbed] });
    } catch {
        logEmbed.setFooter({ text: 'User could not be DMed.' });
    }
    const logChannel = guild.channels.cache.get(mutelogChannelid);
    if (logChannel) await logChannel.send({ embeds: [logEmbed] });
    logRecentCommand(`warn - ${target.tag} - ${reason} - issuer: ${issuer.tag}`);

    if (isAutomated) {
        await channel.send({ embeds: [commandEmbed] });
        return;
    } else {
        return commandEmbed;
    }
}