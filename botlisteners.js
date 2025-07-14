import { EmbedBuilder } from 'discord.js';
import { logRecentCommand } from './Logging/recentcommands.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and parse forbiddenwords.json
const forbiddenWordsPath = path.join(__dirname, 'forbiddenwords.json');
const forbiddenWordsData = JSON.parse(fs.readFileSync(forbiddenWordsPath, 'utf8'));


const warnings = new Map();
const THRESHOLD = 24 * 60 * 60 * 1000; // 24h in ms
const BASE_DURATION = 15 * 60 * 1000; // 15min in ms
const MAX_DURATION = 6 * 60 * 60 * 1000; // 6h in ms
const forbiddenWords = forbiddenWordsData.forbiddenWords;
const deletedLogsId = "1393011824114270238";
const welcomeChannelId = '1392972733704572959';
const updatedMessagesChannelId = '1392990612990595233';
const nameLogChannelId = '1393076616326021181';

async function muteEscalation(message, client) {
    const target = message.author;
    const muteCommand = client.commands.get('mute');
    if (!muteCommand) {
        console.warn('⚠️ Mute command not found.');
        return;
    }

    const now = Date.now();
    const allWarnings = warnings.get(target) ?? [];
    const activeWarnings = allWarnings.filter(warn => now - warn.timestamp < THRESHOLD);

    // Calculate escalation duration with exponential backoff
    const escalationDurationMs = Math.min(
        BASE_DURATION * 2 ** (activeWarnings.length - 1),
        MAX_DURATION
    );
    const durationMinutes = Math.floor(escalationDurationMs / 60000);
    const convertedUnit = durationMinutes >= 60 ? 'hours' : 'minutes';
    const finalDuration = convertedUnit === 'hours' ? durationMinutes / 60 : durationMinutes;

    const matchedWord = forbiddenWords.find(word =>
        message.content.toLowerCase().includes(word.toLowerCase())
    );
    const reason = `AM: forbidden word "${matchedWord}"`;

    // Create a "fake" interaction object to reuse command logic
    const fakeInteraction = {
        guild: message.guild,
        member: message.member,
        user: client.user,
        channel: message.channel,
        options: {
            getUser: key => key === 'target' ? target : null,
            getString: key => key === 'reason' ? `AutoMod: Forbidden word "${matchedWord}"` : key === 'unit' ? convertedUnit : null,
            getInteger: key => key === 'duration' ? finalDuration : null,
        },
        replied: false,
        deferred: false,
        reply: async (response) => {
            if (typeof response === 'string') await message.channel.send({ content: response });
            else await message.channel.send(response);
        },
    };

    logRecentCommand(`mute: ${target.tag} - ${reason} - ${finalDuration} ${convertedUnit} - issuer: ${client.user.tag}`);
    await muteCommand.execute(fakeInteraction);
}

export async function botlisteners(client) {
    const automodCooldowns = new Map();
    const COOLDOWN_MS = 2000; // 2 seconds

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const content = message.content.toLowerCase();
        const userId = message.author.id;

        // Simple keyword replies (bypass automod)
        if (content === 'cute') return message.reply("You're Cute");
        if (content === 'adorable') return message.reply("You're Adorable");
        if (content === 'ping') return message.reply("pong!");

        // Check forbidden words
        const matched = forbiddenWords.find(word => content.includes(word.toLowerCase()));
        if (!matched) return;

        // Rate limiting per user
        const now = Date.now();
        const lastTrigger = automodCooldowns.get(userId);
        if (lastTrigger && now - lastTrigger < COOLDOWN_MS) return;
        automodCooldowns.set(userId, now);
        setTimeout(() => automodCooldowns.delete(userId), COOLDOWN_MS);

        // Attempt to delete message
        try {
            await message.delete();
        } catch (err) {
            console.warn('⚠️ Failed to delete message:', err);
        }

        // Manage warnings
        const allWarnings = warnings.get(message.author) ?? [];
        const activeWarnings = allWarnings.filter(warn => now - warn.timestamp < THRESHOLD);
        activeWarnings.push({ timestamp: now });
        warnings.set(message.author, activeWarnings);

        // Build fake interaction for warn command
        const warnCommand = client.commands.get('warn');
        const fakeInteraction = {
            guild: message.guild,
            member: message.member,
            user: message.author,
            channel: message.channel,
            options: {
                getUser: key => key === 'target' ? message.author : null,
                getString: key => key === 'reason' ? `AutoMod: Forbidden word "${matched}"` : null,
            },
            replied: false,
            deferred: false,
            reply: async (response) => {
                if (typeof response === 'string') await message.channel.send({ content: response });
                else await message.channel.send(response);
            },
            editReply: async (response) => {
                await message.channel.send(response);
                fakeInteraction.replied = true;
            },
        };

        // Escalate or warn
        if (activeWarnings.length >= 2) {
            await muteEscalation(message, client);
        } else if (warnCommand) {
            await warnCommand.execute(fakeInteraction);
        } else {
            console.warn('⚠️ Warn command not found.');
        }
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
}
