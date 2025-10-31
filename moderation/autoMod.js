import punishUser from './punishUser.js';
import forbbidenWordsData from './forbiddenwords.json' with {type: 'json'};
import { getPunishments, getUser } from '../Database/databasefunctions.js';
import globalwordsData from './globalwords.json' with {type: 'json'}
import guildChannelMap from "../BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};
import { LRUCache } from 'lru-cache';
import Denque from 'denque';

const userMessageTrackers = new LRUCache({ max: 200, ttl: 30 * 60 * 1000, updateAgeOnGet: true, });
const forbiddenWords = new Set(forbbidenWordsData.map(w => w.toLowerCase()));
const globalwords = new Set(globalwordsData.map(w => w.toLowerCase()))
const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function getOrCreateTracker(userId, guildId) {
  const initialTrackerState = () => ({ total: 0, mediaCount: 0, timestamps: new Denque(), duplicateCounts: new Map(), recentMessages: new Denque() })
  const trackerkey = `${userId}-${guildId}`
  let tracker = userMessageTrackers.get(trackerkey) ?? initialTrackerState();
  if (!userMessageTrackers.has(trackerkey)) userMessageTrackers.set(trackerkey, tracker);
  return tracker;
}
function updateTracker(userId, message) {
  const settings = guildChannelMap[message.guild.id].automodsettings ?? null;
  if (!settings) {
    console.warn(`No automod settings found for guild ${message.guild.id}`);
    return { isMediaViolation: false, isGeneralSpam: false, isDuplicateSpam: false, isCapSpam: false };
  }
  const now = Date.now();
  const content = message.content;
  const tracker = getOrCreateTracker(userId, message.guild.id);
  let upperRatio;
  const { spamwindow: GENERAL_SPAM_WINDOW, spamthreshold: GENERAL_SPAM_THRESHOLD, Duplicatespamthreshold: DUPLICATE_SPAM_THRESHOLD, capsratio: capsthreshold, mediathreshold: mediathreshold, messagethreshold: messageThreshold, capscheckminlength: minLengthForCapsCheck } = settings;

  tracker.total += 1;

  if (content.length >= minLengthForCapsCheck) {
    const lettersOnly = content.replace(/[<a?:[a-zA-Z0-9_]+:\d+>/g, '').replace(/[^a-zA-Z]/g, '')
    const upperCaseOnly = lettersOnly.match(/[A-Z]/g)
    upperCaseOnly ? upperRatio = upperCaseOnly.length / lettersOnly.length : null
  }


  if (hasMedia(message) && !Object.values(guildChannelMap[message.guild.id].mediaexclusions).some(id => id === message.channel.parentId || id === message.channel.id))
    tracker.mediaCount += 1;

  // Track timestamps for general spam
  tracker.timestamps.push(now);
  while (tracker.timestamps.length && (now - tracker.timestamps.peekFront() > GENERAL_SPAM_WINDOW))
    tracker.timestamps.shift();

  // Track recent message for duplicates
  tracker.recentMessages.push({ content: message.content, timestamp: now });
  tracker.duplicateCounts.set(content, (tracker.duplicateCounts.get(content) || 0) + 1);

  while (tracker.recentMessages.length && (now - tracker.recentMessages.peekFront().timestamp > GENERAL_SPAM_WINDOW)) {
    const oldMessage = tracker.recentMessages.shift();
    const count = tracker.duplicateCounts.get(oldMessage.content);
    if (count > 1) {
      tracker.duplicateCounts.set(oldMessage.content, count - 1);
    } else {
      tracker.duplicateCounts.delete(oldMessage.content);
    }
  }

  const isDuplicateSpam = (tracker.duplicateCounts.get(content) || 0) > DUPLICATE_SPAM_THRESHOLD;
  const isMediaViolation = tracker.mediaCount > mediathreshold && tracker.total < messageThreshold;
  const isGeneralSpam = tracker.timestamps.size() > GENERAL_SPAM_THRESHOLD;
  const isCapSpam = upperRatio > capsthreshold;
  if (isMediaViolation) tracker.mediaCount = 0;
  if (isGeneralSpam) tracker.recentMessages.clear();
  if (isDuplicateSpam) tracker.duplicateCounts.clear();
  if (tracker.total >= messageThreshold) { tracker.total = 0; tracker.mediaCount = 0; tracker.timestamps.clear(); }
  userMessageTrackers.set(userId, tracker)
  return { isMediaViolation, isGeneralSpam, isDuplicateSpam, isCapSpam };
}

function hasMedia(message) {
  if ((!message.attachments || message.attachments.size === 0) && (!message.embeds || message.embeds.length === 0)) return false;

  return (
    message.attachments.size > 0 ||
    message.embeds.some(embed => {
      const urls = [embed.image?.url, embed.video?.url, embed.thumbnail?.url].filter(Boolean);
      return urls.some(url => /\.(gif|jpe?g|png|mp4|webm)$/i.test(url));
    })
  );
}

function evaluateViolations(hasInvite, globalword, matchedWord, everyonePing, isGeneralSpam, isDuplicateSpam, isMediaViolation, isCapSpam, isNewUser) {
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
  const reasons = checks.filter(check => check.flag).map(check => check.reason);
  const totalWeight = Math.ceil(checks.filter(check => check.flag).reduce((acc, check) => { return acc + check.Weight }, 0));
  return { reasons, totalWeight };
}

export default async function AutoMod(client, message) {
  const { author, content, member, guild, channel } = message;
  const messageWords = content.toLowerCase().split(/\s+/);
  const [hasInvite, everyonePing, isNewUser] = [
    inviteRegex.test(content),
    message.mentions.everyone,
    Date.now() - member.joinedTimestamp < TWO_DAYS_MS && !getUser(author.id, guild.id)];
  let globalword;
  let matchedWord;

  for (const word of messageWords) {
    if (globalwords.has(word)) {
      globalword = word
      break;
    }
  }
  if (!Object.values(guildChannelMap[guild.id].exclusions).some(id => id === message.channel.parentId || id === message.channel.id)) {
    for (const word of messageWords) {
      if (forbiddenWords.has(word)) {
        matchedWord = word;
        break;
      }
    }
  }
  const { isGeneralSpam, isDuplicateSpam, isCapSpam, isMediaViolation } = updateTracker(author.id, message);
  const { reasons, totalWeight } = evaluateViolations(hasInvite, globalword, matchedWord, everyonePing, isGeneralSpam, isDuplicateSpam, isMediaViolation, isCapSpam, isNewUser);
  if (totalWeight == 0) return;

  globalword || matchedWord || hasInvite || everyonePing ? message.delete() : null;
  let lastReason, reasonText;

  if (reasons.length >= 2)
    lastReason = reasons.pop();
  if (lastReason == 'while new to the server.')
    reasonText = `AutoMod: ${reasons.join(', ')} ${lastReason}`;
  else if (reasons.length == 1)
    reasonText = lastReason !== null ? `autoMod: ${reasons} and ${lastReason}` : `autoMod: ${reasons}`;
  else
    reasonText = `autoMod: ${reasons.join(', ')} and ${lastReason}`;

  if ((await getPunishments(author.id, guild.id, true).length > 2 || totalWeight >= 3 || everyonePing || hasInvite) && isNewUser == true)
    punishUser({ guild: guild, target: author.id, moderatorUser: client.user, reason: reasonText, channel: channel, isAutomated: true, banflag: true });
  else
    await punishUser({ guild: guild, target: author.id, moderatorUser: client.user, reason: reasonText, channel: channel, isAutomated: true, automodWarnWeight: totalWeight });
}