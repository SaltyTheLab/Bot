import { Client, GatewayIntentBits, Collection, Options, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { save, findFiles } from './utilities/fileeditors.js';
import { initializeRankCardBase } from './utilities/rankcardgenerator.js';
import loadCommandsToClient from './deploy-cmds.js';
import CountingStateManager from './Extravariables/counting.js';
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'}
import embedsenders from './embeds/embeds.js';
import db from './Database/databaseAndFunctions.js';
import embedIDs from './embeds/EmbedIDs.json' with {type: 'json'}
const embeds = Object.values(embedIDs).flatMap(guildEmbeds => guildEmbeds.map(embedInfo => embedInfo.messageId))
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildModeration, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildInvites, GatewayIntentBits.MessageContent],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER'],
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 1800, lifetime: 3600, filter: (message) => embeds.includes(message.id) },
    users: { interval: 1800, lifetime: 3600, filter: (user) => user.id !== client.user.id }
  }
});
client.commands = new Collection()
client.countingState = CountingStateManager
config();
const starttime = Date.now()
async function clearExpiredWarns(usersCollection) {
  await usersCollection.updateMany(
    { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
    { $set: { "punishments.$[elem].active": 0 } },
    { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
  ).catch(err => console.error('❌ An error occurred during warn clearance:', err));
}
function updateStatus() {
  const elapsedMs = Date.now() - starttime;
  let seconds = Math.floor(elapsedMs / 1000);
  const days = Math.floor(seconds / 86400);
  seconds %= 86400
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  client.user.setActivity(`${days}d ${hours}h ${minutes}m ${seconds}s`, { type: ActivityType.Watching });
}
async function main() {
  const invites = {}
  const { CLIENT_ID, TOKEN } = process.env;
  initializeRankCardBase();
  await client.login(TOKEN);
  await new Promise(resolve => client.once('clientReady', resolve))
  client.removeAllListeners();
  const eventsNeedingClient = new Set(['messageCreate']);
  for (const filePath of await findFiles("BotListeners"))
    for (const [eventName, listenerFunc] of Object.entries(await import(pathToFileURL(filePath).href)))
      client.on(eventName, eventsNeedingClient.has(eventName) ? (...args) => listenerFunc(client, ...args) : (...args) => listenerFunc(...args));
  loadCommandsToClient(client.commands, client.guilds.cache.map(guild => guild.id), TOKEN, CLIENT_ID);
  updateStatus();
  setInterval(updateStatus, 5000)
  await clearExpiredWarns(db.collection('users'))
  setInterval(async () => { await clearExpiredWarns(db.collection('users')) }, 5 * 60 * 1000)
  await embedsenders(client.channels.cache);
  for (const [guildId, guild] of client.guilds.cache) {
    const guildinvites = await guild.invites.fetch();
    invites[guildId] = guildinvites.map(invite => { return { id: invite.code, uses: invite.uses } })
    if (guildChannelMap[guildId].publicChannels?.countingChannel) {
      let Countingchannel = client.channels.cache.get(guildChannelMap[guildId].publicChannels.countingChannel)
      await Countingchannel.messages.fetch({ limit: 5 });
      const lastmessages = Countingchannel.messages.cache.filter(message => !message.author.bot)
      for (const [, message] of lastmessages) {
        const messagenumber = parseInt(message.content.trim())
        if (!isNaN(messagenumber) && message.embeds.length === 0) {
          client.countingState.initialize(messagenumber, guildId);
          break;
        }
      }
    }
  }
  save("Extravariables/invites.json", invites)
  client.commands.forEach((command, name) => console.log(name))
  console.log(`✅ Logged in as ${client.user.tag}`);
}
await main().catch(console.error());