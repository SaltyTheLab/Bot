import { updateTracker } from '../moderation/trackers.js';
import { AutoMod } from '../moderation/autoMod.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmbedBuilder } from '@discordjs/builders';
import { saveUserAsync, getUserAsync } from '../Logging/databasefunctions.js';
import { evaluateViolations } from '../moderation/evaluateViolations.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const forbiddenWords = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../moderation/forbiddenwords.json'), 'utf8')
).forbiddenWords;

const SPAM_WINDOW = 15_000;
const SPAM_THRESHOLD = 4;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const messageHistory = new Map();
const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;

const keywords = {
  cute: "You're Cute",
  adorable: "You're Adorable",
  ping: 'pong!'
};

const recentSpamPunishments = new Map();
const SPAM_PUNISHMENT_COOLDOWN = 10 * 1000; // 10 seconds


export async function onMessageCreate(client, message) {
  if (message.author.bot || !message.guild || !message.member) return;

  const { author, guild, content } = message;
  const userId = author.id;
  const guildId = guild.id;
  const lowerContent = content.toLowerCase();
  const now = Date.now();

  const lastPunished = recentSpamPunishments.get(userId);
  const user = await applyUserXP(userId, guildId, message);
  await saveUserAsync(user);

  if (keywords[lowerContent]) return message.reply(keywords[lowerContent]);
  const hasMediaContent = hasMedia(message);
  const { isMediaViolation, isGeneralSpam } = updateTracker(userId, hasMediaContent)
  const isSpamming = checkSpam(userId, lowerContent, now, isGeneralSpam);
  const matchedWord = forbiddenWords.find(word => lowerContent.includes(word.toLowerCase()));
  const hasInvite = inviteRegex.test(lowerContent);
  const everyonePing = message.mentions.everyone;

  // Allow message if no violations
  if (!matchedWord && !hasInvite && !isMediaViolation && !isSpamming && !everyonePing) return;

  const joinedDuration = now - message.member.joinedTimestamp;
  const isNewUser = joinedDuration < TWO_DAYS_MS
  const violationResult = evaluateViolations({
    hasInvite,
    matchedWord,
    everyonePing,
    isSpamming,
    isMediaViolation,
    isNewUser
  });

  if (!violationResult) return;

  const { allReasons, primaryType, violations } = violationResult;
  let reasonText = `AutoMod: ${allReasons.join(', ')}`;
  if (isNewUser && reasonText.endsWith('while new to the server.')) {
    reasonText = reasonText.replace(/,([^,]*)$/, ' $1');
  } else
    reasonText = reasonText.replace(/,([^,]*)$/, ' and$1');

  // Spam cooldown check (optional)l
  if (primaryType === 'spam' && lastPunished && now - lastPunished < SPAM_PUNISHMENT_COOLDOWN) {
    return;
  }
  if (primaryType === 'spam') {
    recentSpamPunishments.set(userId, now);
  }

  await AutoMod(message, client, reasonText, primaryType ,violations
  );
}

// --- Helpers ---

function checkSpam(userId, content, now) {
  const history = messageHistory.get(userId) ?? [];

  // Keep only messages within SPAM_WINDOW
  const recentHistory = history.filter(m => now - m.timestamp < SPAM_WINDOW);
  recentHistory.push({ content, timestamp: now });
  messageHistory.set(userId, recentHistory);

  // Same content spam detection
  const sameContentMessages = recentHistory.filter(m => m.content === content);
  const isDuplicateSpam = sameContentMessages.length >= SPAM_THRESHOLD;

  // General spam detection (burst messaging)
  const { isGeneralSpam } = updateTracker(userId, false); // false = not media here

  // Clear history if duplicate spam
  if (isDuplicateSpam) messageHistory.set(userId, []);

  // Return true if either spam condition is met
  return isDuplicateSpam || isGeneralSpam;
}

function hasMedia(message) {
  return (
    message.attachments.size > 0 ||
    message.embeds.some(embed => {
      const urls = [embed.image?.url, embed.video?.url, embed.thumbnail?.url].filter(Boolean);
      return urls.some(url => /\.(gif|jpe?g|png|mp4|webm)$/i.test(url));
    })
  );
}


async function applyUserXP(userId, guildId, message) {
  const user = await getUserAsync(userId, guildId);
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
  }
  return user;
}