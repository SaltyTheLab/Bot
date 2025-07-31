
import { EmbedBuilder } from '@discordjs/builders';
import { saveUser, getUser } from '../Database/databasefunctions.js';
import { AutoMod } from '../moderation/autoMod.js';
//setup constants
const bad = 'bad';
const bot = 'bot';
const eyes = '1257522749635563561';
const keywords = {
  cute: "You're Cute",
  adorable: "You're Adorable",
  ping: "pong!",
  saytheline: 'stay frosty :3',
  bork: "bark",
  hellothere: "general Kenobi",
  iamnowgoingtobarkatyou: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark"
};
export async function messageCreate(client, message) {
  //skip if message creator is bot or not in the server
  if (message.author.bot || !message.guild || !message.member) return;

  //convert message to all lowercase and remove all spaces 
  const userId = message.author.id;
  const content = message.content.toLowerCase();
  const lowerContent = content.replace(/ /g, '');
  console.log(lowerContent);

  //send reactions for triggers
  if (lowerContent.includes('<@857445139416088647>'))
    message.react(eyes);
  if (lowerContent.includes(bad && bot))
    message.react('😡')

  for (const keyword in keywords) {
    if (lowerContent.includes(keyword)) {
      message.reply(keywords[keyword]);
    }
  }

  //add and update xp to the user
  const user = await applyUserXP(userId, message);
  saveUser(user);

  //submit to automod
  await AutoMod(client, message);
}
async function applyUserXP(userId, message) {
  const {userData} = getUser(userId);
  userData.xp += 20;

  const xpNeeded = Math.floor((userData.level - 1) ** 1.5 * 52)
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
