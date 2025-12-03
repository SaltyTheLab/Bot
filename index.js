import { Client, GatewayIntentBits, Collection, Options, ActivityType, Sweepers, Routes } from 'discord.js';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { save } from './utilities/fileeditors.js';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { initializeRankCardBase } from './utilities/rankcardgenerator.js';
import CountingStateManager from './Extravariables/counting.js';
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'}
import embedsenders from './embeds/embeds.js';
import db from './Database/databaseAndFunctions.js';
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildModeration, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildInvites, GatewayIntentBits.MessageContent],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER'],
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 120, filter: Sweepers.outdatedMessageSweepFilter(240) },
    invites: { interval: 30, filter: Sweepers.expiredInviteSweepFilter(60) }
  },
  rest: { version: 10, hashSweepInterval: 2 * 60 * 60 * 1000, hashLifetime: 6 * 60 * 60 * 1000 },
  ws: { version: 10, large_threshold: 200 },
  waitGuildTimeout: 10 * 1000,
  shardCount: 1
});
client.countingState = CountingStateManager
client.commands = new Collection();
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
async function getCommandData(filePaths) {
  const fullmodule = [];
  const jsonPayloads = [];
  for (const filePath of filePaths) {
    const command = await import(pathToFileURL(filePath).href);
    if (command.data && typeof command.execute === 'function') {
      fullmodule.push(command);
      jsonPayloads.push(command.data.toJSON());
    } else
      console.warn(`⚠️ Skipping invalid file: ${filePath} (missing 'data' or 'execute' property).`);
  }
  return { fullmodule, jsonPayloads };
}
async function findFiles(dir) {
  const filePaths = [];
  try {
    for (const dirent of await readdir(dir, { withFileTypes: true }))
      if (dirent.isFile() && dirent.name.endsWith('.js'))
        filePaths.push(join(dir, dirent.name));
      else continue;
  } catch {/* empty */ }
  return filePaths;
}
async function main() {
  if (!process.env.CLIENT_ID || !process.env.TOKEN) { console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.'); process.exit(1) }
  initializeRankCardBase();
  await client.login(process.env.TOKEN);
  await new Promise(resolve => client.once('clientReady', resolve))
  client.removeAllListeners();
  const eventsNeedingClient = new Set(['messageCreate']);
  for (const filePath of await findFiles("BotListeners"))
    for (const [eventName, listenerFunc] of Object.entries(await import(pathToFileURL(filePath).href)))
      client.on(eventName, (...args) => eventsNeedingClient.has(eventName) ? listenerFunc(client, ...args) : listenerFunc(...args));
  client.commands.clear();
  const globalPaths = await findFiles('commands')
  const globalProcessed = await getCommandData(globalPaths)
  globalProcessed.fullmodule.forEach(command => client.commands.set(command.data.name, command))
  client.rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: globalProcessed.jsonPayloads });
  const guildPaths = {};
  for (const guildId of client.guilds.cache.map(guild => guild.id))
    guildPaths[guildId] = await findFiles(`C:/Users/micha/Desktop/Bot/commands/${guildId}`)
  for (const guildId in guildPaths) {
    const guildProcessed = await getCommandData(guildPaths[guildId]);
    guildProcessed.fullmodule.forEach(command => client.commands.set(`${guildId}:${command.data.name}`, command))
    if (guildProcessed.jsonPayloads.length > 0) client.rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: guildProcessed.jsonPayloads });
  }
  updateStatus();
  setInterval(updateStatus, 5000)
  await clearExpiredWarns(db.collection('users'))
  setInterval(async () => { await clearExpiredWarns(db.collection('users')) }, 5 * 60 * 1000)
  await embedsenders(client.channels.cache);
  const invites = {}
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