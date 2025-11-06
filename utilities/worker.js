import { parentPort } from 'node:worker_threads';
import { resolve } from 'node:path';
import { findFiles } from './fileeditors.js';

parentPort.on('message', async (msg) => {
  try {
    const { globalCommandsPath, guildIds, botRoot } = msg;
    const globalFilePaths = await findFiles(resolve(botRoot, globalCommandsPath));
    const guildCommands = {};
    for (const guildId of guildIds)
      guildCommands[guildId] = await findFiles(`${botRoot}/commands/${guildId}`)
    parentPort.postMessage({
      success: true,
      globalData: globalFilePaths,
      guildData: guildCommands
    });
  } catch (err) {
    console.error('--- WORKER CRASHED ---');
    console.error('Error in worker thread:', err);
    console.error('-----------------------');
    parentPort.postMessage({ success: false, error: err.message });
  }
}
);
