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

  const violationFlags = updateTracker(userId, message);

  const [matchedWord, hasInvite, everyonePing, isNewUser] = [
    [...forbiddenWords].find(word => lowerContent.includes(word)),
    inviteRegex.test(content),
    message.mentions.everyone,
    Date.now() - member.joinedTimestamp < TWO_DAYS_MS
  ];

  const hasViolation = matchedWord || hasInvite || everyonePing ||
    violationFlags.isMediaViolation || violationFlags.isGeneralSpam || violationFlags.isDuplicateSpam
    || violationFlags.isCapSpam;
  if (!hasViolation) return;

  if (violationFlags.isGeneralSpam && violationFlags.isDuplicateSpam) {
    violationFlags.isDuplicateSpam = false;
  }

  const shouldDelete = matchedWord || hasInvite || everyonePing || violationFlags.triggeredByCurrentMessage
  const [evaluationResult] = await Promise.all([
    evaluateViolations({ matchedWord, hasInvite, everyonePing, ...violationFlags, isNewUser }),
    shouldDelete ? message.delete().catch(() => null) : Promise.resolve()
  ]);

  if (!evaluationResult || !evaluationResult.violations.length) return;

  let reasonText = `AutoMod: ${evaluationResult.allReasons.join(', ')}`;
  if (isNewUser && reasonText.endsWith('while new to the server.')) {
    reasonText = reasonText.replace(/,([^,]*)$/, ' $1');
  } else {
    reasonText = reasonText.replace(/,([^,]*)$/, ' and$1');
  }

  const statsPromise = getWarnStats(userId, evaluationResult.violations);
  const [{ activeWarnings }, { duration, unit }] = await Promise.all([
    statsPromise,
    statsPromise.then(({ activeWarnings, currentWarnWeight }) =>
      getNextPunishment(activeWarnings.length + currentWarnWeight)
    )
  ]);
  const commonPayload = {
    guild,
    targetUser: userId,
    moderatorUser: client.user,
    reason: reasonText,
    channelid: channel.id,
    isAutomated: true,
    violations: evaluationResult.violations
  };

  if (activeWarnings.length > 0 && duration > 0) {
    await muteUser({
      ...commonPayload,
      duration,
      unit
    });
  } else
    await warnUser(commonPayload);
}