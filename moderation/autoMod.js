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

    if (reasonText === 'AutoMod: Discord invite detected' || reasonText === 'AutoMod: Mass ping') {
        await addWarn(message.author.id, client.user.tag, reasonText);
        await addWarn(message.author.id, client.user.tag, reasonText);
    }

    const allWarnings = await getWarns(message.author.id);
    let activeWarnings = allWarnings.filter(w => now - w.timestamp < THRESHOLD);
    const MAX_TIMEOUT_MS = 2419200000;

    let nextpunishment = Math.min(
        BASE_DURATION * 2 ** Math.max(activeWarnings.length, 0),
        MAX_DURATION

    );
    let unit = 'm'
    if (nextpunishment >= 86400000) {
        unit = 'd';
    }
    else if (nextpunishment >= 3600000) {
        unit = 'h'

    } else
        unit = 'm';
    if (nextpunishment > MAX_TIMEOUT_MS)
        nextpunishment = MAX_TIMEOUT_MS

    const convertedpunishment = formatDuration(nextpunishment);
    const warnCommand = client.commands.get('warn');
    const muteCommand = client.commands.get('mute');

    const durationInUnits = Math.floor(nextpunishment / (unit === 'd' ? 86400000 : unit === 'h' ? 3600000 : 60000));

    function buildFakeInteraction(client, message, reason, duration, unit) {
        return {
            client,
            guild: message.guild,
            channel: message.channel,
            user: client.user, // or some moderator user
            member: message.member,
            options: {
                getUser: (name) => (name === 'target' ? message.author : null),
                getString: (name) => {
                    if (name === 'reason') return reason;
                    if (name === 'unit') return unit;
                    return null;
                },
                getInteger: (name) => {
                    if (name === 'duration') return duration; // 🔥 CRUCIAL: return number, not string
                    return null;
                }
            },
            editReply: async (data) => {
                console.log('[FAKE] editReply:', data);
            },
            deferReply: async () => {
                console.log('[FAKE] deferReply called');
            },
            fetchReply: async () => {
                return { content: 'Fake reply content' };
            },
            guildId: message.guild.id,
        };
    }

    if (activeWarnings.length >= 1) {
        await muteCommand.execute( buildFakeInteraction(client, message, reason, duration, warningCount, unit));
    } else if (warnCommand) {
        await warnCommand.execute(buildFakeInteraction(client, message, reason, duration, warningCount, unit));
    } else {
        console.warn('⚠️ Warn command not found.');
    }
    try {
        await message.delete();
    } catch (error) {
        console.error('Failed to delete message:', error);
    }
} 
