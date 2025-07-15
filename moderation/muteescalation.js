import * as constants from './constants.js';
import fs from "node:fs"
import { logRecentCommand } from '../Logging/recentcommands.js'; // adjust path as needed
const forbiddenWords = JSON.parse(fs.readFileSync('./moderation/forbiddenwords.json', 'utf-8')).forbiddenWords;

/**
 * Escalates to mute a user based on warnings.
 * @param {Message} message - The original message triggering the mute.
 * @param {Client} client - The Discord client instance.
 * @param {string} reasonText - The reason for the mute (e.g. forbidden word, media spam).
 * @param {Map()} warnings - A shared Map of user warnings.
 * @param {string[]} forbiddenWords - An array of forbidden word strings.
 */

export async function muteEscalation(message, client, warnings) {
    const target = message.author;
    const muteCommand = client.commands.get('mute');
    const member = message.guild.members.cache.get(target.id);

    if (!muteCommand) {
        console.warn('⚠️ Mute command not found.');
        return;
    }
    if (!member) {
        console.warn(`⚠️ Member not found for ID ${target.id}`);
        return;
    }
    if (member.isCommunicationDisabled()) {
        console.warn(`⚠️ ${target.tag} is already muted.`);
        return;
    }


    const now = Date.now();
    const allWarnings = warnings.get(target) ?? [];
    const activeWarnings = allWarnings.filter(warn => now - warn.timestamp < constants.THRESHOLD);

    const escalationDurationMs = Math.min(
        constants.BASE_DURATION * 2 ** Math.max(activeWarnings.length - 1, 0),
        constants.MAX_DURATION
    );

    const durationMinutes = Math.floor(escalationDurationMs / 60000);
    const convertedUnit = durationMinutes >= 60 ? 'hours' : 'minutes';
    const finalDuration = convertedUnit === 'hours' ? durationMinutes / 60 : durationMinutes;

    const matchedWord = forbiddenWords.find(word =>
        message.content.toLowerCase().includes(word.toLowerCase())
    ) || 'unknown';

    const reasonText = `AutoMod: Forbidden word "${matchedWord}"`;

    const fakeInteraction = {
        guild: message.guild,
        member: message.member,
        user: client.user,
        channel: message.channel,
        options: {
            getUser: key => key === 'target' ? target : null,
            getString: key =>
                key === 'reason' ? reasonText :
                    key === 'unit' ? convertedUnit : null,
            getInteger: key => key === 'duration' ? finalDuration : null,
        },
        replied: false,
        deferred: false,
        reply: async (response) => {
            await message.channel.send(typeof response === 'string' ? { content: response } : response);
        },
    };

    logRecentCommand(`mute: ${target.tag} - ${reasonText} - ${finalDuration} ${convertedUnit} - issuer: ${client.user.tag}`);
    await muteCommand.execute(fakeInteraction);
}
