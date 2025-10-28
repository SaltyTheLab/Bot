import punishUser from './punishUser.js';
import updateTracker, { clearSpamFlags } from './trackers.js';
import forbbidenWordsData from './forbiddenwords.json' with {type: 'json'};
import { getActiveWarns, getUser } from '../Database/databasefunctions.js';
import globalwordsData from './globalwords.json' with {type: 'json'}
import guildChannelMap from "../BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};

const forbiddenWords = new Set(forbbidenWordsData.map(w => w.toLowerCase()));
const globalwords = new Set(globalwordsData.map(w => w.toLowerCase()))
const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function evaluateViolations({ hasInvite, globalword, matchedWord, everyonePing, isGeneralSpam, isDuplicateSpam, isMediaViolation, isNewUser, isCapSpam }) {
  const checks = [
    { flag: hasInvite, type: 'invite', reason: 'Discord invite', Weight: 2 },
    { flag: globalword, type: 'banned Word', reason: "Saying a slur", Weight: 2 },
    { flag: matchedWord, type: 'nsfw Word', reason: `NSFW word "${matchedWord}"`, Weight: 1 },
    { flag: everyonePing, type: 'everyoneping', reason: 'Mass ping', Weight: 2 },
    { flag: isGeneralSpam, type: 'spam', reason: 'Spamming', Weight: 1 },
    { flag: isDuplicateSpam, type: 'spam', reason: 'Spamming the same message', Weight: 1 },
    { flag: isMediaViolation, type: 'mediaViolation', reason: 'Media violation', Weight: 1 },
    { flag: isCapSpam, type: 'capspam', reason: 'Spamming Caps', Weight: 1 },
    { flag: isNewUser, type: 'isNewUser', reason: 'while new to the server.', Weight: 0.9 },
  ];
  const activeChecks = checks.filter(check => check.flag)
  const violations = activeChecks.map(({ type, reason }) => ({ type, reason }));
  const totalWeight = Math.ceil(activeChecks.reduce((acc, check) => { return acc + check.Weight }, 0));
  return {
    allReasons: violations,
    totalWeight
  };
}

export default async function AutoMod(client, message) {
  const { author, content, member, guild, channel } = message;
  const userId = author.id;
  const exclusions = guildChannelMap[guild.id].exclusions;
  const messageWords = content.toLowerCase().split(/\s+/);

  let globalword = null;
  let matchedWord = null;
  for (const word of messageWords) {
    if (globalwords.has(word)) {
      globalword = word
      break;
    }
  }
  if (!Object.values(exclusions).some(id => id === message.channel.parentId || id === message.channel.id)) {
    for (const word of messageWords) {
      if (forbiddenWords.has(word)) {
        matchedWord = word;
        break;
      }
    }
  }

  const [hasInvite, everyonePing, isNewUser] = [
    inviteRegex.test(content),
    message.mentions.everyone,
    Date.now() - member.joinedTimestamp < TWO_DAYS_MS && !getUser(userId, guild.id)
  ];

  const violationFlags = updateTracker(userId, message);
  const hasViolation = globalword || matchedWord || hasInvite || everyonePing ||
    violationFlags.isMediaViolation || violationFlags.isGeneralSpam || violationFlags.isDuplicateSpam || violationFlags.isCapSpam;
  if (!hasViolation) return;
  const evaluationResult = evaluateViolations({ hasInvite, globalword, matchedWord, everyonePing, ...violationFlags, isNewUser });
  globalword || matchedWord || hasInvite || everyonePing ? message.delete() : null;

  if (!evaluationResult) return;

  const reasons = evaluationResult.allReasons;
  let lastReason = null, reasonText

  if (reasons.length >= 2)
    lastReason = reasons.pop();
  if (lastReason == 'while new to the server.')
    reasonText = `AutoMod: ${reasons.join(', ')} ${lastReason}`;
  else if (reasons.length == 1)
    reasonText = lastReason !== null ? `autoMod: ${reasons} and ${lastReason}` : `autoMod: ${reasons}`;
  else
    reasonText = `autoMod: ${reasons.join(', ')} and ${lastReason}`;

  if ((await getActiveWarns(userId, guild.id).length > 2 || evaluationResult.totalWeight > 3 || everyonePing || hasInvite) && isNewUser == true)
    punishUser({ guild: guild, target: author.id, moderatorUser: client.user, reason: reasonText, channel: channel, isAutomated: true, banflag: true });
  else
    await punishUser({ guild: guild, target: author.id, moderatorUser: client.user, reason: reasonText, channel: channel, isAutomated: true, automodWarnWeight: evaluationResult.totalWeight });
  if (violationFlags.isGeneralSpam || violationFlags.isDuplicateSpam)
    clearSpamFlags(userId);
}