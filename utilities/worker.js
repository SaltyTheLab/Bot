import { parentPort } from 'node:worker_threads';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
async function findFiles(dir) {
  const filePaths = []
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = join(dir, dirent.name);
      if (dirent.isFile() && dirent.name.endsWith('.js'))
        filePaths.push(fullPath);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`❌ Error reading directory ${dir}:`, err);
    }
  }
  return filePaths;
}

parentPort.on('message', async (msg) => {
  try {
    const { globalCommandsPath, guildIds, botRoot } = msg;
    const globalFilePaths = await findFiles(resolve(botRoot, globalCommandsPath));
    const guildCommands = {};
    for (const guildId of guildIds) {
      const guildCommandsPath = join(botRoot, 'commands', 'guilds', guildId);
      guildCommands[guildId] = await findFiles(guildCommandsPath)
    }
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
