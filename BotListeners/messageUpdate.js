import { EmbedBuilder } from "discord.js";
import { updatedMessagesChannelId } from "./Extravariables/channelids.js";
export async function messageUpdate(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;

    const logChannel = oldMessage.guild.channels.cache.get(updatedMessagesChannelId);
    if (!logChannel) return;

    const messageLink = `https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${oldMessage.id}`;
    const embed = new EmbedBuilder()
        .setDescription(
            `<@${newMessage.author.id}> edited a message in <#${newMessage.channelId}>\n\n` +
            `**Before:**\n${oldMessage.content}\n\n` +
            `**After:**\n${newMessage.content}\n\n` +
            `[Event Link](${messageLink})`
        )
        .setColor(0x309eff)
        .setThumbnail(newMessage.author.displayAvatarURL())
        .setFooter({ text: `ID: ${newMessage.id}` })
        .setTimestamp();

    await logChannel.send({ embeds: [embed] });
}