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


export async function AutoMod(message, client) {
  const { author, content, member, guild, channel } = message;
  const userId = author.id;
  const lowerContent = content.toLowerCase();

  console.log(`[AutoMod] Message from ${author.tag}: ${content}`);



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

    let reasonText = `AutoMod: ${allReasons.join(', ')}`;
    if (isNewUser && reasonText.endsWith('while new to the server.')) {
      reasonText = reasonText.replace(/,([^,]*)$/, ' $1');
    } else {
      reasonText = reasonText.replace(/,([^,]*)$/, ' and$1');
    }

      await message.delete();

    const { currentWarnWeight, weightedWarns, activeWarnings } = await getWarnStats(userId, violations);
    const { duration, unit } = getNextPunishment(activeWarnings.length + currentWarnWeight);

    if (weightedWarns > 0 && duration > 0) {
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

}
