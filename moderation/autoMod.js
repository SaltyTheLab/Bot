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

const forbiddenWords = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../moderation/forbiddenwords.json'), 'utf8')
).forbiddenWords;

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;

export async function AutoMod(message, client) {
  const now = Date.now();
  const userId = message.author.id;
  console.log('[AutoMod] New automod invocation');

  // check message and apply flags
  const { isMediaViolation, isGeneralSpam } = updateTracker(userId, message)
  const matchedWord = forbiddenWords.find(word => message.content.includes(word.toLowerCase()));
  const hasInvite = inviteRegex.test(message.content);
  const everyonePing = message.mentions.everyone;

  // Allow message if no violations
  if (!matchedWord && !hasInvite && !isMediaViolation && !everyonePing && !isGeneralSpam) return;

  // enter violations and add a new user flag if user account is less than
  // two days old
  const joinedDuration = now - message.member.joinedTimestamp;
  const isNewUser = joinedDuration < TWO_DAYS_MS
  const violationResult = await evaluateViolations({
    hasInvite,
    matchedWord,
    everyonePing,
    isGeneralSpam,
    isMediaViolation,
    isNewUser
  });

  if (!violationResult) return;

  //build reason string 
  const { allReasons, violations } = violationResult;
  let reasonText = `AutoMod: ${allReasons.join(', ')}`;

  //check for new user flag
  if (isNewUser && reasonText.endsWith('while new to the server.')) {
    reasonText = reasonText.replace(/,([^,]*)$/, ' $1');
  } else
    reasonText = reasonText.replace(/,([^,]*)$/, ' and$1');

  //fetch future warn along with previous warns
  const { weightedWarns } = await getWarnStats(userId, violations);
  console.log(weightedWarns);

  // Decide punishment
  await handleWarningOrMute(message, client, reasonText, userId, weightedWarns, violations);

  //Cleanup violating message
  try {
    await message.delete();
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}

async function handleWarningOrMute(message, client, reasonText, userId, weightedWarns, violations = []) {
  const guild = message.guild;
  const { duration, unit } = getNextPunishment(weightedWarns);
  if (weightedWarns > 0) {
    await muteUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user.id,
      reason: reasonText,
      duration,
      unit,
      channel: message.channel,
      isAutomated: true,
      violations
    });

  } else {
    await warnUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user,
      reason: reasonText,
      channel: message.channel,
      isAutomated: true,
      violations
    });
  }
}