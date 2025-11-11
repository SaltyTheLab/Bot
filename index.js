import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import embedsenders from './embeds/embeds.js';
import { loadCommandsToClient, loadListeners } from './deploy-cmds.js';
import { CountingStateManager } from './Extravariables/counting.js';
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
import { load } from './utilities/fileeditors.js';
import db from './Database/database.js';
config();
export const { TOKEN, CLIENT_ID } = process.env;
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildInvites],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER', 'GUILD_INVITES']
});
const starttime = new Date()
client.commands = new Collection()
client.countingState = new CountingStateManager()

async function clearExpiredWarns(usersCollection) {
  await usersCollection.updateMany(
    { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
    { $set: { "punishments.$[elem].active": 0 } },
    { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
  ).catch(err => console.error('❌ An error occurred during warn clearance:', err));
}
async function cacheInteractiveMessages(guildIds, channels) {
  const cachePromises = []
  const embedIDs = await load("embeds/EmbedIDs.json")
  for (const guildid of guildIds) {
    if (!embedIDs[guildid]) return;
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
  const now = new Date();
  const elapsedMs = now - starttime; // Time difference in milliseconds

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
  await client.login(process.env.TOKEN);
  await new Promise(resolve => client.once('clientReady', resolve));
  updateStatus();
  setInterval(updateStatus, 5000)
  await clearExpiredWarns(db.collection('users'))
  setInterval(await clearExpiredWarns(db.collection('users')), 86400000)
  await loadListeners(client);
  const guildIds = client.guilds.cache.map(guild => guild.id);
  const channels = client.channels.cache;
  await loadCommandsToClient(client.commands, guildIds);
  await cacheInteractiveMessages(guildIds, channels);
  await embedsenders(guildIds, channels);
  for (const guildId of guildIds) {
    if (guildChannelMap[guildId].publicChannels?.countingChannel) {
      let Countingchannel = channels.get(guildChannelMap[guildId].publicChannels.countingChannel)
      await Countingchannel.messages.fetch({ limit: 5 });
      const lastmessages = Countingchannel.messages.cache.filter(message => !message.author.bot)
      for (const [, message] of lastmessages) {
        const messagenumber = parseInt(message.content.trim())
        if (!isNaN(messagenumber) && message.content.trim() === parseInt(messagenumber).toString() && message.embeds.length === 0) {
          client.countingState.initialize(messagenumber, guildId);
          break;
        }
      }
    }
  }
  client.commands.forEach((command, name) => console.log(name))
  console.log(`✅ Logged in as ${client.user.tag}`);
}
await main().catch(err => console.error(`crashed at ${Date.now() - starttime} :`, err));