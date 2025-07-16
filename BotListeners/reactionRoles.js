

const roleMessageId = ''; //Insert message ID here
const emojiRoleMap = {
  '': '', //Insert emoji in first apostrophe role ID in second here
};

export async function messageReactionAdd(reaction, user) {

  if (reaction.message.id !== roleMessageId || user.bot) return;
 

  const roleID = emojiRoleMap[reaction.emoji.name];
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  if (roleID) {
    member.roles.add(roleID).catch(console.error);
  }
}

export async function messageReactionRemove(reaction, user) {
  if (reaction.message.id !== roleMessageId || user.bot) return;

  const roleID = emojiRoleMap[reaction.emoji.name];
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  if (roleID) {
    member.roles.remove(roleID).catch(console.error);
  }
};


