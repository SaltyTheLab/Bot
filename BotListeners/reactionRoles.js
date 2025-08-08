import embedIDs from '../embeds/EmbedIDs.json' with {type: 'json'}
import { emojiRoleMap } from "./Extravariables/rolemap.js";

const messageIDs = embedIDs;


// Common role message IDs to react to
const validKeys = ['colors', 'pronouns', 'continent', 'stream', 'dividers', 'consoles', 'EvoContent', 'EvoRules', 'EvoGames', 'Evocolors'];
const validRoleMessageIds = messageIDs
  .filter(embedInfo => validKeys.includes(embedInfo.name)) // Filter for only the relevant embed names
  .map(embedInfo => embedInfo.messageId) // Get the messageId for each filtered embed
  .filter(Boolean); // Remove any potential undefined or null entries (though shouldn't happen if structure is consistent)

/**
 * Handle reaction-based role assignment or removal
 */
async function handleReactionChange(reaction, user, action = 'add') {
  //check for bot user
  if (user.bot) return;

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
  if (!reaction.message || !validRoleMessageIds.includes(reaction.message.id)) return;

  //assign the emoji id and role
  const emoji = reaction.emoji.id || reaction.emoji.name;
  const roleID = emojiRoleMap[emoji];

  //error out if role id not found
  if (!roleID) {
    console.log(`⚠️ No role mapped to emoji: ${emoji}`);
    return;
  }
  //fetch the guild and member objects
  const guild = reaction.message.guild ?? await reaction.client.guilds.fetch(reaction.message.guildId);
  const member = await guild.members.fetch(user.id).catch(() => null);

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
