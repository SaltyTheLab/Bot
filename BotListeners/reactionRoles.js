import { loadMessageIDs } from "../utilities/messageStorage.js";
import { emojiRoleMap } from "./Extravariables/rolemap.js";

const messageIDs = loadMessageIDs();


// Common role message IDs to react to
const validKeys = ['colors', 'pronouns', 'continent', 'stream', 'dividers', 'consoles'];
const validRoleMessageIds = validKeys.map(key => messageIDs[key]).filter(Boolean);

/**
 * Handle reaction-based role assignment or removal
 */
async function handleReactionChange( reaction, user, action = 'add') {
  if (user.bot) return;

  try {
    if (reaction.partial) reaction = await reaction.fetch();
    if (reaction.message && reaction.message.partial) await reaction.message.fetch();

    if (user.partial) user = await user.fetch();
  } catch (err) {
    console.error(`❌ Failed to fetch reaction or user (${action}):`, err);
    return;
  }


  // 🛠️ Updated line to safely access .id
  if (!reaction.message || !validRoleMessageIds.includes(reaction.message.id)) return;

  const emoji = reaction.emoji.id || reaction.emoji.name;
  const roleID = emojiRoleMap[emoji];

  if (!roleID) {
    console.log(`⚠️ No role mapped to emoji: ${emoji}`);
    return;
  }

  const guild = reaction.message.guild ?? await reaction.client.guilds.fetch(reaction.message.guildId);
  const member = await guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    console.log('❌ Member not found');
    return;
  }

  try {
    const rolesToModify = Array.isArray(roleID) ? roleID : [roleID];
    await member.roles[action](rolesToModify);
  } catch (err) {
    console.error(`❌ Failed to ${action} role(s):`, err);
  }
}

/**
 * Reaction add handler
 */
export async function messageReactionAdd( reaction, user) {
  await handleReactionChange(reaction, user, 'add');
}

/**
 * Reaction remove handler
 */
export async function messageReactionRemove( reaction, user) {
  await handleReactionChange( reaction, user, 'remove');
}
