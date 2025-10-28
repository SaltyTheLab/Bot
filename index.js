import { Client, GatewayIntentBits, Collection, Options } from 'discord.js';
import { config } from 'dotenv';
import embedsenders from './embeds/embeds.js';
import { loadCommandsToClient, loadListeners, register } from './deploy-cmds.js';
import cron from 'node-cron';
import { CountingStateManager } from './BotListeners/Extravariables/counting.js';
import guildChannelMap from "./BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};
import { load } from './utilities/jsonloaders.js';
import db from './Database/database.js';

config();
export const { TOKEN, CLIENT_ID } = process.env;
export const client = new Client({ // Initialize Discord client
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildInvites],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER', 'GUILD_INVITES'],
  makeCache: Options.cacheWithLimits({
    MessageManager: 14
  })
});

client.countingState = new CountingStateManager()
client.commands = new Collection();

async function clearExpiredWarns(usersCollection) {
  const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  try {
    await usersCollection.updateMany(
      { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: now - twentyFourHoursInMs } } } },
      { $set: { "punishments.$[elem].active": 0 } },
      { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: now - twentyFourHoursInMs } }] }
    );
  } catch (error) {
    console.error('❌ An error occurred during warn clearance:', error);
  }
}
async function cacheInteractiveMessages(guildid, guild) {
  const embedIDs = await load("embeds/EmbedIDs.json")
  if (!embedIDs[guildid])
    return;

  const cachePromises = embedIDs[guildid].map(async (embedInfo) => {
    const { name, messageId, channelid } = embedInfo;

    if (!messageId || !channelid) {
      console.warn(`⚠️ Skipping caching for embed '${name}': Missing messageId or channelid.`);
      return { status: 'rejected', reason: 'Missing IDs' };
    }
    try {
      const channel = await guild.channels.fetch(channelid);
      const message = await channel.messages.fetch(messageId);
      if (message.reactions.length > 0) channel.messages.cache.set(messageId, message);
      return { status: 'fullfilled' }
    } catch (err) {
      const reason = err.code === 10003 ? "Discord API Error: Unknown Channel"
        : err.code === 10008 ? "Discord API Error: Unknown Message"
          : err.message;
      console.error(`❌ Failed to cache embed '${name}' (ID: ${messageId}) in channel ${channelid}:`, reason);
      return { status: 'rejected', reason }
    }
  });
  await Promise.allSettled(cachePromises);
}
async function main() {
  await client.login(process.env.TOKEN);
  await new Promise(resolve => client.once('clientReady', resolve));
  await loadCommandsToClient(client);
  await register(client.guilds.cache.map(guild => guild.id));
  await loadListeners(client);
  cron.schedule(' 0 0 * * *', async () => { await clearExpiredWarns(db.collection('users')) })
  for (const [guildId, guild] of client.guilds.cache) {
    if (guildChannelMap[guildId].publicChannels?.countingChannel) {
      let Countingchannel = await guild.channels.fetch(guildChannelMap[guildId].publicChannels.countingChannel)
      let lastmessages = await Countingchannel.messages.fetch({ limit: 5 });
      lastmessages = lastmessages.filter(message => !message.author.bot)
      for (const [, message] of lastmessages.entries()) {
        const messagenumber = parseInt(message.content.trim())
        if (!isNaN(messagenumber) && message.content.trim() === parseInt(messagenumber).toString() && message.embeds.length === 0) {
          client.countingState.initialize(parseInt(messagenumber), guildId);
          break;
        }
      }
    }
    await cacheInteractiveMessages(guildId, guild);
  }
  await embedsenders(client.guilds.cache);
  client.commands.forEach((command, name) => console.log(name))
  console.log(`✅ Logged in as ${client.user.tag}`);
}
await main().catch(console.error);