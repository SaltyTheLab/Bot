import { EmbedBuilder } from "discord.js";
import guildChannelMap from "../Extravariables/guildconfiguration.js";
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