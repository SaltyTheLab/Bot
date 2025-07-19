import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';
import { banUser } from '../utilities/banUser.js';
import { getWarnStats } from '../utilities/simulatedwarn.js';
import { getNextPunishment } from './punishments.js';
import { addWarn } from '../Logging/databasefunctions.js';
import { violationWeights } from '../moderation/violationTypes.js';

export async function AutoMod(message, client, reasonText, options = {}) {
  const { isNewUser = false, violationType = '' } = options;
  const userId = message.author.id;
  const guild = message.guild;

  const weight = violationWeights[violationType] || 1;

  // Check if this user is a new one and has a ban-worthy violation
  const isBanWorthy = isNewUser && ['everyonePing'].includes(violationType);

  if (isBanWorthy) {
    try {
      const banResult = await banUser({
        guild,
        targetUserId: userId,
        moderatorUser: client.user,
        reason: reasonText,
        channel: message.channel,
        isAutomated: true
      });

      if (typeof banResult === 'string' && (banResult.startsWith('❌') || banResult.startsWith('⚠️'))) {
        console.warn(`AutoMod ban skipped or failed: ${banResult}`);
      } else {
        await message.channel.send(`🚫 Banned new user ${message.author.tag}.`);
        await message.delete();
        return;
      }
    } catch (err) {
      console.error('Failed to ban user:', err);
    }
  }

  // Add the warning first so we can get updated stats
  await addWarn(userId, client.user.id, reasonText, weight, violationType);

  // Now get up-to-date warning stats
  const { weightedWarns } = await getWarnStats(userId);

  const shouldMute = weightedWarns > 1;
  const { duration, unit } = getNextPunishment(weightedWarns);
  console.log(weightedWarns)
  if (shouldMute) {
    await muteUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user.id,
      reason: reasonText,
      duration,
      unit,
      channel: message.channel,
      isAutomated: true,
      violationType
    });
  } else {
    await warnUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user,
      reason: reasonText,
      channel: message.channel,
      isautomated: true,
      violationType
    });
  }

  try {
    await message.delete();
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}
