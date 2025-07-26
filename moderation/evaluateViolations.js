
export async function evaluateViolations({ hasInvite, matchedWord, everyonePing, isGeneralSpam, isDuplicateSpam, isMediaViolation, isNewUser, isCapSpam }) {
  const checks = [
    { flag: hasInvite, type: 'invite', reason: 'Discord invite' },
    { flag: matchedWord, type: 'forbiddenWord', reason: `Forbidden word "${matchedWord}"` },
    { flag: everyonePing, type: 'everyonePing', reason: 'Mass ping' },
    { flag: isGeneralSpam, type: 'spam', reason: 'Spamming' },
    { flag: isDuplicateSpam, type: 'spam', reason: 'Spamming the same message' },
    { flag: isMediaViolation, type: 'mediaViolation', reason: 'Media violation' },
    { flag: isNewUser, type: 'isNewUser', reason: 'while new to the server.' },
    {flag: isCapSpam, type: 'CapSpam', reason: 'Spamming Caps' }
  ];

  const violations = checks
    .filter(check => check.flag)
    .map(({ type, reason }) => ({ type, reason }));

  if (violations.length === 0) return null;

  return {
    allReasons: violations.map(v => v.reason),
    violations
  };
}
