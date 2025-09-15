// utilities/botReloader.js
import { pathToFileURL, fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import path from 'node:path';
import fs from 'node:fs/promises'

const currentFileDir = path.dirname(fileURLToPath(import.meta.url)); // C:\Users\micha\Desktop\Bot\utilities
const botRoot = path.resolve(currentFileDir, '..'); // C:\Users\micha\Desktop\Bot

//list events needing client
const eventsNeedingClient = new Set([
    'messageCreate'
]);

const getModuleExports = (module) => {
    if (module.default && typeof module.default === 'object') {
        return module.default;
    }
    // Otherwise, return the module itself (for named exports)
    return module;
};

export async function loadCommands(client) {
    const guildIds = client.guilds.cache.map(guild => guild.id);
    console.log('loading commands...');
    client.commands.clear();

    return new Promise((resolve, reject) => {
        let commandsPath = path.join(botRoot, 'commands');
        const worker = new Worker('./utilities/worker.js', { type: 'module' });

        worker.postMessage({
            globalCommandsPath: commandsPath,
            guildIds: guildIds,
            botRoot: botRoot
        });

        worker.on('message', async (msg) => {
            if (msg.success) {
                try {
                    for (const filePath of msg.globalData) {
                        const command = await import(pathToFileURL(filePath).href)
                        if (command?.data?.name && typeof command.execute === 'function') {
                            client.commands.set(command.data.name, command);
                        } else {
                            console.warn(`[WARN] Invalid command file during reload: ${filePath}`);
                        }


                    }
                    console.log('✅ Global commands loaded successfully.');
                    for (const guildId in msg.guildData) {
                        for (const filePath of msg.guildData[guildId]) {
                            const command = await import(pathToFileURL(filePath).href)
                            if (command.data.name && typeof command.execute === 'function')
                                client.commands.set(command.data.name, command)
                            else
                                console.warn(`[WARN] Invalid command file during reload: ${filePath}`);
                        }
                    }
                    resolve();
                } catch (err) {
                    console.error('❌ Error during command reload:', err);
                    reject(err);
                }
            } else {
                reject(new Error(msg.error));
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
            if (dirent.isDirectory()) {
                filePaths.push(...(await findFiles(fullPath)));
            } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
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
    for (const filePath of filePaths) {
        try {
            let listenerModule = await import(pathToFileURL(filePath).href);
            const listeners = getModuleExports(listenerModule);

            for (const [eventName, listenerFunc] of Object.entries(listeners)) {
                if (typeof listenerFunc !== 'function') {
                    console.warn(`[WARN] Export "${eventName}" in ${filePath} is not a function`);
                    continue;
                }
                let boundListener;
                if (eventsNeedingClient.has(eventName))
                    boundListener = (...args) => listenerFunc(client, ...args);
                else
                    boundListener = (...args) => listenerFunc(...args)
                client.removeAllListeners(eventName)
                client.on(eventName, boundListener);
                console.log(`✅ Registered listener for event: ${eventName} from ${filePath}`);
            }
        } catch (err) {
            console.log(err);
        }
    }
    console.log('✅ Listeners loaded successfully.');
}

