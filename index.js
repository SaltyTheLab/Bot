import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { embedsenders } from './embeds/embeds.js';
import { getrolesid } from './BotListeners/Extravariables/channelids.js';

// Setup dotenv
config();

// Setup paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const interactiveMessages = [
  { channelId: getrolesid, messageId: "1395238443444862976" },
  { channelId: getrolesid, messageId: "1395238444665540673" },
  { channelId: getrolesid, messageId: "1395238446213234829" },
  { channelId: getrolesid, messageId: "1395238447181992070" },
  { channelId: getrolesid, messageId: "1395238495647174797" },
  { channelId: getrolesid, messageId: "1395238496616190144" }
];

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
                client.on(eventName, (...args) =>  listenerFunc(client, ...args));
               else 
                client.on(eventName, (...args) =>  listenerFunc(...args));

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

async function cacheInteractiveMessages() {
  await Promise.all(
    interactiveMessages.map(async ({ channelId, messageId }) => {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
          console.warn(`⚠️ Channel ${channelId} is not text-based, skipping.`);
          return;
        }

        const message = await channel.messages.fetch(messageId);
        console.log(`✅ Cached message ${message.id} from channel ${channelId}`);
      } catch (err) {
        console.error(`❌ Failed to fetch message ${messageId} in channel ${channelId}`, err);
      }
    })
  );
}



// Main async entrypoint
async function main() {
  await loadCommandsWithWorker();
  await loadListenersWithWorker();

  client.once('ready', async () => {
    await cacheInteractiveMessages();
    console.log(`✅ Logged in as ${client.user.tag}`);
  });

  embedsenders(client, process.env.GUILD_ID);

  await client.login(process.env.TOKEN);
}

main().catch(console.error);

