
import { EmbedBuilder } from '@discordjs/builders';
import { saveUser, getUser } from '../Database/databasefunctions.js';
import { AutoMod } from '../moderation/autoMod.js';

const keywords = {
  cute: "You're Cute",
  adorable: "You're Adorable",
  ping: 'pong!'
};

export async function messageCreate(client, message) {
  console.log("test");
  if (message.author.bot || !message.guild || !message.member) return;
  const userId = message.author.id;
  const guildId = message.guild.id;
  const lowerContent = message.content.toLowerCase();

  const user = await applyUserXP(userId, guildId, message);
  saveUser(user);

  if (keywords[lowerContent]) return message.reply(keywords[lowerContent]);

  await AutoMod(client, message);

}

async function applyUserXP(userId, guildId, message) {
  const user =  getUser(userId, guildId);
  user.xp += 20;

  const xpNeeded = Math.floor((user.level - 1) ** 2 * 50);
  if (user.xp >= xpNeeded) {
    user.level++;
    user.xp = 0;

    const levelUpEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${message.author.tag} leveled up to ${user.level}!`,
        iconURL: message.author.displayAvatarURL({ dynamic: true })
      })
      .setColor(0x00AE86)
      .setFooter({ text: 'keep on yapping!' });

    await message.channel.send({ embeds: [levelUpEmbed] });

    // Auto-role on level 3
    if (user.level === 3) {
      const verifiedRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
      if (verifiedRole) {
        const member = await message.guild.members.fetch(userId);
        if (!member.roles.cache.has(verifiedRole.id)) {
          await member.roles.add(verifiedRole);
        }
      }
    }
  }
  return user;
}