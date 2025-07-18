import { violationWeights } from './violationTypes.js';

export function evaluateViolations({ hasInvite, matchedWord, everyonePing, isSpamming, isMediaViolation }) {
  const violations = [];

  if (hasInvite) {
    violations.push({ type: 'invite', reason: 'Discord invite' });
  }
  if (matchedWord) {
    violations.push({ type: 'forbiddenWord', reason: `Forbidden word "${matchedWord}"` });
  }
  if (everyonePing) {
    violations.push({ type: 'everyonePing', reason: 'Mass ping' });
  }
  if (isSpamming) {
    violations.push({ type: 'spam', reason: 'Spam detected' });
  }
  if (isMediaViolation) {
    violations.push({ type: 'mediaViolation', reason: 'Media violation' });
  }

  if (violations.length === 0) return null;

  // Find the most severe violation
  const sorted = violations.sort(
    (a, b) => (violationWeights[b.type] || 0) - (violationWeights[a.type] || 0)
  );

  return {
    allReasons: violations.map(v => v.reason),
    primaryType: sorted[0].type
  };
}
