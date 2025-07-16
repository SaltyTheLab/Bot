export let roleMessageId;
export const emojiRoleMap = {
  '👍': '1395015929062232126',
};

export async function messageReactionAdd(reaction, user) {
  console.log('🧪 Add reaction event fired:', reaction.emoji.name, 'from', user.username);

  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('❌ Failed to fetch reaction (add):', err);
      return;
    }
  }

  if (reaction.message.id !== roleMessageId) return;

  const emoji = reaction.emoji.id || reaction.emoji.name;
  const roleID = emojiRoleMap[emoji];
  if (!roleID) {
    console.log(`⚠️ No role mapped to emoji: ${emoji}`);
    return;
  }

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(console.error);
  if (!member) {
    console.log('❌ Member not found');
    return;
  }

  console.log(`✅ Adding role ${user.tag} to user ${reaction.emoji.name}`);
  member.roles.add(roleID).catch(console.error);
}
export async function messageReactionRemove(reaction, user) {
  console.log('🧪 Remove reaction event fired:', reaction.emoji.name, 'from', user.username);

  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('❌ Failed to fetch reaction (remove):', err);
      return;
    }
  }

  if (reaction.message.id !== roleMessageId) return;

  const emoji = reaction.emoji.id || reaction.emoji.name;
  const roleID = emojiRoleMap[emoji];
  if (!roleID) {
    console.log(`⚠️ No role mapped to emoji: ${emoji}`);
    return;
  }

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(console.error);
  if (!member) {
    console.log('❌ Member not found');
    return;
  }

  console.log(`🗑️ Removing role ${user.tag} to user ${reaction.emoji.name}`);
  member.roles.remove(roleID).catch(console.error);
}


