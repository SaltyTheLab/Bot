import { LRUCache } from 'lru-cache';
import Denque from 'denque';
import { hobbiescatagorey, mediacatagorey, evoadultcatagorey } from '../BotListeners/Extravariables/channelids.js';

 const userMessageTrackers = new LRUCache({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: true,
});

const GENERAL_SPAM_WINDOW = 8 * 1000;
const GENERAL_SPAM_THRESHOLD = 4;
const DUPLICATE_SPAM_THRESHOLD = 3;



export default function updateTracker(userId, message) {
  const now = Date.now();

  const exclusions = [hobbiescatagorey, mediacatagorey, evoadultcatagorey];
  const content = message.content;
  const minLengthForCapsCheck = 10;
  let isCapSpam = false;

  let tracker = userMessageTrackers.get(userId);
  if (!tracker) {
    tracker = {
      total: 0,
      mediaCount: 0,
      timestamps: new Denque(),
      recentMessages: new Denque()
    };
    userMessageTrackers.set(userId, tracker);
  }

  tracker.total += 1;

// cap spam check method
  if (content.length >= minLengthForCapsCheck) {
    const lettersOnly = content.replace(/[^a-zA-Z]/g, '');
    const upperCaseCount = (lettersOnly.match(/[A-Z]/g) || []).length
    if (lettersOnly.length > 0) {
      const upperRatio = lettersOnly.length > 0 ? upperCaseCount / lettersOnly.length : 0;
      isCapSpam = upperRatio > .7;
    }
  }

  const hasMediaContent = hasMedia(message);
  //media check for message and flag it if true
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

  while (tracker.recentMessages.length && (now - tracker.recentMessages.peekFront().timestamp > GENERAL_SPAM_WINDOW)) {
    tracker.recentMessages.shift();
  }

  let duplicateCount = 0;
  //count messages that are the same
  for (let i = 0; i < tracker.recentMessages.length; i++) {
    if (tracker.recentMessages.get(i).content === message.content) {
      duplicateCount++;
    }
  }
  const isDuplicateSpam = duplicateCount >= DUPLICATE_SPAM_THRESHOLD;

  const isMediaViolation = tracker.mediaCount > 1 && tracker.total < 20;

  if(isMediaViolation)
    tracker.mediaCount = 0;

  // clear messages after 20 sent over, resetting all flags
  if (tracker.total >= 20) {
    tracker.total = 0;
    tracker.mediaCount = 0;
    tracker.timestamps.clear();
  }
  //if spam detected, flag it and clear out recentMessages array
  if (tracker.recentMessages.size() > GENERAL_SPAM_THRESHOLD && isDuplicateSpam) {
    tracker.recentMessages.clear();
  }

  userMessageTrackers.set(userId, tracker);
  //send the flags out of the function
  return {
    isMediaViolation,
    isGeneralSpam: wasGeneralSpam,
    isDuplicateSpam: isDuplicateSpam,
    isCapSpam,
    triggeredByCurrentMessage: wasGeneralSpam || isDuplicateSpam || isMediaViolation || isCapSpam
  };
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