import { EmbedBuilder } from '@discordjs/builders';
import { getUser, saveUser } from '../Database/databasefunctions.js';
import AutoMod from '../moderation/autoMod.js';
import { MessageType } from 'discord.js';
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
//setup constants and common triggers 
let counting = 0;
let lastuser;
let lastmessages;
let countingChannel;
let restart = true;
export async function messageCreate(client, message) {
  if (message.author.bot || !message.guild || !message.member)
    return;
  const publicChannels = guildChannelMap[message.guild.id].publicChannels
  const sentbystaff = message.member.permissions.has('ModerateMembers')

  //check for counting channel
  if (publicChannels?.countingChannel) {
    countingChannel = publicChannels.countingChannel;
    let CountingObject = await message.guild.channels.fetch(countingChannel)
    lastmessages = await CountingObject.messages.fetch({ limit: 5 });
  }

  //convert message to all lowercase and remove all spaces 
  const userId = message.author.id;
  const lowerContent = message.content.toLowerCase().split(/\s/);

  if (lowerContent.includes('bark'))
    message.reply('bark')
  if (lowerContent.includes('cute'))
    message.reply('You\'re Cute')
  if (lowerContent.includes('adorable'))
    message.reply('You\'re adorable')
  if (lowerContent.includes('borderlands'))
    message.reply('there ain\'t rest for the wicked')
  if (lowerContent.includes('potato'))
    message.reply('tomato, potato, potato, patato')
  if (lowerContent.includes('grr'))
    message.reply('Don\'t you growl at me')
  if (lowerContent.includes('<@364089951660408843>'))
    message.reply('awooooooooo')
  if (lowerContent.includes('<@857445139416088647>'))
    message.react('1257522749635563561')
  if (lowerContent.includes('bad') && lowerContent.includes('bot'))
    message.react('😡');
  if (lowerContent.includes('hello') && lowerContent.includes('there'))
    message.reply({ content: "general Kenobi" })
  if (lowerContent.includes('bark') && lowerContent.includes('at') && lowerContent.includes('you'))
    message.reply({ content: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark" });
  if (lowerContent.includes('say') && lowerContent.includes('the') && lowerContent.includes('line'))
    message.reply('stay frosty :3')
  if (lowerContent.includes('execute') && lowerContent.includes('order') && lowerContent.includes('66'))
    message.reply({ content: 'Not the Padawans!!!' })
  if (lowerContent.includes('lazy'))
    message.reply('Get up then!!')


  if ((message.type === MessageType.Default || message.type === MessageType.Reply) && message.channel.id != countingChannel)
    await applyUserXP(userId, message, message.guild.id);

  if (countingChannel && message.channel.id === countingChannel) {// check for a counting channel and if exists fetch the last valid message
    if (counting == 0 && restart == true) {
      for (const message of lastmessages.values()) {
        counting = parseInt(message.content) - 1;
        if (!isNaN(counting) && !message.embeds.length > 0) {
          lastmessages = [];
          restart = null
          break;
        }
      }
    }
    //check messages that are sent and compare them to the next number with a failsafe that tells the user that this channel is only for counting
    const number = parseInt(message.content);
    if (!message.content.trim() || isNaN(number) || Number(message.content) !== number) {
      return;
    }
    const countsaver = guildChannelMap[message.guild.id].countsaver
    if (number == counting + 1 && lastuser != message.author.id) {
      counting += 1;
      lastuser = message.author.id;
      message.react('✅')
    } else if (countsaver.length > 0) {
      let lastsavior = countsaver[countsaver.length - 1]
      message.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`${lastsavior} had a key, count saved.`)
          .setColor(0x009000)
        ]
      })
      countsaver.pop();
    }
    else {
      message.reply({
        embeds: [new EmbedBuilder()
          .setDescription(lastuser == message.author.id ? `you already put a number down <@${message.author.id}>!(number reset)`
            : `<@${message.author.id}> missed the count, it was supposed to be ${counting + 1}`)
        ]
      })
      counting = 0;
      lastuser = null;
      message.react('❌')
    }
    return;
  }
  if (sentbystaff) return;
  await AutoMod(client, message);
}

async function applyUserXP(userId, message, guildId) {
  let userData = await getUser(userId, guildId);
  userData.xp += 20;
  userData.totalmessages += 1;
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
