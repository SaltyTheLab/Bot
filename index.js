import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { embedsenders } from './embeds/embeds.js';
import cacheInteractiveMessages from './utilities/cacheInteractiveMessages.js';
import { reloadCommands, reloadListeners } from './utilities/botreloader.js';
import db from './Database/database.js';
import cron from 'node-cron'
import clearExpiredWarns from './utilities/clearExpiredWarns.js';

// Setup dotenv
config();

// Initialize Discord client
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER']
});

//define the client commands variable
client.commands = new Collection();

// Main async entrypoint
async function main() {
  //load commands and listeners
  await reloadCommands(client);
  await reloadListeners(client);

  //cache messages and send embeds 
  client.once('ready', async () => {
    cron.schedule(' 0 0 * * *', async () => {
      await clearExpiredWarns(db)
    });
    await cacheInteractiveMessages(client);
    embedsenders(client, process.env.GUILD_ID);
    //output for debugging
    console.log(`✅ Logged in as ${client.user.tag}`);
  });

  await client.login(process.env.TOKEN);

}
//run main loop
main().catch(console.error);
