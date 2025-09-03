import { EmbedBuilder } from '@discordjs/builders';
import { getUser, saveUser } from '../Database/databasefunctions.js';
import AutoMod from '../moderation/autoMod.js';
import { MessageType } from 'discord.js';
import guildChannelMap from './Extravariables/channelconfiguration.js';
//setup constants and common triggers 
let counting = 0;
let lastuser;
let lastmessages;
let guildId;
let CountingObject;
let countingChannel
const eyes = '1257522749635563561';
const keywords = {
  cute: "You're Cute",
  adorable: "You're Adorable",
  ping: "pong!",
  bork: "bark",
  borderlands: "there ain't no rest for the wicked",
  potato: "tomato, potato, potato, patato",
  grr: "dont you growl at me",
  '<@364089951660408843>': 'Awooooooooo'
};
export async function messageCreate(client, message) {

  guildId = message.guild.id;
  const publicChannels = guildChannelMap[guildId].publicChannels
  const sentbystaff = message.member.permissions.has('ModerateMembers')

  //skip if message creator is bot or not in the server
  if (message.author.bot)
    return;
  //check for counting channel
  if (publicChannels?.countingChannel) {
    countingChannel = publicChannels.countingChannel;
    CountingObject = await message.guild.channels.fetch(countingChannel)
    lastmessages = await CountingObject.messages.fetch({ limit: 5 });
  }

  //convert message to all lowercase and remove all spaces 
  const userId = message.author.id;
  const lowerContent = message.content.toLowerCase().split(/\s/);

  for (const word of lowerContent) {
    if (word in keywords) {
      message.reply(keywords[word]);
    }
  }

  if (lowerContent.includes('<@857445139416088647>'))
    message.react(eyes)

  if (lowerContent.includes('bad') && lowerContent.includes('bot'))
    message.react('😡');

  if (lowerContent.includes('hello') && lowerContent.includes('there')) {
    message.reply({ content: "general Kenobi" })
  }
  if (lowerContent.includes('bark') && lowerContent.includes('at') && lowerContent.includes('you')) {
    message.reply({ content: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark" });
  }
  if (lowerContent.includes('say') && lowerContent.includes('the') && lowerContent.includes('line')) {
    message.reply('stay frosty :3')
  }
  if (lowerContent.includes('execute') && lowerContent.includes('order') && lowerContent.includes('66'))
    message.reply({ content: 'Not the Padawans!!!' })

  if ((message.type === MessageType.Default || message.type === MessageType.Reply) && message.channel.id != countingChannel)
    await applyUserXP(userId, message, guildId);

  if (countingChannel && message.channel.id === countingChannel) {// check for a counting channel and if exists fetch the last valid message
    if (counting == 0) {
      for (const message of lastmessages.values()) {
        counting = parseInt(message.content) - 1;
        if (!isNaN(counting) && !message.embeds.length > 0) {
          lastmessages = [];
          break;
        }
      }
    }
    //check messages that are sent and compare them to the next number with a failsafe that tells the user that this channel is only for counting
    const number = parseInt(message.content);
    if (!number) {
      message.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`This channel is only for counting ${message.author}(number not reset)`)
        ]
      })
      return;
    }
    if (number == counting + 1 && lastuser != message.author) {
      message.react('✅')
      counting += 1;
      lastuser = message.author;
      return;
    }
    else {
      message.react('❌')
      message.reply({
        embeds: [new EmbedBuilder()
          .setDescription(lastuser == message.author ? `you already put a number down ${message.author}!(number reset)`
            : `${message.author} missed the count, it was supposed to be ${counting + 1}`)
        ]
      })
      counting = 0;
      lastuser = null;
      return;
    }
  }
  if (sentbystaff) return;
  await AutoMod(client, message, guildId);
}

async function applyUserXP(userId, message, guildId) {
  let userData = await getUser(userId, guildId);
  if (!userData) {
    console.warn(`Corrupt user data found for userId: ${userId}. Initializing with defaults.`);
    const newUserData = { userId: userId, xp: 0, level: 1, coins: 100, guildId: guildId };
    await saveUser(newUserData, guildId); // Save the clean data immediately
    userData = getUser(userId, guildId); // Re-fetch the now-clean data
  }
  userData.xp += 20;
  const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
  if (userData.xp >= xpNeeded) {
    userData.level++;
    userData.xp = 0;

    const levelUpEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${message.author.tag} leveled up to ${userData.level}!`,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setColor(0x00AE86)
      .setFooter({ text: 'keep on yapping!' });

    await message.channel.send({ embeds: [levelUpEmbed] });

    // Auto-role on level 3
    if (userData.level === 3) {
      const verifiedRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
      if (verifiedRole) {
        const member = await message.guild.members.fetch(userId);
        if (!member.roles.cache.has(verifiedRole.id)) {
          await member.roles.add(verifiedRole);
        }
      }
    }
  }
  await saveUser({ userData });
}
