import { getUser, saveUser } from '../Database/databaseAndFunctions.js';
import AutoMod from '../moderation/autoMod.js';
import { MessageType, EmbedBuilder } from 'discord.js';
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
const KEYWORD_REPLIES = new Map([
  ['bark', 'bark'],
  ['cute', 'You\'re Cute'],
  ['adorable', 'You\'re adorable'],
  ['borderlands', 'there ain\'t rest for the wicked'],
  ['potato', 'tomato, potato, potato, patato'],
  ['grr', 'Don\'t you growl at me'],
  ['lazy', 'Get up then!!'],
  ['<@364089951660408843>', 'awooooooooo']
])
const COMPLEX_KEYWORD_REPLIES = [
  { keywords: ['bark', 'at', 'you'], reply: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark" },
  { keywords: ['say', 'the', 'line'], reply: 'stay frosty :3' },
  { keywords: ['execute', 'order', '66'], reply: 'Not the Padawans!!!' },
  { keywords: ['hello', 'there'], reply: 'general Kenobi' }
];
async function applyUserXP(userId, message, guildId) {
  const { userData, rank } = await getUser({ userId: userId, guildId: guildId });
  const verifiedRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
  const member = message.member;
  userData.xp += 20;
  userData.totalmessages += 1;
  const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
  if (userData.xp >= xpNeeded) {
    userData.level++;
    userData.xp = 0;
    message.channel.send({
      embeds: [new EmbedBuilder({
        author: {
          name: `${message.author.tag} leveled up to ${userData.level}!`, iconURL: message.author.displayAvatarURL({ dynamic: true })
        },
        color: 0x00AE86,
        footer: { text: `you are #${rank} in ${message.guild.name}`, iconURL: message.guild.iconURL({ extension: 'png', size: 64 }) }
      })]
    });
  }
  if (userData.level >= 3 && !member.roles.cache.has(verifiedRole) && verifiedRole)
    member.roles.add(verifiedRole);
  saveUser({ userId: userId, guildId: guildId, userData: userData });
}
export async function messageCreate(client, message) {
  if (message.author.bot || !message.guild || !message.member)
    return;
  const sentbystaff = message.member.permissions.has('ModerateMembers')
  const lowerContent = message.content.toLowerCase().replace(/[.!]/g, '').split(/\s+/);
  const guildId = message.guild.id

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
      message.reply({
        content: lastUser == message.author.id ? `you already put a number down <@${message.author.id}>!(number reset)`
          : `<@${message.author.id}> missed the count, it was supposed to be ${expectedNumber}`
      })
      countingState.reset(guildId);
      message.react('❌')
      return;
    }
  }
  for (const [keyword, reply] of KEYWORD_REPLIES) {
    if (lowerContent.includes(keyword)) {
      message.reply({ content: reply });
      break;
    }
  }
  for (const { keywords, reply } of COMPLEX_KEYWORD_REPLIES) {
    if (keywords.every(k => lowerContent.includes(k))) {
      message.reply({ content: reply });
      break;
    }
  }
  if (lowerContent.includes('<@857445139416088647>'))
    message.react('1257522749635563561');
  if (lowerContent.includes('bad') && lowerContent.includes('bot'))
    message.react('😡');

  if (message.type !== MessageType.UserJoin) applyUserXP(message.author.id, message, guildId)
  if (sentbystaff || message.author.id === "521404063934447616") return;
  AutoMod(message);
}