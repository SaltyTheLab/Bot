import { EmbedBuilder } from 'discord.js';
import { addWarn, getWarns } from '../Logging/database.js';
import { mutelogChannelid } from '../BotListeners/channelids.js'; // Add this if you have a warn log channel
import { THRESHOLD } from '../moderation/constants.js';
import { getNextPunishment } from '../moderation/punishments.js';

export async function warnUser({
    guild,
    targetUser,
    moderatorUser,
    reason,
    channel,
    activeWarnings = []
}) {

    const target = await guild.members.fetch(targetUser).catch(() => null);
    const issuer = await guild.members.fetch(moderatorUser).catch(() => null);
    const expiresAt = new Date(Date.now() + THRESHOLD);
    const formattedExpiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`;
    let updatedWarnings = await getWarns(targetUser.id);



    // Log to database
    if (updatedWarnings.length < 7)
        await addWarn(target.id, issuer.id, reason);
    updatedWarnings = await getWarns(targetUser.id);
    const nextpunishment = getNextPunishment(updatedWarnings.length)
    // Embed sent to the warned user via DM
    const dmEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${targetUser.tag} was issued a warning`, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(guild.iconURL())
        .setDescription(`<@${targetUser.id}>, you were given a \`warning\` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\`` },

            { name: "Next Punishment:", value: `\`${nextpunishment}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${updatedWarnings.length}\``, inline: false },
            { name: "Warn expires on: ", value: formattedExpiry, inline: false }
        )
        .setTimestamp();


    const logEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setAuthor({ name: `${targetUser.tag} warned a member`, iconURL: target.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Target:', value: `${targetUser}`, inline: true },
            { name: 'Channel:', value: `<#${channel}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            { name: "Next Punishment:", value: `\`${nextpunishment}\``, inline: false },
            { name: "Active Warnings: ", value: `\`${updatedWarnings.length}\``, inline: false }
        )
        .setTimestamp();
    try {
        logEmbed.setFooter({ text: 'User was Dmed' })
        await target.send({ embeds: [dmEmbed] });
    } catch {
        logEmbed.setFooter({ text: 'User could not be DMed.' });
    }

    const logChannel = guild.channels.cache.get(mutelogChannelid); // Optional
    if (logChannel) await logChannel.send({ embeds: [logEmbed] });
}