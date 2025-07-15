export function getNextPunishment(warningCount) {
    const punishments = [
        'Warning',
        '15 min mute',
        '30 min mute',
        '1 hour mute',
        '2 hour mute',
        '4 hour mute',
        '6 hour mute',
    ]
    return punishments[warningCount];
}