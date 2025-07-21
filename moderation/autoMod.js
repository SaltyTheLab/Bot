import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';
import { getNextPunishment } from './punishments.js';
import { addWarn, addMute } from '../Logging/databasefunctions.js';
import { violationWeights } from './violationWeights.js';
import { getWarnStats } from '../utilities/simulatedwarn.js';

export async function AutoMod(message, client, reasonText, violations = []) {
  console.log('[AutoMod] New automod invocation');
  const userId = message.author.id;
  let currentWarnWeight = 0;
  for (const v of violations) {
    currentWarnWeight += violationWeights[v.type] ?? 1;
  }
  console.log(currentWarnWeight);
  let { futureWeightedWarns } = await getWarnStats(userId);
  console.log(futureWeightedWarns);
  const totalWarnsAfterThis = futureWeightedWarns + currentWarnWeight;

  // Step 2: Decide punishment
  await handleWarningOrMute(message, client, reasonText, userId, totalWarnsAfterThis);

  // 🧹 Step 4: Cleanup
  try {
    await message.delete();
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}

async function handleWarningOrMute(message, client, reasonText, userId, totalWarnsAfterThis) {
  const guild = message.guild;
  const { duration, unit } = getNextPunishment(totalWarnsAfterThis);
  if (totalWarnsAfterThis > 1 && duration > 0) {
    await muteUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user.id,
      reason: reasonText,
      duration,
      unit,
      channel: message.channel,
      isAutomated: true
    });
    await addMute(message.author.id, client.user.id, reasonText, duration, totalWarnsAfterThis, 'mute');
  } else {
    await warnUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user,
      reason: reasonText,
      channel: message.channel,
      isAutomated: true
    });
    await addWarn(userId, client.user.id, reasonText, totalWarnsAfterThis, 'warn');
  }
}
