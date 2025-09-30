import embedIDs from '../embeds/embedIDs.json' with {type: 'json'}
import guildconfig from "./Extravariables/guildconfiguration.json" with {type: 'json'};
import { getblacklist } from '../Database/databasefunctions.js';
/**
 * Handle reaction-based role assignment or removal
 */
async function handleReactionChange(reaction, user, action = 'add') {
  //check for bot user
  if (user.bot) return;

  const reactions = guildconfig[reaction.message.guild.id].reactions;
  const member = await reaction.message.guild.members.fetch(user.id);
  //fetch the reaction the user used
  try {
    if (reaction.partial) reaction = await reaction.fetch();
    if (reaction.message && reaction.message.partial) await reaction.message.fetch();
    if (user.partial) user = await user.fetch();
  } catch (err) {
    console.error(`❌ Failed to fetch reaction or user (${action}):`, err);
    return;
  }
  const guildEmbeds = embedIDs[reaction.message.guild.id];
  //return if not a vaild message or message id isn't in the messageIDs array
  const isValidMessageId = guildEmbeds.some(embedInfo => embedInfo.messageId === reaction.message.id);

  if (!isValidMessageId)
    return;

  //assign the emoji id and role
  const emoji = reaction.emoji.id || reaction.emoji.name;
  const roleID = reactions[emoji];

  //error out if role id not found
  if (!roleID) {
    console.log(`⚠️ No role mapped to emoji: ${emoji}`);
    return;
  }
  let blacklist;
  try {
    blacklist = await getblacklist(user.id, reaction.message.guild.id)
  } catch {
    return;
  }

  // attempt to modify the users roles
  if (blacklist.find(r => r === roleID))
    return;
  try {
    const rolesToModify = Array.isArray(roleID) ? roleID : [roleID];
    await member.roles[action](rolesToModify);
  } catch (err) {
    console.error(`❌ Failed to ${action} role(s):`, err);
  }
}

// Reaction add handler
export async function messageReactionAdd(reaction, user) {
  await handleReactionChange(reaction, user, 'add');
}

// Reaction remove handler
export async function messageReactionRemove(reaction, user) {
  await handleReactionChange(reaction, user, 'remove');
}
