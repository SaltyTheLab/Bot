import { REST, Routes } from 'discord.js';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findFiles } from './utilities/fileeditors.js';
import { CLIENT_ID, TOKEN } from './index.js';
import { Worker } from 'node:worker_threads'

async function getCommandData(filePaths) {
    const fullmodule = [];
    const jsonPayloads = []
    for (const filePath of filePaths) {
        const command = await import(pathToFileURL(filePath).href);
        if (command?.data?.name && typeof command.execute === 'function') {
            fullmodule.push(command);
            jsonPayloads.push(command.data.toJSON())
        } else
            console.warn(`⚠️ Skipping invalid command file: ${basename(filePath)} (missing 'data' or 'execute' property).`);
    }
    return { modules: fullmodule, jsonPayloads: jsonPayloads }
}

export async function loadCommandsToClient(commands, guildIds) {
    if (!TOKEN || !CLIENT_ID) { console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.'); return; }
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const botRoot = resolve(dirname(fileURLToPath(import.meta.url)));
    const worker = new Worker(resolve(botRoot, './utilities/worker.js'), { type: 'module' });
    commands.clear();
    const msg = await new Promise((resolve, reject) => {
        worker.postMessage({ globalCommandsPath: 'commands', guildIds: guildIds, botRoot: botRoot });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => { if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`)); });
    });
    if (!msg.success) throw new Error(`Worker failed to load command files: ${msg.error}`);
    const guildRegistrationData = {}
    const globalProcessed = await getCommandData(msg.globalData);
    for (const command of globalProcessed.modules)
        commands.set(command.data.name, command);
    for (const guildId in msg.guildData) {
        const guildProcessed = await getCommandData(msg.guildData[guildId]);
        for (const command of guildProcessed.modules)
            commands.set(`${guildId}:${command.data.name}`, command);
        guildRegistrationData[guildId] = guildProcessed.jsonPayloads;
    }
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: globalProcessed.jsonPayloads });
    const guildPromises = guildIds.map(async guildId => {
        const payload = guildRegistrationData[guildId]
        if (payload.length > 0) await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: payload });
    });
    await Promise.allSettled(guildPromises);
};

export async function loadListeners(client) {
    console.log('loading listeners...');
    const eventsNeedingClient = new Set([
        'messageCreate'
    ]);
    for (const filePath of await findFiles("BotListeners")) {
        const listeners = await import(pathToFileURL(filePath).href).default || await import(pathToFileURL(filePath).href);
        for (const [eventName, listenerFunc] of Object.entries(listeners)) {
            let boundListener;
            eventsNeedingClient.has(eventName) ?
                boundListener = (...args) => listenerFunc(client, ...args)
                : boundListener = (...args) => listenerFunc(...args);
            client.removeAllListeners(eventName);
            client.on(eventName, boundListener);
        }
    }
    console.log('✅ Listeners loaded successfully.');
}