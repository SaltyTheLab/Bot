import { Client, GatewayIntentBits, Collection, Options } from 'discord.js';
import { config } from 'dotenv';
import { embedsenders } from './embeds/embeds.js';
import { loadCommandsToClient, loadListeners, register } from './deploy-cmds.js';
import cacheInteractiveMessages from './utilities/cacheInteractiveMessages.js';
import connectToMongoDB from './Database/database.js';
import initializeInvites from './utilities/initializeInvites.js';
import cron from 'node-cron';
import clearExpiredWarns from './utilities/clearExpiredWarns.js';
import invites from './BotListeners/Extravariables/mapsandsets.js';
import guildChannelMap from './BotListeners/Extravariables/guildconfiguration.json' with {type: 'json'};
import { CountingStateManager } from './BotListeners/Extravariables/counting.js';
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

client.countingState = new CountingStateManager()
client.commands = new Collection();//define the client commands variable

async function main() {
  await client.login(process.env.TOKEN);
  await new Promise(resolve => client.once('clientReady', resolve));
  await loadListeners(client);
  await loadCommandsToClient(client);
  await register();
  cron.schedule('0 0 * * *', async () => { await clearExpiredWarns(usersCollection) });
  const guildIDs = GUILD_ID.split(',').map(id => id.trim());
  for (const guildId of guildIDs) {
    if (guildChannelMap[guildId].publicChannels.countingChannel) {
      const guild = client.guilds.cache.get(guildId)
      let Countingchannel = await guild.channels.fetch(guildChannelMap[guildId].publicChannels.countingChannel)
      let lastmessages = await Countingchannel.messages.fetch({ limit: 5 });
      for (const message of lastmessages.values()) {
        if (message.author.bot) continue;
        const messageNumber = parseInt(message.content.trim());
        if (!isNaN(messageNumber) && message.content.trim() === messageNumber.toString() && message.embeds.length === 0) {
          console.log(`found number for channel: ${messageNumber}`)
          client.countingState.initialize(messageNumber - 1, guildId);
          console.log(client.countingState.getCount(guildId))
          break;
        }
      }
    }
  }
  await embedsenders(client, guildIDs);
  for (const guildId of guildIDs) {
    const guild = client.guilds.cache.get(guildId);
    await initializeInvites(guild);
    await cacheInteractiveMessages(guild);
  }
  client.commands.forEach((command, name) => console.log(name))
  for (const [key, uses] of invites) {
    console.log(`${key}, Uses: ${uses}`);
  }
  console.log('-----------------------------------');
  console.log(`✅ Logged in as ${client.user.tag}`);//output for debugging
}
await main().catch(console.error);//run main loop