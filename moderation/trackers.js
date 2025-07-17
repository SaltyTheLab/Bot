import { LRUCache } from 'lru-cache';

export const userMessageTrackers = new LRUCache({
    max: 500,
    ttl: 5 * 60 * 1000,
    updateAgeOnGet: true,
});

export function updateTracker(userId, hasMedia) {
    const tracker = userMessageTrackers.get(userId) || { total: 0, mediaCount: 0 };
    tracker.total += 1;

    let isMediaViolation = false;
    if (hasMedia) {
        tracker.mediaCount += 1;
        if (tracker.mediaCount > 1 && tracker.total <= 20) {
            isMediaViolation = true;
        }
    }

    if (tracker.total >= 20) {
        tracker.total = 0;
        tracker.mediaCount = 0;
    }

    userMessageTrackers.set(userId, tracker);
    return isMediaViolation;
}
