// utilities/botReloader.js
import { pathToFileURL, fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import path from 'node:path';
import register from "../deploy-cmds.js";

// --- Calculate botRoot relative to this file ---
const currentFileDir = path.dirname(fileURLToPath(import.meta.url)); // C:\Users\micha\Desktop\Bot\utilities
const botRoot = path.resolve(currentFileDir, '..'); // C:\Users\micha\Desktop\Bot

// Function to dynamically import and bust cache for ES Modules
export async function importAndBustCache(filePath) {
    const moduleUrl = pathToFileURL(filePath).href + `?update=${Date.now()}`;
    return await import(moduleUrl);
}

// ---This map will store the actual function references passed to client.on ---
// Map: eventName (string) -> Set<function_reference>
const activeListeners = new Map();


const eventsNeedingClient = new Set([
    'messageCreate'
]);


async function loadAndRegisterListener(client, filePath) {
    let listenerModule;
    try {
        listenerModule = await importAndBustCache(filePath);
    } catch (err) {
        console.warn(`[WARN] Failed to import ${filePath}:`, err);
        return;
    }

    if (!listenerModule || typeof listenerModule !== 'object') {
        console.warn(`[WARN] Skipping invalid listener module: ${filePath}`);
        return;
    }

    for (const [eventName, listenerFunc] of Object.entries(listenerModule)) {
        if (typeof listenerFunc !== 'function') {
            console.warn(`[WARN] Export "${eventName}" in ${filePath} is not a function`);
            continue;
        }

        let boundListener;
        if (eventsNeedingClient.has(eventName)) {
            // If the event is in eventsNeedingClient, pass the client object as the first argument
            boundListener = (...args) => listenerFunc(client, ...args);
        } else {
            // Otherwise, just pass the original arguments directly
            boundListener = (...args) => listenerFunc(...args);

        }

        // Add the listener
        client.on(eventName, boundListener);

        // Store this reference for future removal
        if (!activeListeners.has(eventName)) {
            activeListeners.set(eventName, new Set());
        }
        activeListeners.get(eventName).add(boundListener);

        console.log(`✅ Registered listener for event: ${eventName} from ${filePath}`);
    }
}

export async function reloadCommands(client) {
    console.log('Reloading commands...');
    client.commands.clear();

    return new Promise((resolve, reject) => {
        const commandsPath = path.join(botRoot, 'commands');
        // --- register them to the api ---
        register();
        const worker = new Worker('./utilities/worker.js', { type: 'module' });

        worker.postMessage(commandsPath);

        worker.on('message', async (msg) => {
            if (msg.success) {
                try {
                    for (const filePath of msg.data) {

                        const command = await importAndBustCache(filePath);
                        if (command?.data?.name && typeof command.execute === 'function') {
                            client.commands.set(command.data.name, command);
                        } else {
                            console.warn(`[WARN] Invalid command file during reload: ${filePath}`);
                        }
                    }
                    console.log('✅ Commands reloaded successfully.');
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

export async function reloadListeners(client) {
    console.log('Reloading listeners...');
    // --- Remove all previously registered custom listeners by iterating ---
    for (const [eventName, handlersSet] of activeListeners.entries()) {
        // For each event, iterate through the Set of handler functions stored for that event
        for (const handler of handlersSet) {
            client.removeListener(eventName, handler);
            console.log(`🗑️ Removed old listener for event: ${eventName}`);
        }
        // After removing all handlers for this event, clear the Set to prepare for new ones
        handlersSet.clear();
    }

    // --- Load and register new listeners ---
    return new Promise((resolve, reject) => {
        const listenersPath = path.join(botRoot, 'BotListeners');
        const worker = new Worker('./utilities/worker.js', { type: 'module' });

        worker.postMessage(listenersPath);

        worker.on('message', async (msg) => {
            if (msg.success) {
                try {
                    for (const filePath of msg.data) {
                        await loadAndRegisterListener(client, filePath);
                    }
                    console.log('✅ Listeners reloaded successfully.');
                    resolve();
                } catch (err) {
                    console.error('❌ Error during listener reload:', err);
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