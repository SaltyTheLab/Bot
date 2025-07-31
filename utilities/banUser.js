import { EmbedBuilder } from 'discord.js';
import { banlogChannelid } from '../BotListeners/Extravariables/channelids.js'; // Your mod-log channel ID
import { addBan } from '../Database/databasefunctions.js';


export async function banUser({
    guild,
    targetUserId,
    moderatorUser,
    reason,
    channel,
    isAutomated = false
}) {
    const [target] = await guild.members.fetch(targetUserId).catch(() => null);
    if (!target) return '❌ User not found in the server.';


    // DM Embed (optional)
    const dmEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${target.tag}`)
        .setThumbnail(guild.iconURL())
        .setDescription(
            `<@${target.id}>, you have been **banned** from **Salty's Cave**.\n\n` +
            `Please [click here](https://dyno.gg/form/9dd2f880) to appeal your ban.`
        )
        .addFields({ name: 'Reason:', value: `\`${reason}\`` })
        .setFooter({ text: guild.name })
        .setTimestamp();


    const logEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: `${moderatorUser.tag} banned a member`, iconURL: moderatorUser.displayAvatarURL() })
        .setThumbnail(target.displayAvatarURL(({ dynamic: true })))
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `<#${channel.id}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false }
        )
        .setTimestamp();
    try {
        logEmbed.setFooter({ text: 'User was dmed.' })
        await target.send({ embeds: [dmEmbed] });
    } catch {
        logEmbed.setFooter({ text: 'User was not dmed.' })
    }

    // Try to ban the user
    try {
        await target.ban({ deleteMessageSeconds: 604800 });
    } catch (err) {
        return `❌ Failed to ban user: ${err.message ?? err}`;
    }
    addBan(target.id, moderatorUser, reason, channel)
    const logChannel = guild.channels.cache.get(banlogChannelid);
    if (logChannel) await logChannel.send({ embeds: [logEmbed] });
    const commandEmbed = new EmbedBuilder()
        .setAuthor({
            name: `${target.tag} was banned`, iconURL: `${target.displayAvatarURL({ dynamic: true })}`
        }
        )
    if (isAutomated && channel) {
        await channel.send({ embeds: [commandEmbed] });
        return;
    }
    return commandEmbed;
}