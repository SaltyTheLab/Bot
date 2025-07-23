import { LRUCache } from 'lru-cache';
import { hobbiescatagorey, mediacatagorey } from '../BotListeners/channelids.js';

export const userMessageTrackers = new LRUCache({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: true,
});

const GENERAL_SPAM_WINDOW = 8 * 1000; // 10 seconds
const GENERAL_SPAM_THRESHOLD = 3;
const DUPLICATE_SPAM_THRESHOLD = 2;

export function updateTracker(userId, message) {
  const now = Date.now();
  const exclusions = [
    hobbiescatagorey,
    mediacatagorey
  ]
  const tracker = userMessageTrackers.get(userId) || {
    total: 0,
    mediaCount: 0,
    timestamps: [],
    recentMessages: []
  };

  // Track total/media counts
  tracker.total += 1;
  if (hasMedia(message) && !exclusions.includes(message.channel.parentId)) {
    tracker.mediaCount += 1;
  }

  // Track message timestamps for spam
  tracker.timestamps.push(now);
  tracker.timestamps = tracker.timestamps.filter(ts => now - ts <= GENERAL_SPAM_WINDOW);

  // Track for duplicate messages
  tracker.recentMessages.push({ content: message.content, timestamp: now });
  tracker.recentMessages = tracker.recentMessages.filter(msg => now - msg.timestamp <= GENERAL_SPAM_THRESHOLD);

  // === Boolean flag logic ===
  const duplicateCount = tracker.recentMessages.filter(msg => msg.content === message.content).length;
  const isDuplicateSpam = duplicateCount >= DUPLICATE_SPAM_THRESHOLD;

  const isMediaViolation = tracker.mediaCount > 1 && tracker.total <= 20;

  const isGeneralSpam = tracker.timestamps.length >= GENERAL_SPAM_THRESHOLD;

  // Reset counts every 20 messages
  if (tracker.total >= 20) {
    tracker.total = 0;
    tracker.mediaCount = 0;
    tracker.timestamps = [];
  }

  if (tracker.recentMessages.length > GENERAL_SPAM_THRESHOLD && isDuplicateSpam)
    tracker.recentMessages = [];

  if (tracker.mediaCount > 1 && tracker.total <= 20)
    tracker.mediaCount = 0;

  userMessageTrackers.set(userId, tracker);
  return { isMediaViolation, isGeneralSpam, isDuplicateSpam };
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
