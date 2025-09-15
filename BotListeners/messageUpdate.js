import { EmbedBuilder } from "discord.js";
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
export async function messageUpdate(oldMessage, newMessage) {
    const guildId = oldMessage.guild.id;

    const modChannels = guildChannelMap[guildId].modChannels
    /**
     * return early if no message change detected, is created by bot, or
     * isn't in the server
    **/
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;

    //get log channel
    const logChannel = await oldMessage.guild.channels.fetch(modChannels.updatedlogChannel);
    if (!logChannel) return;
    //created masked link of the message link
    const messageLink = `https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${oldMessage.id}`;

    //created the embed
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

    // send the embed
    await logChannel.send({ embeds: [embed] });
}