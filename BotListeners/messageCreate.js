import { EmbedBuilder } from '@discordjs/builders';
import { getUser, saveUser } from '../Database/databasefunctions.js';
import AutoMod from '../moderation/autoMod.js';
import { MessageType } from 'discord.js';
//setup constants and common triggers 
const eyes = '1257522749635563561';
const keywords = {
  cute: "You're Cute",
  adorable: "You're Adorable",
  ping: "pong!",
  saytheline: 'stay frosty :3',
  bork: "bark",
  hellothere: "general Kenobi",
  barkatyou: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark"
};
const reactions = {
  "857445139416088647": eyes,
  bad: '😡'
}
export async function messageCreate(client, message) {
  //skip if message creator is bot or not in the server
  if (message.author.bot || !message.guild || !message.member) return;
  const guildId = message.guild.id;
  //convert message to all lowercase and remove all spaces 
  const userId = message.author.id;
  const content = message.content.toLowerCase();
  const lowerContent = content.replace(/ /g, '');

  for (const keyword in keywords) {
    if (lowerContent.includes(keyword)) {
      message.reply(keywords[keyword]);
    }
  }

  for (const reaction in reactions) {
    if (lowerContent.includes(reaction))
      message.react(reactions[reaction])
  }

  //add and update xp to the user
  if (message.type === MessageType.Default || message.type === MessageType.Reply)
    saveUser(await applyUserXP(userId, message, guildId));

  await AutoMod(client, message, guildId);
}

async function applyUserXP(userId, message, guildId) {
  let { userData } = getUser(userId, guildId);
  if (userData.userId === null) {
    console.warn(`Corrupt user data found for userId: ${userId}. Initializing with defaults.`);
    const newUserData = { userId: userId, xp: 0, level: 1, coins: 100, guildId: guildId };
    saveUser(newUserData, guildId); // Save the clean data immediately
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
  return userData;
}
