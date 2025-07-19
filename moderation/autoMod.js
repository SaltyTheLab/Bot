import { muteUser } from '../utilities/muteUser.js';
import { warnUser } from '../utilities/warnUser.js';
import { banUser } from '../utilities/banUser.js';
import { getWarnStats } from '../utilities/simulatedwarn.js';
import { getNextPunishment } from './punishments.js';

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
  const { weightedWarns,
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

  const { duration, unit } = getNextPunishment(weightedWarns, { next: true, context: 'automod' });


  const shouldMute = futureWeightedWarns > 1;

  // Escalate if there are prior active warnings
  if (shouldMute) {
    await muteUser({
      guild,
      targetUser: userId,
      moderatorUser: client.user.id,
      reason: reasonText,
      duration: duration,
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
