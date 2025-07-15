import { EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateTracker } from './moderation/trackers.js';
import { handleAutoMod } from './moderation/autoMod.js';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const forbiddenWords = JSON.parse(fs.readFileSync(path.join(__dirname, './moderation/forbiddenwords.json'), 'utf8')).forbiddenWords;

const warnings = new Map();
const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9-]+/i;

//log channel ids
const deletedLogsId = "1393011824114270238";
const welcomeChannelId = '1392972733704572959';
const updatedMessagesChannelId = '1392990612990595233';
const nameLogChannelId = '1393076616326021181';

export async function botlisteners(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const content = message.content.toLowerCase();

        // Check if message contains media attachments or embeds with media URLs
        const hasMedia = message.attachments.size > 0 || message.embeds.some(embed => {
            // Check image, video, or thumbnail URLs explicitly
            const mediaUrls = [
                embed.image?.url,
                embed.video?.url,
                embed.thumbnail?.url,
            ].filter(Boolean); // filter out undefined

            // Return true if any media URL matches supported media
            // extensions

            return mediaUrls.some(url => /\.(gif|mp4|webm|png|jpe?g)$/i.test(url));

        });

        // Update user tracker and determine if this message violates media limits
        const isMediaViolation = updateTracker(userId, hasMedia, message);

        // Quick respond for simple keyword commands
        const keywords = {
            cute: "You're Cute",
            adorable: "You're Adorable",
            ping: "pong!"
        };
        if (keywords[content]) {
            return message.reply(keywords[content]);
        }

        // Check forbidden words and invite links
        const matchedWord = forbiddenWords.find(word => content.includes(word.toLowerCase()));
        const hasInvite = inviteRegex.test(content);

        // If no violations at all, do nothing
        if (!matchedWord && !hasInvite && !isMediaViolation) return;


        // Determine reason for moderation action
        let reasonText = '';
        if (hasInvite) {
            reasonText = 'AutoMod: Discord invite detected';
        } else if (matchedWord) {
            reasonText = `AutoMod: Forbidden word "${matchedWord}"`;
        } else if (isMediaViolation) {
            reasonText = 'AutoMod: Posting too much media (1 per 20 messages allowed)';
        }

        // Handle further moderation actions
        await handleAutoMod(message, client, reasonText, warnings, forbiddenWords);
    });

    client.on('guildMemberAdd', async (member) => {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        if (!welcomeChannel) {
            console.warn('⚠️ Welcome channel not found.');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF99)
            .setDescription(`Welcome ${member} to the server!`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields({ name: 'Discord Join Date:', value: `\`${member.joinedAt.toISOString()}\``, inline: true });

        await welcomeChannel.send({ embeds: [embed] });
    });

    client.on('guildMemberRemove', async (member) => {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        if (!welcomeChannel) {
            console.warn('⚠️ Welcome channel not found.');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xa90000)
            .setDescription(`${member} has left the cave.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields({ name: 'Joined the cave on:', value: member.joinedAt ? member.joinedAt.toISOString() : 'Unknown', inline: true });

        await welcomeChannel.send({ embeds: [embed] });
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
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
    });

    client.on('messageDelete', async (message) => {
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
    });

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (oldMember.nickname === newMember.nickname) return;

        const logChannel = newMember.guild.channels.cache.get(nameLogChannelId);
        if (!logChannel) {
            console.warn('⚠️ Name log channel not found.');
            return;
        }

        const oldNick = oldMember.nickname ?? oldMember.user.username;
        const newNick = newMember.nickname ?? newMember.user.username;

        const embed = new EmbedBuilder()
            .setThumbnail(newMember.user.displayAvatarURL())
            .setDescription(
                `<@${newMember.id}> **changed their nickname**\n\n` +
                `**Before:**\n${oldNick}\n\n` +
                `**After:**\n${newNick}`
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    });
};