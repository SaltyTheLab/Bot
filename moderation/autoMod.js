import { THRESHOLD, BASE_DURATION, MAX_DURATION } from './constants.js';
import { getActiveWarns } from '../Logging/databasefunctions.js';
import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';
import { banUser } from '../utilities/banUser.js';
import { getWarnStats } from '../utilities/simulatedwarn.js';

export function formatDuration(ms) {
  if (!ms || typeof ms !== 'number' || ms <= 0) return 'N/A';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : 'less than a minute';
}
export async function AutoMod(message, client, reasonText, options = {}) {
  const { isNewUser = false, violationType = '' } = options;
  const userId = message.author.id;
  const guild = message.guild;

  // Get active warnings (within threshold)
  const {
    activeWarnings,
    futureWeightedWarns
  } = await getWarnStats(userId, violationType);


  // New user with serious violations: auto-ban
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

  // Determine punishment duration
  let durationMs = Math.min(BASE_DURATION * 2 ** activeWarnings.length, MAX_DURATION);
  let unit = 'min';

  if (durationMs >= 86400000) unit = 'day';
  else if (durationMs >= 3600000) unit = 'hour';

  let durationInUnits = Math.ceil(durationMs / (unit === 'day' ? 86400000 : unit === 'hour' ? 3600000 : 60000));

  // Adjust for specific infractions
  if (isNewUser) {
    durationInUnits = 30;
    unit = 'min';
  }

  const shouldMute = futureWeightedWarns > 1;

  // Escalate if there are prior active warnings
  if (shouldMute) {
    await muteUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user.id,
      reason: reasonText,
      duration: durationInUnits,
      unit,
      channel: message.channel,
      isAutomated: true,
      violationType
    });
  } else {
    const warnCommand = client.commands.get('warn');
    if (warnCommand) {
      await warnUser({
        guild,
        targetUser: userId,
        moderatorUser: client.user,
        reason: reasonText,
        channel: message.channel,
        violationType
      });
    } else {
      console.warn('⚠️ Warn command not found.');
    }
  }

  // Delete offending message
  try {
    await message.delete();
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}
