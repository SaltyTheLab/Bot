// AutoMod.js

import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';
import { getNextPunishment } from './punishments.js';
import { getWarnStats } from './simulatedwarn.js';
import { updateTracker } from './trackers.js';
import { evaluateViolations } from './evaluateViolations.js';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const forbiddenWordsPath = path.join(__dirname, '../moderation/forbiddenwords.json');
const forbiddenWords = new Set(
  JSON.parse(fs.readFileSync(forbiddenWordsPath, 'utf8')).forbiddenWords.map(w => w.toLowerCase())
);

const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

// --- New: cooldown + execution flags ---
const cooldowns = new Map();
const processing = new Set();

export async function AutoMod(message, client) {
  const { author, content, member, guild, channel } = message;
  const userId = author.id;
  const lowerContent = content.toLowerCase();

  console.log(`[AutoMod] Message from ${author.tag}: ${content}`);

  // --- Cooldown (2s per user) ---
  const now = Date.now();
  if (cooldowns.has(userId) && now - cooldowns.get(userId) < 2000) return;
  cooldowns.set(userId, now);

  // --- Prevent overlapping logic for same user ---
  if (processing.has(userId)) return;
  processing.add(userId);

  try {
    // Run dynamic violation checks
    const violationFlags = updateTracker(userId, message);

    const matchedWord = [...forbiddenWords].find(word => lowerContent.includes(word));
    const hasInvite = inviteRegex.test(content);
    const everyonePing = message.mentions.everyone;
    const isNewUser = Date.now() - member.joinedTimestamp < TWO_DAYS_MS;

    const hasViolation = matchedWord || hasInvite || everyonePing || violationFlags.isMediaViolation || violationFlags.isGeneralSpam || violationFlags.isDuplicateSpam;
    if (!hasViolation) return;

    if (violationFlags.isGeneralSpam && violationFlags.isDuplicateSpam) {
      violationFlags.isDuplicateSpam = false;
    }

    const { allReasons, violations } = await evaluateViolations({
      matchedWord,
      hasInvite,
      everyonePing,
      ...violationFlags,
      isNewUser
    });

    if (!violations.length) return;

    console.log('[AutoMod] Violations:', violations);

    let reasonText = `AutoMod: ${allReasons.join(', ')}`;
    if (isNewUser && reasonText.endsWith('while new to the server.')) {
      reasonText = reasonText.replace(/,([^,]*)$/, ' $1');
    } else {
      reasonText = reasonText.replace(/,([^,]*)$/, ' and$1');
    }

    try {
      await message.delete();
    } catch (err) {
      console.warn(`[AutoMod] Failed to delete message from ${author.tag}:`, err.message);
    }

    const { weightedWarns } = await getWarnStats(userId, violations);
    const { duration, unit } = getNextPunishment(weightedWarns);
    console.log(`[AutoMod] Weighted warns: ${weightedWarns} => ${duration} ${unit}`);

    if (weightedWarns >= 2 && duration > 0) {
      await muteUser({
        guild,
        targetUser: userId,
        moderatorUser: client.user.id,
        reason: reasonText,
        duration,
        unit,
        channel,
        isAutomated: true,
        violations
      });
    } else {
      await warnUser({
        guild,
        targetUser: userId,
        moderatorUser: client.user,
        reason: reasonText,
        channel,
        isAutomated: true,
        violations
      });
    }

  } catch (err) {
    console.error(`[AutoMod] Error while processing ${userId}:`, err);
  } finally {
    processing.delete(userId);
  }
}
