export function getNextPunishment(warningCount) {
    const punishments = [
        '1 Warn',
        '15 min mute',
        '30 min mute',
        '1 hour mute',
        '2 hour mute',
        '4 hour mute',
        '6 hour mute',
    ]
      return punishments[Math.min(warningCount, punishments.length - 1)];
}