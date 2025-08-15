// utilities/botReloader.js
import { pathToFileURL, fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import path from 'node:path';

// --- Calculate botRoot relative to this file ---
const currentFileDir = path.dirname(fileURLToPath(import.meta.url)); // C:\Users\micha\Desktop\Bot\utilities
const botRoot = path.resolve(currentFileDir, '..'); // C:\Users\micha\Desktop\Bot

// ---This map will store the actual function references passed to client.on ---
// Map: eventName (string) -> Set<function_reference>
const activeListeners = new Map();

//list events needing client
const eventsNeedingClient = new Set([
    'messageCreate'
]);

export async function loadCommands(client) {
    console.log('loading commands...');
    return new Promise((resolve, reject) => {
        const commandsPath = path.join(botRoot, 'commands');
        const worker = new Worker('./utilities/worker.js', { type: 'module' });

        worker.postMessage(commandsPath);

        worker.on('message', async (msg) => {
            if (msg.success) {
                try {
                    for (const filePath of msg.data) {
                        const command = await import(pathToFileURL(filePath).href)
                        if (command?.data?.name && typeof command.execute === 'function') {
                            client.commands.set(command.data.name, command);
                        } else {
                            console.warn(`[WARN] Invalid command file during reload: ${filePath}`);
                        }
                    }
                    console.log('✅ Commands loaded successfully.');
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

export async function loadListeners(client) {
    console.log('loading listeners...');
    // --- Load and register listeners ---
    return new Promise((resolve, reject) => {
        const listenersPath = path.join(botRoot, 'BotListeners');
        const worker = new Worker('./utilities/worker.js', { type: 'module' });

        worker.postMessage(listenersPath);

        worker.on('message', async (msg) => {
            if (msg.success) {
                try {
                    for (const filePath of msg.data) {
                        let listenerModule = await import(pathToFileURL(filePath).href);

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