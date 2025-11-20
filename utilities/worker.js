import { parentPort } from 'node:worker_threads'
import { findFiles } from './fileeditors.js';
parentPort.on('message', async (msg) => {
    try {
        const { globalCommandsPath, guildIds, botRoot } = msg;
        const guildPaths = {};
        for (const guildId of guildIds)
            guildPaths[guildId] = await findFiles(`${botRoot}/commands/${guildId}`)
        const globalPaths = await findFiles(globalCommandsPath)
        parentPort.postMessage({
            success: true,
            globalPaths: globalPaths,
            guildPaths: guildPaths
        });
    } catch (err) {
        console.error('--- WORKER CRASHED ---');
        console.error('Error in worker thread:', err);
        console.error('-----------------------');
        parentPort.postMessage({ success: false, error: err.message });
    }
}
);
