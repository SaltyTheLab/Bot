import { violationWeights } from './violationWeights.js';

export async function   evaluateViolations({ hasInvite, matchedWord, everyonePing, isGeneralSpam,isDuplicateSpam, isMediaViolation, isNewUser }) {
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
  if (isGeneralSpam) {
    violations.push({ type: 'spam', reason: 'Spamming' });
  }
  if(isDuplicateSpam){
    violations.push({type: 'spam', reason: 'Spamming the same message'})
  }
  if (isMediaViolation) {
    violations.push({ type: 'mediaViolation', reason: 'Media violation' });
  }
  if(isNewUser){
    violations.push({type: 'isNewUser', reason: 'while new to the server.'})
  }

  if (violations.length === 0) return null;

  // Find the most severe violation
  const sorted = violations.sort(
    (a, b) => (violationWeights[b.type] || 0) - (violationWeights[a.type] || 0)
  );
  return {
    allReasons: violations.map(v => v.reason),
    primaryType: sorted[0].type,
    violations
  };
}
