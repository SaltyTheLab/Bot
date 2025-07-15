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
        console.log('warnings before muteEscalation:', warnings instanceof Map);

        await muteEscalation(message, client, warnings, forbbidenWords);
    } else if (warnCommand) {
        await warnCommand.execute(fakeInteraction);
        await message.delete();
    } else {
        console.warn('⚠️ Warn command not found.');
    }
}
