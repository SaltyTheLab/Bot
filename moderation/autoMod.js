
import { THRESHOLD, BASE_DURATION, MAX_DURATION } from './constants.js';
import { addWarn, getActiveWarns } from '../Logging/database.js';
import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';



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
export async function handleAutoMod(message, client, reasonText) {
    const now = Date.now();
    if (reasonText === 'AutoMod: Discord invite detected' || reasonText === 'AutoMod: Mass ping') {
        await addWarn(message.author.id, client.user.tag, reasonText);
        await addWarn(message.author.id, client.user.tag, reasonText);
    }

    const warnCommand = client.commands.get('warn');
    const allWarnings = await getActiveWarns(message.author.id);
    const activeWarnings = allWarnings.filter(w => now - w.timestamp < THRESHOLD);
    let currentPunishment = Math.min(
        BASE_DURATION * 2 ** Math.max(activeWarnings.length, 0),
        MAX_DURATION);
    let unit = 'min'; // default to minutes
    if (currentPunishment >= 86400000) {
        unit = 'day';
    } else if (currentPunishment >= 3600000) {
        unit = 'hour';
    }
    const durationInUnits = Math.ceil(currentPunishment / (unit === 'day' ? 86400000 : unit === 'hour' ? 3600000 : 60000));


    console.log(
        reasonText,
        currentPunishment,
        durationInUnits,
        activeWarnings.length,
        unit,
    )

    if (activeWarnings.length >= 1) {
        await muteUser({
            guild: message.guild,
            targetUser: message.author.id,
            moderatorUser: client.user, // AutoMod is issuing the punishment
            reason: reasonText,
            duration: durationInUnits,
            unit,
            channel: message.channel,
            isAutomated: true
        });
    } else if (warnCommand) {
        await warnUser({
            guild: message.guild,
            targetUser: message.author.id,
            moderatorUser: client.user,
            reason: reasonText,
            channel: message.channel
        });

    } else {
        console.warn('⚠️ Warn command not found.');
    }
    try {
        await message.delete();
    } catch (error) {
        console.error('Failed to delete message:', error);
    }
} 
