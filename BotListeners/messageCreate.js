import { EmbedBuilder } from '@discordjs/builders';
import { getUser, saveUser } from '../Database/databasefunctions.js';
import AutoMod from '../moderation/autoMod.js';
import { MessageType } from 'discord.js';
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'};
export async function messageCreate(client, message) {
  if (message.author.bot || !message.guild || !message.member)
    return;
  const sentbystaff = message.member.permissions.has('ModerateMembers')
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

  if (message.channel.id === guildChannelMap[guildId].publicChannels.countingChannel) {
    const countingState = client.countingState
    if (!message.content.trim() || isNaN(parseInt(message.content.trim())) || Number(message.content) !== parseInt(message.content.trim()))
      return;
    const lastUser = countingState.getLastUser(guildId)
    const expectedNumber = countingState.getCount(guildId) + 1

    if (parseInt(message.content.trim()) === expectedNumber && lastUser !== message.author.id) {
      countingState.increaseCount(message.author.id, guildId);
      message.react('✅')
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
  if (message.type !== MessageType.UserJoin) await applyUserXP(message.author.id, message, guildId);
  if (sentbystaff || message.author.id === "521404063934447616") return;
  await AutoMod(message);
}

async function applyUserXP(userId, message, guildId) {
  let userData = await getUser(userId, guildId);
  const verifiedRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
  const member = await message.guild.members.fetch(userId);
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
  }
  if (userData.level === 3 && !member.roles.cache.has(verifiedRole) && verifiedRole)
    await member.roles.add(verifiedRole);
  await saveUser(userId, guildId, { userData });
}