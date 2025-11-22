import { REST, Routes } from 'discord.js';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads'
async function getCommandData(filePaths) {
    const fullmodule = [];
    const jsonPayloads = [];
    for (const filePath of filePaths) {
        const command = await import(pathToFileURL(filePath).href);
        if (command.data && typeof command.execute === 'function') {
            fullmodule.push(command);
            jsonPayloads.push(command.data.toJSON());
        } else
            console.warn(`⚠️ Skipping invalid command file: ${basename(filePath)} (missing 'data' or 'execute' property).`);
    }
    return { fullmodule, jsonPayloads };
}
export async function loadCommandsToClient(commands, guildIds, token, clientid) {
    if (!token || !clientid) { console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.'); return; }
    const rest = new REST({ version: '10' }).setToken(token);
    const botRoot = resolve(dirname(fileURLToPath(import.meta.url)));
    const worker = new Worker(resolve(botRoot, './utilities/worker.js'), { type: 'module' });
    commands.clear();
    const msg = await new Promise((resolve) => {
        worker.on('message', resolve);
        worker.postMessage({ globalCommandsPath: 'commands', guildIds: guildIds, botRoot: botRoot });
    });
    if (!msg.success) throw new Error(`Worker failed to load command files: ${msg.error}`);

    const globalProcessed = await getCommandData(msg.globalPaths)
    globalProcessed.fullmodule.forEach(command => commands.set(command.data.name, command))
    rest.put(Routes.applicationCommands(clientid), { body: globalProcessed.jsonPayloads });

    for (const guildId in msg.guildPaths) {
        const guildProcessed = await getCommandData(msg.guildPaths[guildId]);
        guildProcessed.fullmodule.forEach(command => commands.set(`${guildId}:${command.data.name}`, command))
        if (guildProcessed.jsonPayloads.length > 0)
            rest.put(Routes.applicationGuildCommands(clientid, guildId), { body: guildProcessed.jsonPayloads });
    }
    worker.terminate();
}
