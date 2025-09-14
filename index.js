import { Client, GatewayIntentBits, Collection, Options } from 'discord.js';
import { config } from 'dotenv';
import { embedsenders } from './embeds/embeds.js';
import { loadCommands, loadListeners } from './utilities/botreloader.js';
import cacheInteractiveMessages from './utilities/cacheInteractiveMessages.js';
import connectToMongoDB from './Database/database.js';
import initializeInvites from './utilities/initializeInvites.js';
import register from './deploy-cmds.js';
import cron from 'node-cron';
import clearExpiredWarns from './utilities/clearExpiredWarns.js';
import invites from './BotListeners/Extravariables/mapsandsets.js';
const db = await connectToMongoDB();
const usersCollection = db.collection('users');

config();// Setup dotenv
export const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
export const client = new Client({ // Initialize Discord client
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

client.commands = new Collection();//define the client commands variable

async function main() {
  await loadCommands(client);//load commands
  await register();//register the commands to api
  console.log('Loaded Commands:')//log for debugging purposes
  client.commands.forEach((command, name) => console.log(name))
  await loadListeners(client); //load listeners
  const guildIdsString = GUILD_ID;
  const guildIDs = guildIdsString.split(',').map(id => id.trim());
  client.once('clientReady', async () => {
    cron.schedule('0 0 * * *', async () => { await clearExpiredWarns(usersCollection) });
    await embedsenders(client, guildIDs);
    for (const guildId of guildIDs) {
      const guild = client.guilds.cache.get(guildId);
      await initializeInvites(guild);
      await cacheInteractiveMessages(guild);
    }
    console.log('--- Initial Invites Cache State ---');
    for (const [key, uses] of invites) {
      console.log(`${key}, Uses: ${uses}`);
    }
    console.log('-----------------------------------');
    console.log(`✅ Logged in as ${client.user.tag}`);//output for debugging
  })
  await client.login(process.env.TOKEN);
}
main().catch(console.error);//run main loop