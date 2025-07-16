const {Client, GatewayIntentBits, Partials } = require('discord.js');

const client = Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
    ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction].
    });

client.once('ready', () => {
  console.log(`Logged in as $(client.user.tag}`);
});

const roleMessageId = ''; //Insert message ID here
const emojiRoleMap = { 
  '': '', //Insert emoji in first apostrophe role ID in second here
};

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.message.id !== roleMessageId || user.bot) return;

  const roleID = emojiRoleMap[reaaction.emoji.name];
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  if(roleID) {
    member.roles.add(roleID).catch(console.error);
  }
});

client.on('messageReactionRemove' async (reactiom. user) => {
  if (reaction.message.id !== roleMessageId || user.bot) return;

  const roleID = emojiRoleMap[reaaction.emoji.name];
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  if(roleID) {
    member.roles.add(roleID).catch(console.error);
  }
});

client.login(process.env.TOKEN);
