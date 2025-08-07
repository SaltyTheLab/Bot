import { EmbedBuilder } from 'discord.js';
import { banlogChannelid } from '../BotListeners/Extravariables/channelids.js'; // Your mod-log channel ID
import { addBan } from '../Database/databasefunctions.js';



export default async function banUser({
    guild,
    targetUser,
    moderatorUser,
    reason,
    channel,
    isAutomated = false
}) {

    // DM Embed (optional)
    const dmEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${targetUser.tag}`)
        .setThumbnail(guild.iconURL())
        .setDescription(
            `<@${targetUser.id}>, you have been **banned** from **Salty's Cave**.\n\n` +
            `Please [click here](https://dyno.gg/form/9dd2f880) to appeal your ban.`
        )
        .addFields({ name: 'Reason:', value: `\`${reason}\`` })
        .setFooter({ text: guild.name })
        .setTimestamp();


    const logEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: `${moderatorUser.tag} banned a member`, iconURL: moderatorUser.displayAvatarURL() })
        .setThumbnail(targetUser.displayAvatarURL(({ dynamic: true })))
        .addFields(
            { name: 'Target:', value: `${targetUser}`, inline: true },
            { name: 'Channel:', value: `<#${channel.id}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false }
        )
        .setTimestamp();
    try {
        logEmbed.setFooter({ text: 'User was dmed.' })
        await targetUser.send({ embeds: [dmEmbed] });
    } catch {
        logEmbed.setFooter({ text: 'User was not dmed.' })
    }

    // Try to ban the user
    try {
        await targetUser.ban({ reason: `ban command: ${reason}`, deleteMessageSeconds: 604800 });
    } catch (err) {
        return `❌ Failed to ban user: ${err.message ?? err}`;
    }
    addBan(targetUser.id, moderatorUser.id, reason, channel)
    const logChannel = guild.channels.cache.get(banlogChannelid);
    if (logChannel) await logChannel.send({ embeds: [logEmbed] });
    const commandEmbed = new EmbedBuilder()
        .setAuthor({
            name: `${targetUser.tag} was banned`, iconURL: `${targetUser.displayAvatarURL({ dynamic: true })}`
        }
        )
    if (isAutomated && channel) {
        await channel.send({ embeds: [commandEmbed] });
        return;
    }
    return commandEmbed;
}