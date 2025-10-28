import { LRUCache } from 'lru-cache';
import Denque from 'denque';
import guildChannelMap from "../BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};
const userMessageTrackers = new LRUCache({
  max: 200,
  ttl: 30 * 60 * 1000,
  updateAgeOnGet: true,
});
const initialTrackerState = () => ({ total: 0, mediaCount: 0, timestamps: new Denque(), duplicateCounts: new Map(), recentMessages: new Denque() })

function getOrCreateTracker(userId) {
  let tracker = userMessageTrackers.get(userId) ?? initialTrackerState();
  if (!userMessageTrackers.has(userId)) userMessageTrackers.set(userId, tracker);
  return tracker;
}
export default function updateTracker(userId, message) {
  const settings = guildChannelMap[message.guild.id].automodsettings ?? null;
  const mediaexclusions = guildChannelMap[message.guild.id].mediaexclusions;
  if (!settings) {
    console.warn(`No automod settings found for guild ${message.guild.id}`);
    return { isMediaViolation: false, isGeneralSpam: false, isDuplicateSpam: false, isCapSpam: false };
  }
  const {
    spamwindow: GENERAL_SPAM_WINDOW,
    spamthreshold: GENERAL_SPAM_THRESHOLD,
    Duplicatespamthreshold: DUPLICATE_SPAM_THRESHOLD,
    capsratio: capsthreshold,
    mediathreshold: mediathreshold,
    messagethreshold: messageThreshold,
    capscheckminlength: minLengthForCapsCheck
  } = settings;
  const now = Date.now();
  const content = message.content;
  let isCapSpam = false;
  const tracker = getOrCreateTracker(userId);

  tracker.total += 1;

  if (content.length >= minLengthForCapsCheck) {
    const lettersOnly = content.replace(/[<a?:[a-zA-Z0-9_]+:\d+>/g, '').replace(/[^a-zA-Z]/g, '')
    const upperCaseCount = (lettersOnly.match(/[A-Z]/g) || []).length
    if (upperCaseCount > 3 && lettersOnly.length > 0) {
      const upperRatio = upperCaseCount / lettersOnly.length;
      isCapSpam = upperRatio > capsthreshold;
    }
  }

  const hasMediaContent = hasMedia(message);
  const isExcluded = Object.values(mediaexclusions).some(id => id === message.channel.parentId || id === message.channel.id)

  if (hasMediaContent && !isExcluded) {
    tracker.mediaCount += 1;
  }

  // Track timestamps for general spam
  tracker.timestamps.push(now);
  while (tracker.timestamps.length && (now - tracker.timestamps.peekFront() > GENERAL_SPAM_WINDOW)) {
    tracker.timestamps.shift();
  }

  const wasGeneralSpam = tracker.timestamps.size() > GENERAL_SPAM_THRESHOLD;

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

  if (isMediaViolation)
    tracker.mediaCount = 0;

  if (wasGeneralSpam)
    tracker.recentMessages.clear();

  if (isDuplicateSpam)
    tracker.duplicateCounts.clear();

  if (tracker.total >= messageThreshold) {
    tracker.total = 0;
    tracker.mediaCount = 0;
    tracker.timestamps.clear();
  }
  userMessageTrackers.set(userId, tracker)
  return { isMediaViolation, isGeneralSpam: wasGeneralSpam, isDuplicateSpam: isDuplicateSpam, isCapSpam };
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

export function clearSpamFlags(userId) {
  const tracker = userMessageTrackers.get(userId);
  if (tracker) {
    tracker.timestamps.clear();
    tracker.recentMessages.clear();
    tracker.duplicateCounts.clear();
    userMessageTrackers.set(userId, tracker);
  }
}