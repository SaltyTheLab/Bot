import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { embedsenders } from './embeds/embeds.js';
import EmbedIDs from './embeds/EmbedIDs.json' with { type: 'json' }

// Setup dotenv
config();

// Setup paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Discord client
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER']
});

client.commands = new Collection();

// Load commands dynamically
async function loadCommandsWithWorker() {
  return new Promise((resolve, reject) => {
    const commandsPath = path.join(__dirname, 'commands');
    const worker = new Worker('./utilities/worker.js', { type: 'module' });

    worker.postMessage(commandsPath);

    worker.on('message', async (msg) => {
      if (msg.success) {
        try {
          for (const filePath of msg.data) {
            const command = await import(pathToFileURL(filePath).href);
            if (command?.data?.name && typeof command.execute === 'function') {
              client.commands.set(command.data.name, command);
            } else {
              console.warn(`[WARN] Invalid command file: ${filePath}`);
            }
          }
          resolve();
        } catch (err) {
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

// Register Commands and listeners
async function loadListenersWithWorker() {
  return new Promise((resolve, reject) => {
    const listenersPath = path.join(__dirname, 'BotListeners');
    const worker = new Worker('./utilities/worker.js', { type: 'module' });

    worker.postMessage(listenersPath);

    worker.on('message', async (msg) => {
      if (msg.success) {
        try {
          for (const filePath of msg.data) {
            let listenerModule;
            try {
              listenerModule = await import(pathToFileURL(filePath).href);
            } catch (err) {
              console.warn(`[WARN] Failed to import ${filePath}:`, err);
              continue;
            }

            if (!listenerModule || typeof listenerModule !== 'object') {
              console.warn(`[WARN] Skipping invalid listener module: ${filePath}`);
              continue;
            }

            const eventsNeedingClient = new Set([
              'guildMemberAdd',
              'guildMemberRemove',
              'messageCreate'
            ]);

            for (const [eventName, listenerFunc] of Object.entries(listenerModule)) {
              if (typeof listenerFunc !== 'function') {
                console.warn(`[WARN] Export "${eventName}" in ${filePath} is not a function`);
                continue;
              }

              if (eventsNeedingClient.has(eventName))
                client.on(eventName, (...args) => listenerFunc(client, ...args));
              else
                client.on(eventName, (...args) => listenerFunc(...args));

              console.log(`✅ Registered listener for event: ${eventName}`);
            }
          }
          resolve();
        } catch (err) {
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

async function cacheInteractiveMessages(client) {
  console.log('Attempting to cache all stored embeds...'); // Updated log

  const cacheTasks = [];

  // Iterate directly through the main array from the imported JSON config
  if (Array.isArray(EmbedIDs)) {
    for (const embedInfo of EmbedIDs) {
      // Destructure name, messageId, AND channelid directly from each object
      const { name, messageId, channelid } = embedInfo;

      // Basic validation: ensure we have both IDs
      if (!messageId || !channelid) {
        console.warn(`⚠️ Skipping caching for embed '${name}': Missing messageId (${messageId}) or channelid (${channelid}).`);
        continue; // Skip if essential info is missing
      }

      // Push an async task for each message to be cached
      cacheTasks.push((async () => {
        try {
          const channel = await client.channels.fetch(channelid); // Use the channelid from JSON

          if (!channel) {
            console.warn(`⚠️ Channel with ID ${channelid} (for '${name}') not found. Skipping caching for this message.`);
            return;
          }

          if (!channel.isTextBased()) {
            console.warn(`⚠️ Channel '${channel.name}' (${channelid}) (for '${name}') is not text-based. Skipping caching.`);
            return;
          }

          const message = await channel.messages.fetch(messageId);
          console.log(`✅ Successfully cached embed '${name}' (ID: ${message.id}) from channel '${channel.name}' (${channelid}).`);
        } catch (err) {
          console.error(`❌ Failed to cache embed '${name}' (ID: ${messageId}) in channel ${channelid}:`, err.message);
          // Common Discord API errors for more specific debugging
          if (err.code === 10003) { // Unknown Channel
            console.error("   - Discord API Error: Unknown Channel. Is the channel ID correct or has the channel been deleted?");
          } else if (err.code === 10008) { // Unknown Message
            console.error("   - Discord API Error: Unknown Message. Has this message been deleted?");
          }
        }
      })()); // Immediately invoke the async function
    }
  } else {
    console.log("ℹ️ EmbedIDs.json is not a single array. No embeds to cache.");
  }

  await Promise.all(cacheTasks);
  console.log('Finished attempting to cache all stored embeds.'); // Updated log
}

// Main async entrypoint
async function main() {
  await loadCommandsWithWorker();
  await loadListenersWithWorker();

  client.once('ready', async () => {
    await cacheInteractiveMessages(client);
    embedsenders(client, process.env.GUILD_ID);
    console.log(`✅ Logged in as ${client.user.tag}`);
  });

  await client.login(process.env.TOKEN);

}

main().catch(console.error);

