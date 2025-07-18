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

const SPAM_WINDOW = 15_000;
const SPAM_THRESHOLD = 4;
const messageHistory = new Map();
const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;

export async function onMessageCreate(client, message) {
  if (message.author.bot || !message.guild) return;

  const { id: userId } = message.author;
  const { id: guildId } = message.guild;
  const content = message.content.toLowerCase();
  const now = Date.now();
  
    //add user xp
  let user = await getUserAsync(userId, guildId);
  user.xp += 20;

  const xpNeeded = Math.floor((user.level - 1) ** 2 * 50);
  if (user.xp >= xpNeeded) {
    user.level++;
    user.xp = 0;

    const levelUpEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${message.author.tag} leveled up to ${user.level}!`,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setColor(0x00AE86)
      .setFooter({ text: 'keep on yapping!' });

    await message.channel.send({ embeds: [levelUpEmbed] });
  }

  // Auto-role on level 3
  if (user.level === 3) {
    const verifiedRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
    if (verifiedRole) {
      const member = await message.guild.members.fetch(userId);
      if (!member.roles.cache.has(verifiedRole.id)) {
        await member.roles.add(verifiedRole);
      }
    }
  }

  await saveUserAsync(user);

  const history = messageHistory.get(userId) ?? [];
  const recentHistory = history.filter(m => now - m.timestamp < SPAM_WINDOW);
  recentHistory.push({ content, timestamp: now });
  messageHistory.set(userId, recentHistory);

  const spamMatches = recentHistory.filter(m => m.content === content);
  const isSpamming = spamMatches.length >= SPAM_THRESHOLD;

  if (isSpamming) messageHistory.set(userId, []); // reset history if spam detected


  const hasMedia = message.attachments.size > 0 || message.embeds.some(embed => {
    const urls = [embed.image?.url, embed.video?.url, embed.thumbnail?.url].filter(Boolean);
    return urls.some(url => /\.(gif|jpe?g|png|mp4|webm)$/i.test(url));
  });

  const isMediaViolation = updateTracker(userId, hasMedia, message);

 
  const keywords = {
    cute: "You're Cute",
    adorable: "You're Adorable",
    ping: "pong!"
  };

  if (keywords[content]) {
    return message.reply(keywords[content]);
  }

 
  const matchedWord = forbiddenWords.find(word => content.includes(word.toLowerCase()));
  const hasInvite = inviteRegex.test(content);
  const everyonePing = message.mentions.everyone;

  // ✅ Allow message if no violations
  if (!matchedWord && !hasInvite && !isMediaViolation && !isSpamming && !everyonePing) return;


  let reasonText = '';
  if (hasInvite) {
    reasonText = 'AutoMod: Discord invite detected';
  } else if (matchedWord) {
    reasonText = `AutoMod: Forbidden word "${matchedWord}"`;
  } else if (isMediaViolation) {
    reasonText = 'AutoMod: Posting too much media (1 per 20 messages allowed)';
  } else if (isSpamming) {
    reasonText = 'AutoMod: Spamming the same message';
  } else if (everyonePing) {
    reasonText = 'AutoMod: Mass ping';
  }

  await handleAutoMod(message, client, reasonText, forbiddenWords);
}
