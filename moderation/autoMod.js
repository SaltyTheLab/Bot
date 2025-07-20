import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';
import { getNextPunishment } from './punishments.js';
import { addWarn } from '../Logging/databasefunctions.js';
import { violationWeights } from './violationTypes.js';
import { getWarnStats } from '../utilities/simulatedwarn.js';

export async function AutoMod(message, client, reasonText, maintype, violations = []) {
  const userId = message.author.id;
  const guild = message.guild;
  let weight = violationWeights[maintype];
  let totalWeight = 0;
  for (const v of violations) {
    totalWeight += violationWeights[v.type] ?? 1;
  }

  console.log(violations);
  if (violations.length >= 1)
    await addWarn(userId, client.user.id, reasonText, totalWeight, "warn");
  else await addWarn(userId, client.user.id, reasonText, weight, "warn");

  const { weightedWarns } = await getWarnStats(userId);

  console.log(`[AutoMod] User ${userId} has ${weightedWarns} weighted warns.`);

  // ⏳ Step 3: Apply appropriate punishment
  if (weightedWarns >= 1) {
    const { duration, unit } = getNextPunishment(weightedWarns);
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
  } else {
    await warnUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user,
      reason: reasonText,
      channel: message.channel,
      isAutomated : true
    });
  }

  // 🧹 Step 4: Cleanup
  try {
    await message.delete();
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}
