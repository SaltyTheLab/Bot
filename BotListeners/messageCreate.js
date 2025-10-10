import { EmbedBuilder } from '@discordjs/builders';
import { getUser, saveUser } from '../Database/databasefunctions.js';
import AutoMod from '../moderation/autoMod.js';
import { MessageType } from 'discord.js';
import guildChannelMap from "./Extravariables/guildconfiguration.json" with {type: 'json'};
export async function messageCreate(client, message) {
  if (message.author.bot || !message.guild || !message.member)
    return;
  const sentbystaff = message.member.permissions.has('ModerateMembers')
  const countingState = client.countingState
  //convert message to all lowercase and remove all spaces 
  const userId = message.author.id;
  const lowerContent = message.content.toLowerCase().split(/\s/);
  const guildId = message.guild.id

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

  const countingChannel = guildChannelMap[guildId].publicChannels.countingChannel;
  if (message.channel.id === countingChannel) {
    const number = parseInt(message.content.trim());
    const currentCount = countingState.getCount(guildId)
    const lastUser = countingState.getLastUser(guildId)
    const expectedNumber = currentCount + 1
    const keysArray = countingState.getkeys(guildId);

    if (!message.content.trim() || isNaN(number) || Number(message.content) !== number) {
      return;
    }
    if (number === expectedNumber && lastUser !== message.author.id) {
      countingState.increaseCount(message.author.id, guildId);
      message.react('✅')
      return;
    } else if (keysArray && keysArray.length > 0) {
      countingState.removekey(guildId)
      await message.reply({
        content: `1 key used, ${keysArray.length} keys left.`
      })
      return;
    }
    else {
      await message.reply({
        content: lastUser == message.author.id ? `you already put a number down <@${message.author.id}>!(number reset)`
          : `<@${message.author.id}> missed the count, it was supposed to be ${expectedNumber}`
      })
      countingState.reset(guildId);
      message.react('❌')
      return;
    }
  }

  if ((message.type === MessageType.Default || message.type === MessageType.Reply))
    await applyUserXP(userId, message, guildId);

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
