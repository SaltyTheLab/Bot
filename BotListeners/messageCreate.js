import { updateTracker } from '../moderation/trackers.js';
import { handleAutoMod } from '../moderation/autoMod.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmbedBuilder } from '@discordjs/builders';
import { saveUserAsync, getUserAsync, updateUser } from '../Logging/database.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const forbiddenWords = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../moderation/forbiddenwords.json'), 'utf8')
).forbiddenWords;

//spam setup
const SPAM_WINDOW = 15 * 1000;
const SPAM_THRESHOLD = 4;
const messageHistory = new Map();

const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9-]+/i;

export async function onMessageCreate(client, message) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // Get user data from database
    const user = await getUserAsync(userId, guildId);

    // XP Logic
    const xpGain = 20;
    user.xp += xpGain;

    const xpNeeded = Math.floor((user.level - 1) ** 2 * 50);
    if (user.xp >= xpNeeded) {
        user.level++;
        user.xp = 0;

        const lvlembed = new EmbedBuilder()
            .setAuthor({
                name: `${message.author.tag} leveled up to ${user.level}!`,
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setColor(0x00AE86)
            .setFooter({
                text: 'keep on yapping!'
            })

        await message.channel.send({ embeds: [lvlembed] });
    }
    if (user.level === 3) {
        const verifiedRole = message.guild.roles.cache.find(
            role => role.name.toLowerCase() === 'verified'
        );

        if (verifiedRole) {
            const member = await message.guild.members.fetch(message.author.id);
            if (!member.roles.cache.has(verifiedRole.id)) {
                await member.roles.add(verifiedRole);

                // Update database
                await updateUser(userId, guildId, user.xp, user.level);
            }
        }
    }
    await saveUserAsync(user);


    const now = Date.now();

    // Spam detection
    const userHistory = messageHistory.get(userId) ?? [];
    const updatedHistory = userHistory.filter(m => now - m.timestamp < SPAM_WINDOW);
    updatedHistory.push({ content, timestamp: now });
    messageHistory.set(userId, updatedHistory);

    const matchingMessages = updatedHistory.filter(m => m.content === content);
    if (matchingMessages.length >= SPAM_THRESHOLD) {
        messageHistory.set(userId, []);
    }
    //media detection
    const hasMedia = message.attachments.size > 0 || message.embeds.some(embed => {
        const mediaUrls = [embed.image?.url, embed.video?.url, embed.thumbnail?.url].filter(Boolean);
        return mediaUrls.some(url => /\.(gif|mp4|webm|png|jpe?g)$/i.test(url));
    });

    const isMediaViolation = updateTracker(userId, hasMedia, message);
    //fun responders :3
    const keywords = {
        cute: "You're Cute",
        adorable: "You're Adorable",
        ping: "pong!"
    };
    if (keywords[content]) {
        return message.reply(keywords[content]);
    }
    //bad word and link check
    const matchedWord = forbiddenWords.find(word => content.includes(word.toLowerCase()));
    const hasInvite = inviteRegex.test(content);
    const everyoneping = message.mentions.everyone;

    if (!matchedWord && !hasInvite && !isMediaViolation && matchingMessages.length < SPAM_THRESHOLD || everyoneping) return;

    //update embed warn reason accordingly
    let reasonText = '';
    if (hasInvite) {
        reasonText = 'AutoMod: Discord invite detected';
    } else if (matchedWord) {
        reasonText = `AutoMod: Forbidden word "${matchedWord}"`;
    } else if (isMediaViolation) {
        reasonText = 'AutoMod: Posting too much media (1 per 20 messages allowed)';
    } else if (matchingMessages.length >= SPAM_THRESHOLD) {
        reasonText = 'AutoMod: Spamming the same message';
    } else if (everyoneping) {
        reasonText = 'AutoMod: Mass ping';
    }

    await handleAutoMod(message, client, reasonText, forbiddenWords);

}