
import { EmbedBuilder } from '@discordjs/builders';
import { saveUserAsync, getUserAsync } from '../Logging/databasefunctions.js';
import { AutoMod } from '../moderation/autoMod.js';

const keywords = {
  cute: "You're Cute",
  adorable: "You're Adorable",
  ping: 'pong!'
};

export async function onMessageCreate(client,message) {
  if (message.author.bot || !message.guild || !message.member) return;


  const { author, guild, content } = message;

  const userId = author.id;
  const guildId = guild.id;
  const lowerContent = content.toLowerCase();

  const user = await applyUserXP(userId, guildId, message);
  await saveUserAsync(user);

  if (keywords[lowerContent]) return message.reply(keywords[lowerContent]);

  AutoMod(message, client);

}

async function applyUserXP(userId, guildId, message) {
  const user = await getUserAsync(userId, guildId);
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