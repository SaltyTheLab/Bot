import { EmbedBuilder } from "discord.js";
import guildChannelMap from "../Extravariables/guildconfiguration.js";
export async function messageUpdate(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logChannel = await oldMessage.guild.channels.fetch(guildChannelMap[oldMessage.guild.id].modChannels.updatedlogChannel);
    if (!logChannel) return;
    const messageLink = `https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${oldMessage.id}`;
    const embed = new EmbedBuilder({
        description: `<@${newMessage.author.id}> edited a message in <#${newMessage.channelId}>\n\n` +
            `**Before:**\n${oldMessage.content}\n\n` +
            `**After:**\n${newMessage.content}\n\n` +
            `[Event Link](${messageLink})`,
        color: 0x309eff,
        thumbnail: { url: newMessage.author.displayAvatarURL() },
        footer: { text: `ID: ${newMessage.id}` },
        timestamp: Date.now()
    })
    logChannel.send({ embeds: [embed] });
}