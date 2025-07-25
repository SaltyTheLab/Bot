export function getNextPunishment(weightedWarns, { next = false } = {}) {

    const punishmentStages = [
        { label: '1 warn', minutes: 0 },
        { label: '15 min mute', minutes: 0 },
        { label: '30 min mute', minutes: 15 },
        { label: '45 min mute', minutes: 30 },
        { label: '1 hour mute', minutes: 45 },
        { label: '2 hour mute', minutes: 60 },
        { label: '4 hour mute', minutes: 120 },
        { label: '6 hour mute', minutes: 240 },
        { label: '6 hour mute', minutes: 360 }

    ];

    let index = Math.floor(weightedWarns);
    if (next) index++;
    if (index < 0) index = 0;
    if (index >= punishmentStages.length) {
        index = punishmentStages.length - 1;
    }
    let stage = punishmentStages[index];
    const { label, minutes } = stage;
    const unit = minutes >= 60 ? 'hour' : 'min';
    const duration = unit === 'hour' ? Math.ceil(minutes / 60) : minutes;

    return {
        duration,
        unit,
        label,
        minutes
    };
}
