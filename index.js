import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import embedsenders from './embeds/embeds.js';
import { pathToFileURL } from 'node:url';
import { loadCommandsToClient } from './deploy-cmds.js';
import CountingStateManager from './Extravariables/counting.js';
import guildChannelMap from "./Extravariables/guildconfiguration.js";
import { load } from './utilities/fileeditors.js';
import db from './Database/database.js';
import { findFiles } from './utilities/fileeditors.js';
import { initializeRankCardBase } from './commands/rank.js';
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildInvites],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER', 'GUILD_INVITES']
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
async function cacheInteractiveMessages(channels) {
  const cachePromises = []
  const embedIDs = await load("embeds/EmbedIDs.json")
  for (const guildid in embedIDs) {
    cachePromises.push(async () => {
      const { name, messageId, channelid } = embedIDs[guildid];
      try {
        const channel = channels.cache.get(channelid);
        const message = await channel.messages.fetch(messageId);
        if (message.reactions.length > 0) channel.messages.cache.set(messageId, message);
        return { status: 'fullfilled' }
      } catch (err) {
        const reason = err.code === 10008 ? "Discord API Error: Unknown Message" : err.message;
        console.error(`❌ Failed to cache embed '${name}' in channel ${channelid}:`, reason);
        return { status: 'rejected', reason }
      }
    });
  }
  await Promise.allSettled(cachePromises);
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
  const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  client.user.setActivity(`${uptimeString}`, { type: ActivityType.Watching });
}
async function main() {
  const { CLIENT_ID, TOKEN } = process.env;
  initializeRankCardBase();
  await client.login(TOKEN);
  await new Promise(resolve => client.once('clientReady', resolve))
  client.removeAllListeners();
  const eventsNeedingClient = new Set(['messageCreate']);
  for (const filePath of await findFiles("BotListeners"))
    for (const [eventName, listenerFunc] of Object.entries(await import(pathToFileURL(filePath).href)))
      client.on(eventName, eventsNeedingClient.has(eventName) ? (...args) => listenerFunc(client, ...args) : (...args) => listenerFunc(...args));
  const guildIds = client.guilds.cache.map(guild => guild.id);
  const channels = client.channels.cache;
  await loadCommandsToClient(client.commands, guildIds, TOKEN, CLIENT_ID);
  updateStatus();
  setInterval(updateStatus, 5000)
  await clearExpiredWarns(db.collection('users'))
  setInterval(async () => { await clearExpiredWarns(db.collection('users')) }, 5 * 60 * 1000)
  await cacheInteractiveMessages(channels);
  await embedsenders(channels);
  for (const guildId of guildIds) {
    if (guildChannelMap[guildId].publicChannels?.countingChannel) {
      let Countingchannel = channels.get(guildChannelMap[guildId].publicChannels.countingChannel)
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
  client.commands.forEach((command, name) => console.log(name))
  console.log(`✅ Logged in as ${client.user.tag}`);
}
await main().catch(console.error());