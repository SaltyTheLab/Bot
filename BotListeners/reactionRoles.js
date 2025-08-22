import embedIDs from '../embeds/EmbedIDs.json' with {type: 'json'}
import { emojiRoleMap } from "./Extravariables/reactionrolemap.js";
/**
 * Handle reaction-based role assignment or removal
 */
async function handleReactionChange(reaction, user, action = 'add') {
  //check for bot user
  if (user.bot) return;

  const reactions = emojiRoleMap[reaction.message.guild.id].reactions;
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

  //return if not a vaild message or message id isn't in the messageIDs array
  const isValidMessageId = embedIDs.some(embedInfo => embedInfo.messageId === reaction.message.id);

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

  //error out if member not found
  if (!member) {
    console.log('❌ Member not found');
    return;
  }

  // attempt to modify the users roles
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
