import punishUser from './punishUser.js';
import forbbidenWordsData from './forbiddenwords.json' with {type: 'json'};
import { getPunishments, getUser } from '../Database/databasefunctions.js';
import globalwordsData from './globalwords.json' with {type: 'json'}
import guildChannelMap from "../Extravariables/guildconfiguration.js";
import { LRUCache } from 'lru-cache';
import Denque from 'denque';
import { MessageFlagsBitField } from 'discord.js';
const forbiddenWords = new Set(forbbidenWordsData);
const globalWords = new Set(globalwordsData);
const userMessageTrackers = new LRUCache({ max: 50, ttl: 30 * 60 * 1000, updateAgeOnGet: true, ttlAutopurge: true });

function getOrCreateTracker(userId, guildId) {
  const initialTrackerState = () => ({ total: 0, mediaCount: 0, timestamps: new Denque(), duplicateCounts: new Map(), recentMessages: new Denque() })
  const trackerkey = `${userId}-${guildId}`
  let tracker = userMessageTrackers.get(trackerkey) ?? initialTrackerState();
  if (!userMessageTrackers.has(trackerkey)) userMessageTrackers.set(trackerkey, tracker);
  return tracker;
}
function hasMedia(message) {
  if ((!message.attachments || message.attachments.size === 0) && (!message.embeds || message.embeds.length === 0)) return false;
  return (
    message.attachments.size > 0 ||
    message.embeds.some(embed => {
      const urls = [embed.image?.url, embed.video?.url, embed.thumbnail?.url].filter(Boolean);
      return urls.some(url => /\.(gif|jpe?g|png|mp4|webm)$/i.test(url));
    }));
}
function evaluateViolations(hasInvite, globalword, matchedWord, everyonePing, isGeneralSpam, isDuplicateSpam, isMediaViolation, isCapSpam, isNewUser) {
  const checks = [
    { flag: hasInvite, type: 'invite', reason: 'Discord invite', Weight: 2 },
    { flag: globalword, type: 'banned Word', reason: "Saying a slur", Weight: 2 },
    { flag: matchedWord, type: 'nsfw Word', reason: `NSFW word "${matchedWord}"`, Weight: 1 },
    { flag: everyonePing, type: 'everyoneping', reason: 'Mass pinging', Weight: 2 },
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
    const lettersOnly = content.replace(/<a?:\w+:\d+>/g, '').replace(/[^a-zA-Z]/g, '')
    const upperCaseOnly = lettersOnly.match(/[A-Z]/g) ?? null
    if (upperCaseOnly && upperCaseOnly.length > 10) upperRatio = upperCaseOnly.length / lettersOnly.length
  }

  //media check for message and flag it if true
  if (hasMedia(message) && !message.flags.has(MessageFlagsBitField.Flags.IsVoiceMessage) && !Object.values(guildChannelMap[message.guild.id].mediaexclusions).some(id => id === message.channel.parentId || id === message.channel.id))
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
    } else
      tracker.duplicateCounts.delete(oldMessage.content);
  }

  const DuplicateSpam = (tracker.duplicateCounts.get(content) || 0) > DUPLICATE_SPAM_THRESHOLD;
  const MediaViolation = tracker.mediaCount > mediathreshold && tracker.total < messageThreshold;
  const GeneralSpam = tracker.timestamps.size() > GENERAL_SPAM_THRESHOLD;
  const CapSpam = upperRatio > capsthreshold;
  MediaViolation ? tracker.mediaCount = 1 : null;
  GeneralSpam ? tracker.recentMessages.clear() : null;
  DuplicateSpam ? tracker.duplicateCounts.clear() : null;
  if (tracker.total >= messageThreshold) { tracker.total = 0; tracker.mediaCount = 0; tracker.timestamps.clear(); }
  userMessageTrackers.set(userId, tracker)
  return { MediaViolation, GeneralSpam, DuplicateSpam, CapSpam };
}
export default async function AutoMod(message) {
  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const { author, content, member, guild, channel, client } = message;
  const messageWords = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const [hasInvite, everyonePing] = [inviteRegex.test(content), message.mentions.everyone];
  let globalword;
  let matchedWord;
  messageWords.forEach(word => {
    globalWords.has(word) ? globalword = word : null
  });
  if (!Object.values(guildChannelMap[guild.id].exclusions).some(id => id === message.channel.parentId || id === message.channel.id)) {
    messageWords.forEach(word => {
      forbiddenWords.has(word) ? matchedWord = word : null
    })
  }
  const { GeneralSpam, DuplicateSpam, CapSpam, MediaViolation } = updateTracker(author.id, message);
  let { totalWeight } = evaluateViolations(hasInvite, globalword, matchedWord, everyonePing, GeneralSpam, DuplicateSpam, MediaViolation, CapSpam, false);
  if (totalWeight === 0) return;

  globalword || matchedWord || hasInvite || everyonePing ? await message.delete() : null;
  let isNewUser = false;

  if (Date.now() - member.joinedTimestamp < TWO_DAYS_MS) {
    const { userData } = await getUser(author.id, guild.id, true);
    if (!userData) {
      isNewUser = true;
      totalWeight = Math.ceil(totalWeight + 0.9);
    }
  }
  const { reasons } = evaluateViolations(hasInvite, globalword, matchedWord, everyonePing, GeneralSpam, DuplicateSpam, MediaViolation, CapSpam, isNewUser)
  let reasonText;
  if (reasons.length === 1) { reasonText = `AutoMod: ${reasons[0]}` }
  else {
    const lastReason = reasons.pop();
    lastReason == 'while new to the server' ? reasonText = `AutoMod: ${reasons.join(', ')} ${lastReason}` : `AutoMod: ${reasons.join(', ')}`
  }
  const commoninputs = {
    guild: guild, target: member, moderatorUser: client.user, reason: reasonText, channel: channel, isAutomated: true
  }
  let punishmentCount = 0;
  if (isNewUser && (totalWeight >= 3 || everyonePing || hasInvite)) {
    try {
      const punishments = await getPunishments(author.id, guild.id, true);
      punishmentCount = punishments.length;
    } catch (error) {
      console.error(`Failed to fetch punishments for user ${author.id}: ${error.message}`);
    }
  }
  if (isNewUser && (totalWeight >= 3 || everyonePing || hasInvite) || punishmentCount > 2)
    punishUser({ ...commoninputs, banflag: true });
  else
    punishUser({ ...commoninputs, currentWarnWeight: totalWeight });
}