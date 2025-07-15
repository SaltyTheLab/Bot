import { buildFakeInteraction } from './fakeinteraction.js';
import { THRESHOLD } from './constants.js';
import { muteEscalation } from './muteescalation.js';
import { BASE_DURATION, MAX_DURATION } from './constants.js';



function formatDuration(ms) {
    if (!ms || typeof ms !== 'number' || ms <= 0) return 'N/A';

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    const parts = [];

    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (remainingMinutes > 0) parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(', ') : 'less than a minute';
}
export async function handleAutoMod(message, client, reasonText, warnings, forbbidenWords) {
    const now = Date.now();
    const allWarnings = warnings.get(message.author) ?? [];
    let activeWarnings = allWarnings.filter(w => now - w.timestamp < THRESHOLD);
    let nextpunishment = Math.min(
        BASE_DURATION * 2 ** Math.max(activeWarnings.length - 1, 0),
        MAX_DURATION

    );
    const convertedpunishment = formatDuration(nextpunishment);
        activeWarnings.push({ timestamp: now });
    warnings.set(message.author, activeWarnings);

    const warnCommand = client.commands.get('warn');
    const fakeInteraction = buildFakeInteraction(client, message, reasonText, nextpunishment);
    fakeInteraction.nextPunishment = convertedpunishment;
    fakeInteraction.activeWarnings = activeWarnings.length;

    if (activeWarnings.length >= 2) {
        await muteEscalation(message, client, warnings, forbbidenWords);
    } else if (warnCommand) {
        await warnCommand.execute(fakeInteraction);
    } else {
        console.warn('⚠️ Warn command not found.');
    }
    try {
        await message.delete();
    } catch (error) {
        console.error('Failed to delete message:', error);
    }
} 
