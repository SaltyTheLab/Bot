import { buildFakeInteraction } from './fakeinteraction.js';
import { THRESHOLD, BASE_DURATION, MAX_DURATION } from './constants.js';
import { addWarn, getWarns } from '../Logging/database.js';



export function formatDuration(ms) {
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
    const MAX_TIMEOUT_MS = 2419200000;
    if (reasonText === 'AutoMod: Discord invite detected' || reasonText === 'AutoMod: Mass ping') {
        await addWarn(message.author.id, client.user.tag, reasonText);
        await addWarn(message.author.id, client.user.tag, reasonText);
    }

    const allWarnings = await getWarns(message.author.id);
    const activeWarnings = allWarnings.filter(w => now - w.timestamp < THRESHOLD);

    let currentPunishment = Math.min(
        BASE_DURATION * 2 ** Math.max(activeWarnings.length, 0),
        MAX_DURATION);
    let unit = 'm'; // default to minutes
    if (currentPunishment >= 86400000) {
        unit = 'd';
    } else if (currentPunishment >= 3600000) {
        unit = 'h';
    }
    const convertedpunishment = formatDuration(currentPunishment);
    const durationInUnits = Math.floor(currentPunishment / (unit === 'd' ? 86400000 : unit === 'h' ? 3600000 : 60000));


    const warnCommand = client.commands.get('warn');
    const muteCommand = client.commands.get('mute');


    const fakeInteraction = buildFakeInteraction(
        client,
        message,
        reasonText,
        durationInUnits,
        activeWarnings.length,
        unit,
        durationInUnits
    );


    console.log(durationInUnits, activeWarnings.length, unit, convertedpunishment);

    if (activeWarnings.length >= 1) {
        await muteCommand.execute(fakeInteraction);
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
