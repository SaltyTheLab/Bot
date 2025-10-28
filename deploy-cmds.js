import { REST, Routes } from 'discord.js';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdir } from 'node:fs/promises';
import { CLIENT_ID, TOKEN } from './index.js';
import { Worker } from 'node:worker_threads'

const botRoot = resolve(dirname(fileURLToPath(import.meta.url)));

async function getCommandData(filePaths) {
    const commandsData = [];
    for (const filePath of filePaths) {
        const command = await import(pathToFileURL(filePath).href);
        if (command?.data?.name && typeof command.execute === 'function') {
            commandsData.push(command.data.toJSON());
        } else {
            console.warn(`⚠️ Skipping invalid command file: ${basename(filePath)} (missing 'data' or 'execute' property).`);
        }
    }
    return commandsData;
}

export async function register(guildIds) {
    if (!TOKEN || !CLIENT_ID) { console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.'); return; }
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const worker = new Worker('C:/Users/micha/Desktop/Bot/utilities/worker.js', { type: 'module' });
    const msg = await new Promise((resolve, reject) => {
        worker.postMessage({ globalCommandsPath: 'commands', guildIds: guildIds, botRoot: botRoot });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => { if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`)); });
    });
    if (!msg.success) { console.error('❌ Error from worker thread:', msg.error); return; }
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: await getCommandData(msg.globalData) });
    const guildPromises = guildIds.map(async guildId => {
        if (msg.guildData[guildId].length > 0) await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: await getCommandData(msg.guildData[guildId]) });
    });
    await Promise.allSettled(guildPromises);
}
export async function loadCommandsToClient(client) {
    client.commands.clear();
    const worker = new Worker(resolve(botRoot, './utilities/worker.js'), { type: 'module' });
    const msg = await new Promise((resolve, reject) => {
        worker.postMessage({ globalCommandsPath: 'commands', guildIds: client.guilds.cache.map(guild => guild.id), botRoot: botRoot });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => { if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`)); });
    });
    if (!msg.success) throw new Error(`Worker failed to load command files: ${msg.error}`);

    for (const filePath of msg.globalData) {
        const command = await import(pathToFileURL(filePath).href);
        if (command?.data?.name && typeof command.execute === 'function')
            client.commands.set(command.data.name, command);
        else
            console.warn(`[WARN] Invalid global command file during reload: ${filePath}`);
    }
    for (const guildId in msg.guildData) {
        for (const filePath of msg.guildData[guildId]) {
            const command = await import(pathToFileURL(filePath).href);
            if (command.data.name && typeof command.execute === 'function')
                client.commands.set(`${guildId}:${command.data.name}`, command);
            else
                console.warn(`[WARN] Invalid guild command file during reload: ${filePath}`);
        }
    }
};
export async function findFiles(dir) {
    const filePaths = [];
    for (const dirent of await readdir(dir, { withFileTypes: true })) {
        if (dirent.isFile() && dirent.name.endsWith('.js'))
            filePaths.push(join(dir, dirent.name));
    }
    return filePaths;
}
export async function loadListeners(client) {
    console.log('loading listeners...');
    const eventsNeedingClient = new Set([
        'messageCreate'
    ]);

    for (const filePath of await findFiles("BotListeners")) {
        const listeners = await import(pathToFileURL(filePath).href).default || await import(pathToFileURL(filePath).href);
        for (const [eventName, listenerFunc] of Object.entries(listeners)) {
            if (typeof listenerFunc !== 'function') {
                console.warn(`[WARN] Export "${eventName}" in ${filePath} is not a function`);
                continue;
            }
            let boundListener;
            if (eventsNeedingClient.has(eventName))
                boundListener = (...args) => listenerFunc(client, ...args);
            else
                boundListener = (...args) => listenerFunc(...args);
            client.removeAllListeners(eventName);
            try {
                client.on(eventName, boundListener);
            } catch (err) {
                console.warn(`Error registering listener for event ${eventName} from ${filePath}: `, err)
            }
        }
    }
    console.log('✅ Listeners loaded successfully.');
}