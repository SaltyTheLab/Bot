import { LRUCache } from 'lru-cache';
import Denque from 'denque';
import { hobbiescatagorey, mediacatagorey } from '../BotListeners/channelids.js';

export const userMessageTrackers = new LRUCache({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: true,
});

const GENERAL_SPAM_WINDOW = 8 * 1000;
const GENERAL_SPAM_THRESHOLD = 4;
const DUPLICATE_SPAM_THRESHOLD = 3;



export function updateTracker(userId, message) {
  const now = Date.now();

  const exclusions = [hobbiescatagorey, mediacatagorey];
  const content = message.content;
  const minLengthForCapsCheck = 10;
  let isCapSpam = false;

  let tracker = userMessageTrackers.get(userId);
  if (!tracker) {
    tracker = {
      total: 0,
      mediaCount: 0,
      timestamps: new Denque([], { max: 10 }),
      recentMessages: new Denque([], { max: 5 })
    };
  }

  tracker.total += 1;


  if (content.length >= minLengthForCapsCheck) {
    const lettersOnly = content.replace(/[^a-zA-Z]/g, '');
    const upperCaseCount = (lettersOnly.match(/[A-Z]/g) || []).length
    const upperRatio = lettersOnly.length > 0 ? upperCaseCount / lettersOnly.length : 0;
    isCapSpam = upperRatio > .7;
  }

  const hasMediaContent = hasMedia(message);
  if (hasMediaContent && !exclusions.includes(message.channel.parentId)) {
    tracker.mediaCount += 1;
  }

  // Track timestamps for general spam
  tracker.timestamps.push(now);
  while (tracker.timestamps.length && now - tracker.timestamps.peekFront() > GENERAL_SPAM_WINDOW) {
    tracker.timestamps.shift();
  }

  const wasGeneralSpam = tracker.timestamps.size() >= GENERAL_SPAM_THRESHOLD;

  // Track recent message for duplicates
  tracker.recentMessages.push({ content: message.content, timestamp: now });
  const recent = tracker.recentMessages.toArray().filter(msg => now - msg.timestamp <= GENERAL_SPAM_WINDOW);
  const duplicateCount = recent.filter(msg => msg.content === message.content).length;
  const isDuplicateSpam = duplicateCount >= DUPLICATE_SPAM_THRESHOLD;
  const wasDuplicateSpam = duplicateCount >= DUPLICATE_SPAM_THRESHOLD;

  const isMediaViolation = tracker.mediaCount > 1 && tracker.total <= 20;

  if (tracker.total >= 20) {
    tracker.total = 0;
    tracker.mediaCount = 0;
    tracker.timestamps.clear();
  }

  if (tracker.recentMessages.size() > GENERAL_SPAM_THRESHOLD && isDuplicateSpam) {
    tracker.recentMessages.clear();
  }

  userMessageTrackers.set(userId, tracker);
  return {
    isMediaViolation,
    isGeneralSpam: wasGeneralSpam,
    isDuplicateSpam: wasDuplicateSpam,
    isCapSpam,
    triggeredByCurrentMessage: wasGeneralSpam || wasDuplicateSpam || isMediaViolation
  };
}

function hasMedia(message) {
  if (!message.attachments || !message.embeds) return false;

  return (
    message.attachments.size > 0 ||
    message.embeds.some(embed => {
      const urls = [embed.image?.url, embed.video?.url, embed.thumbnail?.url].filter(Boolean);
      return urls.some(url => /\.(gif|jpe?g|png|mp4|webm)$/i.test(url));
    })
  );
}