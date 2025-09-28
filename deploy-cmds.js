import { REST, Routes } from 'discord.js';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLIENT_ID, GUILD_ID, TOKEN } from './index.js';
import { Worker } from 'node:worker_threads'
import fs from 'node:fs/promises'

const botRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));



async function getCommandData(filePaths) {
    const commandsData = [];

    for (const filePath of filePaths) {
        try {
            const commandModule = await import(pathToFileURL(filePath).href);
            const command = commandModule;

            if (command?.data?.name && typeof command.execute === 'function') {
                commandsData.push(command.data.toJSON());
            } else {
                console.warn(`⚠️ Skipping invalid command file: ${path.basename(filePath)} (missing 'data' or 'execute' property).`);
            }
        } catch (err) {
            console.error(`❌ Failed to import ${path.basename(filePath)}:`, err);
        }
    }

    return commandsData;
}

// ✅ Utility: Load all commands
export async function register() {
    if (!TOKEN || !CLIENT_ID) {
        console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const globalCommandsPath = path.join(botRoot, 'commands');
    // NOTE: This GUILD_ID list is purely for command deployment, not runtime data access.
    const guildIds = GUILD_ID ? GUILD_ID.split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id)) : [];

    try {
        const worker = new Worker(path.resolve(botRoot, './utilities/worker.js'), { type: 'module' });

        const msg = await new Promise((resolve, reject) => {
            worker.postMessage({
                globalCommandsPath: globalCommandsPath,
                guildIds: guildIds,
                botRoot: botRoot
            });
            worker.on('message', resolve);
            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
            });
        });
        if (!msg.success) {
            console.error('❌ Error from worker thread:', msg.error);
            return;
        }

        const globalCommandsJSON = await getCommandData(msg.globalData);
        console.log('test')
        // --- 1. Deploy Global Commands ---
        try {
            console.log('test b')
            const data = await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: globalCommandsJSON }
            );
            console.log('test c')
            console.log(`✅ Successfully loaded ${data.length} global application (/) commands.`);
        } catch (err) {
            console.error(`❌ Unable to register global commands with Discord API: `, err);
        }

        // --- 2. Deploy Guild-Specific Commands ---
        const guildPromises = guildIds.map(async guildId => {
            const guildCommandsPaths = msg.guildData[guildId] || [];
            const guildCommandsJSON = await getCommandData(guildCommandsPaths);

            try {
                const guildData = await rest.put(
                    Routes.applicationGuildCommands(CLIENT_ID, guildId),
                    { body: guildCommandsJSON }
                );
                console.log(`✅ Successfully registered ${guildData.length} application (/) commands for guild ${guildId}.`);
            } catch (error) {
                console.error(`❌ Error registering commands for guild ${guildId} with Discord API:`, error);
            }
        });

        await Promise.allSettled(guildPromises); // Use allSettled to ensure one guild failure doesn't stop others

    } catch (error) {
        console.error('❌ An error occurred during command registration process:', error);
    }
}


export async function loadCommandsToClient(client) {
    const guildIds = client.guilds.cache.map(guild => guild.id);
    console.log('loading commands...');
    console.log(`Target Guild IDs: [${guildIds.join(', ')}]`); // Log to confirm guild IDs are present
    client.commands.clear();

    return new Promise((resolve, reject) => {
        const commandsPath = path.join(botRoot, 'commands');
        const worker = new Worker(path.resolve(botRoot, './utilities/worker.js'), { type: 'module' });

        worker.postMessage({
            globalCommandsPath: commandsPath,
            guildIds: guildIds,
            botRoot: botRoot
        });

        worker.on('message', async (msg) => {
            try {
                if (msg.success) {
                    // --- 1. Load Global Commands ---
                    for (const filePath of msg.globalData) {
                        try {
                            const command = await import(pathToFileURL(filePath).href);
                            if (command?.data?.name && typeof command.execute === 'function') {
                                client.commands.set(command.data.name, command);
                                console.log(`registered global command ${command.data.name}`)
                            } else {
                                console.warn(`[WARN] Invalid global command file during reload: ${filePath}`);
                            }
                        } catch (err) {
                            console.error(`❌ Error importing global command file ${filePath}:`, err);
                        }
                    }

                    for (const guildId in msg.guildData) {
                        console.log(`Loading commands for guild: ${guildId}`) // Your 'test' log is now more descriptive
                        const guildCommandPaths = msg.guildData[guildId];

                        for (const filePath of guildCommandPaths) {
                            try { // Added robust try/catch for import
                                const command = await import(pathToFileURL(filePath).href);
                                if (command.data.name && typeof command.execute === 'function') {
                                    const key = `${guildId}:${command.data.name}`
                                    client.commands.set(key, command);
                                    console.log(`registered guild command ${command.data.name}`)
                                } else
                                    console.warn(`[WARN] Invalid guild command file during reload: ${filePath}`);
                            } catch (err) {
                                console.error(`❌ Error importing guild command file ${filePath}:`, err);
                            }
                        }
                    }
                    resolve();
                } else {
                    reject(new Error(msg.error));
                }
            } catch (err) {
                console.error('❌ CRITICAL: Error during worker message processing:', err);
                reject(err);
            }
        });
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
}

async function findFiles(dir) {
    const filePaths = [];
    try {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
            const fullPath = path.join(dir, dirent.name);
            if (dirent.isFile() && dirent.name.endsWith('.js')) {
                filePaths.push(fullPath);
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`❌ Error reading directory ${dir}:`, error);
        }
    }
    return filePaths;
}
export async function loadListeners(client) {
    console.log('loading listeners...');
    const listenersPath = path.join(botRoot, 'Botlisteners');
    const filePaths = await findFiles(listenersPath);
    const eventsNeedingClient = new Set([
        'messageCreate'
    ]);

    for (const filePath of filePaths) {
        try {
            const listenerModule = await import(pathToFileURL(filePath).href);
            const listeners = listenerModule.default || listenerModule;

            for (const [eventName, listenerFunc] of Object.entries(listeners)) {
                if (typeof listenerFunc !== 'function') {
                    console.warn(`[WARN] Export "${eventName}" in ${filePath} is not a function`);
                    continue;
                }

                let boundListener;
                if (eventsNeedingClient.has(eventName)) {
                    boundListener = (...args) => listenerFunc(client, ...args);
                } else {
                    boundListener = (...args) => listenerFunc(...args);
                }

                client.removeAllListeners(eventName);
                client.on(eventName, boundListener);
                console.log(`✅ Registered listener for event: ${eventName} from ${filePath}`);
            }
        } catch (err) {
            console.error(`❌ Failed to load listener file ${filePath}:`, err);
        }
    }
    console.log('✅ Listeners loaded successfully.');
}