import { buildFakeInteraction } from './fakeinteraction.js';
import { THRESHOLD } from './constants.js';
import { muteEscalation } from './muteescalation.js';

export async function handleAutoMod(message, client, reasonText, warnings, forbbidenWords) {
    const now = Date.now();
    const allWarnings = warnings.get(message.author) ?? [];
    let activeWarnings = allWarnings.filter(w => now - w.timestamp < THRESHOLD);

    activeWarnings.push({ timestamp: now });
    warnings.set(message.author, activeWarnings);

    const warnCommand = client.commands.get('warn');
    const fakeInteraction = buildFakeInteraction(client, message, reasonText);

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
        if (error.code === 10008) {
            // Message already deleted, ignore
            console.warn('Message was already deleted, skipping.');
        } else {
            // rethrow or log other errors
            console.error('Failed to delete message:', error);
        }
    }
} 
