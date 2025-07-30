import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { embedsenders } from './embeds/embeds.js';
import EmbedIDs from './embeds/EmbedIDs.json' with { type: 'json' }
import { reloadCommands, reloadListeners } from './utilities/botreloader.js';

// Setup dotenv
config();

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
//define the client commands variable
client.commands = new Collection();


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
  //load commands and listeners
  await reloadCommands(client);
  await reloadListeners(client);

  //cache messages and send embeds 
  client.once('ready', async () => {
    await cacheInteractiveMessages(client);
    embedsenders(client, process.env.GUILD_ID);

    //output for debugging
    console.log(`✅ Logged in as ${client.user.tag}`);
  });

  await client.login(process.env.TOKEN);

}
//run main loop
main().catch(console.error);
