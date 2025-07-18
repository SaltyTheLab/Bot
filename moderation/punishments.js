export function getNextPunishment(weightedWarns) {
    const punishments = [
        '1 Warn',
        '15 min mute',
        '30 min mute',
        '45 min mute',
        '1 hour mute',
        '2 hour mute',
        '4 hour mute',
        '6 hour mute'
    ]
      const index =  Math.min(Math.floor(weightedWarns), punishments.length);
      return punishments[index];
}