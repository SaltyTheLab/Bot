import { Client, GatewayIntentBits, Collection, Options } from 'discord.js';
import { config } from 'dotenv';
import { embedsenders } from './embeds/embeds.js';
import cacheInteractiveMessages from './utilities/cacheInteractiveMessages.js';
import { loadCommands, loadListeners } from './utilities/botreloader.js';
import db from './Database/database.js';
import cron from 'node-cron'
import clearExpiredWarns from './utilities/clearExpiredWarns.js';
import initializeInvites from './utilities/initializeInvites.js';
import register from './deploy-cmds.js';
import updateExpiredButtons from './utilities/updateExpiredButtons.js';

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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER', 'GUILD_INVITES'],

  makeCache: Options.cacheWithLimits({
    MessageManager: 14
  })
});

//define the client commands variable
client.commands = new Collection();

// Main async entrypoint
async function main() {
  await loadCommands(client);//load commands
  await register();//register the commands to api
  console.log('Loaded Commands:')//log for debugging purposes
  client.commands.forEach((command, name) => console.log(name))
  await loadListeners(client); //load listeners

  const guildIdsString = process.env.GUILD_ID;
  const guildIDs = guildIdsString.split(',').map(id => id.trim());
  client.once('ready', async () => {  //cache messages and send embeds 
    cron.schedule(' 0 0 * * *', async () => { await clearExpiredWarns(db) });
    cron.schedule('*/15 * * * *', async () => { await updateExpiredButtons(client, guildIdsString) });
    await initializeInvites(client);
    await cacheInteractiveMessages(client);
    for (const guildId of guildIDs) {
      console.log(`Attempting to send embeds for Guild ID: ${guildId}`);
      await embedsenders(guildId, client)
    }
    //output for debugging
    console.log(`✅ Logged in as ${client.user.tag}`);
  })
  await client.login(process.env.TOKEN);

}
//run main loop
main().catch(console.error);
