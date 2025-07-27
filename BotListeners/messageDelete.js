import { EmbedBuilder } from "discord.js";
import { deletedLogsId } from "./Extravariables/channelids.js";
export async function messageDelete(message) {
    if (!message.guild || message.partial || !message.author || message.author.bot) return;

    const logChannel = message.guild.channels.cache.get(deletedLogsId);
    if (!logChannel) return;

    const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const hasAttachment = message.attachments.size > 0;

    let title = `Message by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    if (hasAttachment && !message.content) title = `Image by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    else if (hasAttachment && message.content) title = `Image and text by <@${message.author.id}> was deleted in <#${message.channel.id}>`;

    // Filter images only
    const imageAttachments = message.attachments.filter(att => att.contentType?.startsWith('image/')).map(att => att.url);

    const mainEmbed = new EmbedBuilder()
        .setColor(0xf03030)
        .setDescription([title, message.content || '_No content_', `[Event Link](${messageLink})`].join('\n'))
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `ID: ${message.id}` })
        .setTimestamp();

    if (imageAttachments.length > 0) mainEmbed.setImage(imageAttachments[0]);

    const additionalImageEmbeds = imageAttachments.slice(1, 9).map(url =>
        new EmbedBuilder()
            .setColor(0xf03030)
            .setDescription(title + `\n[Event Link](${messageLink})`)
            .setImage(url)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: `ID: ${message.id}` })
            .setTimestamp()
    );

    await logChannel.send({ embeds: [mainEmbed, ...additionalImageEmbeds] });
};