import { EmbedBuilder } from "discord.js";
import { guildModChannelMap } from "./Extravariables/channelids.js";
export async function messageDelete(message) {
    const guildId = message.guild.id;
    const guildChannels = guildModChannelMap[guildId]
    /**
     * check for partial message triggers, message not in guild, message
     * not made by an author or the mssage was created by a bot
     */
    if (!message.guild || message.partial || !message.author || message.author.bot) return;

    //get the deletedlogs channel
    const logChannel = message.guild.channels.cache.get(guildChannels.deletedlogChannel);
    if (!logChannel) return;

    //create the masked link that leads to the message deletion  
    const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const hasAttachment = message.attachments.size > 0;

    // set the title of the embed depending on if it had an attachment,
    // text and attachment or just text
    let title = `Message by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    if (hasAttachment && !message.content) title = `Image by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    else if (hasAttachment && message.content) title = `Image and text by <@${message.author.id}> was deleted in <#${message.channel.id}>`;

    // Filter images only
    const imageAttachments = message.attachments.filter(att => att.contentType?.startsWith('image/')).map(att => att.url);

    //build the embed
    const mainEmbed = new EmbedBuilder()
        .setColor(0xf03030)
        .setDescription([title, message.content || '_No content_', `[Event Link](${messageLink})`].join('\n'))
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `ID: ${message.id}` })
        .setTimestamp();

    //count how many attachments are in the message
    if (imageAttachments.length > 0) mainEmbed.setImage(imageAttachments[0]);

    //generate embeds for logging channel with the additional attachments
    const additionalImageEmbeds = imageAttachments.slice(1, 9).map(url =>
        new EmbedBuilder()
            .setColor(0xf03030)
            .setDescription(title + `\n[Event Link](${messageLink})`)
            .setImage(url)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: `ID: ${message.id}` })
            .setTimestamp()
    );
    
    //send embeds
    await logChannel.send({ embeds: [mainEmbed, ...additionalImageEmbeds] });
};