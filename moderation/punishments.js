export function getNextPunishment(weightedWarns, { next = false, context = 'automod' } = {}) {
    const punishments = [
        '1 Warn', '15 min mute', '30 min mute', '45 min mute',
        '1 hour mute', '2 hour mute', '4 hour mute', '6 hour mute'
    ];
    const durationMinutes = [0, 15, 30, 45, 60, 120, 240, 360];

    let index = Math.floor(weightedWarns);
    if (next) index += 1;

    index = Math.max(0, Math.min(index, punishments.length - 1));

    const minutes = durationMinutes[index];
    const unit = minutes >= 60 ? 'hour' : 'min';
    const duration = unit === 'hour' ? Math.ceil(minutes / 60) : minutes;
    const label = punishments[index];

    return {
        duration,
        unit,
        label,
        asString: label
    };
}
