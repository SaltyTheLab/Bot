import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'};
import { getblacklist } from '../Database/databasefunctions.js';
import { load } from '../utilities/fileeditors.js';
async function handleReactionChange(reaction, user, action = 'add') {
  const embedIDs = await load("embeds/EmbedIDs.json");
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

  const emoji = reaction.emoji.id || reaction.emoji.name;
  const roleID = guildChannelMap[reaction.message.guild.id].reactions[emoji];

  if (!roleID) { console.log(`⚠️ No role mapped to emoji: ${emoji}`); return; }

  if (await getblacklist(user.id, reaction.message.guild.id).length > 0 && await getblacklist(user.id, reaction.message.guild.id).find(r => r === roleID))
    return;

  await member.roles[action]([roleID]).catch(err => console.error(`❌ Failed to ${action} role(s):`, err))

}
export async function messageReactionAdd(reaction, user) {
  await handleReactionChange(reaction, user, 'add');
}
export async function messageReactionRemove(reaction, user) {
  await handleReactionChange(reaction, user, 'remove');
}
