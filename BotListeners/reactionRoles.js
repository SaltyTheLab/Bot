import { rolemessageid } from "../embeds/embeds.js";
export const emojiRoleMap = {
  '👍': '1395015929062232126',
  '💻': '1235323729936908379',
  '📦': '1235323730628968530',
  '🚉': '1235323732273397893',
  '🟥': '1235323733246476329',
  '📱': '1235323733795799154',
  '🎧': '1272280467940573296',
  '🔴': '1235323620163846294',
  '🟣': '1235323621015158827',
  '🟢': '1235323622546083991',
  '🩷': '1235323622969835611',
  '🟠': '1235323624055902289',
  '🟡': '1235323625037500466',
  '🔵': '1235323625452601437',
  '🧡': '1235323773473783989',
  '💛': '1235323773973168274',
  '💜': '1235323774505582634',
  '💚': '1235323775772528766',
  '🇪🇺': '1235335164436025415',
  '🦅': '1235335164758855781',
  '🌄': '1235335165631397909',
  '🐼': '1235335166772117694',
  '🐨': '1235335167560912927',
  '🦒': '1235335168458231951',
  '▶️': '1331028469794209913',
  '🚧': ['1235337327732068353',
    '1235337203572543561',
    '1235336646749327392',
    '1235337070504050735'
  ]
};

export async function messageReactionAdd(reaction, user) {
  
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('❌ Failed to fetch reaction (add):', err);
      return;
    }
  }

  if (reaction.message.id !== rolemessageid) return;

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

  member.roles.add(roleID).catch(console.error);
}
export async function messageReactionRemove(reaction, user) {

  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('❌ Failed to fetch reaction (remove):', err);
      return;
    }
  }

  if (reaction.message.id !== rolemessageid) return;

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
  member.roles.remove(roleID).catch(console.error);
}


