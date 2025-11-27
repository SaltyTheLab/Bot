import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
import { getblacklist } from '../Database/databaseAndFunctions.js';
import embedIDs from '../embeds/EmbedIDs.json' with {type: 'json'};
async function handleReactionChange(reaction, user, action) {
  if (user.bot) return;
  const member = await reaction.message.guild.members.fetch(user.id);
  try {
    if (reaction.partial) reaction = await reaction.fetch();
    if (reaction.message && reaction.message.partial) await reaction.message.fetch();
    if (user.partial) user = await user.fetch();
  } catch (err) {
    console.error(`❌ Failed to fetch reaction or user (${action}):`, err);
    return;
  }
  const isValidMessageId = embedIDs[reaction.message.guild.id].some(embedInfo => embedInfo.messageId === reaction.message.id);
  if (!isValidMessageId)
    return;
  const roleID = guildChannelMap[reaction.message.guild.id].reactions[reaction.emoji.id || reaction.emoji.name];
  if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${roleID}`); return; }
  const blacklist = await getblacklist(user.id, reaction.message.guild.id)
  if (blacklist.length > 0 && blacklist.find(r => r === roleID))
    return;
  await member.roles[action](roleID).catch(err => console.error(`❌ Failed to ${action} role(s):`, err))
}
export async function messageReactionAdd(reaction, user) {
  await handleReactionChange(reaction, user, 'add');
}
export async function messageReactionRemove(reaction, user) {
  await handleReactionChange(reaction, user, 'remove');
}
