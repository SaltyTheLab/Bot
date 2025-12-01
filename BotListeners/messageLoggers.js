import { EmbedBuilder } from "discord.js";
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
export async function messageUpdate(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logChannel = oldMessage.guild.channels.cache.get(guildChannelMap[oldMessage.guild.id].modChannels.updatedlogChannel);
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
export async function messageDelete(message) {
    if (!message.guild || message.partial || !message.author || message.author.bot) return;
    const logChannel = message.guild.channels.cache.get(guildChannelMap[message.guild.id].modChannels.deletedlogChannel);
    if (!logChannel) return;
    const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const hasAttachment = message.attachments.size > 0;
    let title = `Message by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    if (hasAttachment && !message.content) title = `Image by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    else if (hasAttachment && message.content) title = `Image and text by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    const imageAttachments = message.attachments.filter(att => att.contentType?.startsWith('image/')).map(att => att.url);
    const mainEmbed = new EmbedBuilder({
        color: 0xf03030,
        description: [title, message.content || '_No content_\n', `[Event Link](${messageLink})`].join('\n'),
        thumbnail: { url: message.author.displayAvatarURL() },
        footer: { text: `ID: ${message.id}` },
        timestamp: Date.now()
    })
    hasAttachment ? mainEmbed.setImage(imageAttachments[0]) : null
    const additionalImageEmbeds = imageAttachments.slice(1, 9).map(url =>
        new EmbedBuilder({
            color: 0xf03030,
            description: title + `\n[Event Link](${messageLink})`,
            image: url,
            thumbnail: { url: message.author.displayAvatarURL() },
            footer: { text: `ID: ${message.id}` },
            timestamp: Date.now()
        }))
    logChannel.send({ embeds: imageAttachments.length > 1 ? [mainEmbed, ...additionalImageEmbeds] : [mainEmbed] });
};