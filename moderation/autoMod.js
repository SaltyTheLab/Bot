import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';
import { getNextPunishment } from './punishments.js';
import { getWarnStats } from '../utilities/simulatedwarn.js';

export async function AutoMod(message, client, reasonText, violations = []) {
  console.log('[AutoMod] New automod invocation');
  const userId = message.author.id;

  const { weightedWarns} = await getWarnStats(userId, violations);

  // Step 2: Decide punishment
  await handleWarningOrMute(message, client, reasonText, userId, weightedWarns, violations);

  // 🧹 Step 4: Cleanup
  try {
    await message.delete();
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}

async function handleWarningOrMute(message, client, reasonText, userId, warns, violations = []) {
  const guild = message.guild;
  const { duration, unit } = getNextPunishment(warns);
  if (warns >= 1 && duration > 0) {
    await muteUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user.id,
      reason: reasonText,
      duration,
      unit,
      channel: message.channel,
      isAutomated: true,
      violations
    });
   
  } else {
    await warnUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user,
      reason: reasonText,
      channel: message.channel,
      isAutomated: true,
      violations,
      warns
    });
  }
}
