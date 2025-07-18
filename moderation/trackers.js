import { LRUCache } from 'lru-cache';

export const userMessageTrackers = new LRUCache({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: true,
});

const GENERAL_SPAM_WINDOW = 10 * 1000; // 10 seconds
const GENERAL_SPAM_THRESHOLD = 6;

export function updateTracker(userId, hasMedia) {
  const now = Date.now();

  const tracker = userMessageTrackers.get(userId) || {
    total: 0,
    mediaCount: 0,
    timestamps: []
  };

  // Track total/media counts
  tracker.total += 1;
  if (hasMedia) {
    tracker.mediaCount += 1;
  }

  // Track message timestamps for spam
  tracker.timestamps.push(now);
  tracker.timestamps = tracker.timestamps.filter(ts => now - ts <= GENERAL_SPAM_WINDOW);

  // Check for media violation
  const isMediaViolation = hasMedia && tracker.mediaCount > 1 && tracker.total <= 20;

  // Check for general spam
  const isGeneralSpam = tracker.timestamps.length >= GENERAL_SPAM_THRESHOLD;

  // Reset counts every 20 messages to avoid stale tracking
  if (tracker.total >= 20) {
    tracker.total = 0;
    tracker.mediaCount = 0;
    tracker.timestamps = [];
  }

  userMessageTrackers.set(userId, tracker);
  return { isMediaViolation, isGeneralSpam };
}
