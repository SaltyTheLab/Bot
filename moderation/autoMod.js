import punishUser from '../utilities/punishUser.js';
import getNextPunishment from './punishments.js';
import getWarnStats from './simulatedwarn.js';
import updateTracker, { clearSpamFlags } from './trackers.js';
import evaluateViolations from './evaluateViolations.js';
import guildChannelMap from '../BotListeners/Extravariables/channelids.js';
import forbbidenWordsData from '../moderation/forbiddenwords.json' with {type: 'json'};

const forbiddenWords = new Set(forbbidenWordsData.forbiddenWords.map(w => w.toLowerCase()));

const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
export default async function AutoMod(client, message) {

  const { author, content, member, guild, channel } = message;
  const userId = author.id;
  const guildchannels = guildChannelMap[guild.id];
  const exclusions = guildchannels.exclusions;
  const lowerContent = content.toLowerCase();

  console.log(`[AutoMod] Message from ${author.tag}: ${content}`);

  const violationFlags = updateTracker(userId, message);

  let matchedWord = null;
  if (forbiddenWords.size > 0 && !Object.values(exclusions).includes(message.channel.parentId) && !Object.values(exclusions).includes(message.channel.id)) {
    for (const word of forbiddenWords) {
      if (lowerContent.includes(word)) {
        matchedWord = word;
      }
    }
  }

  //test message for red flags
  const [hasInvite, everyonePing, isNewUser] = [
    inviteRegex.test(content),
    message.mentions.everyone,
    Date.now() - member.joinedTimestamp < TWO_DAYS_MS
  ];

  //variable to flag message for automod detection
  const hasViolation = matchedWord || hasInvite || everyonePing ||
    violationFlags.isMediaViolation || violationFlags.isGeneralSpam || violationFlags.isDuplicateSpam
    || violationFlags.isCapSpam;
  if (!hasViolation) return;
  if (violationFlags.isGeneralSpam || violationFlags.isDuplicateSpam)
    clearSpamFlags(userId);
  //handle spam duplication warn
  if (violationFlags.isGeneralSpam && violationFlags.isDuplicateSpam) {
    violationFlags.isDuplicateSpam = false;
  }

  //delete violating message and generate reason
  const shouldDelete = matchedWord || hasInvite || everyonePing || violationFlags.triggeredByCurrentMessage
  const [evaluationResult] = await Promise.all([
    evaluateViolations({ matchedWord, hasInvite, everyonePing, ...violationFlags, isNewUser }),
    shouldDelete ? message.delete().catch(err => {
      console.error(`Failed to delete message message: ${err.message}`);
      return null;

    }) : Promise.resolve(null)
  ]);

  if (!evaluationResult || !evaluationResult.violations.length) return;

  // append while new to the server if joined less then two days ago
  const reasons = evaluationResult.allReasons;
  let reasonText = `AutoMod: ${reasons.join(', ')}`;
  if (isNewUser) {
    const lastReason = reasons[reasons.length - 1];
    if (lastReason && lastReason.includes('while new to the server.')) {
      if (reasons.length > 1) {
        reasons[reasons.length - 2] += ` and ${lastReason}`;
        reasons.pop();
        reasonText = `AutoMod: ${reasons.join(', ')}`;
      } else {
        reasonText = `AutoMod: ${lastReason}`;
      }
    }
  } else {
    const lastCommaIndex = reasonText.lastIndexOf(',');
    if (lastCommaIndex !== -1) {
      reasonText = reasonText.substring(0, lastCommaIndex) + ' and' + reasonText.substring(lastCommaIndex + 1);
    }
  }

  // get previous activewarnings and warn weight of new warn
  const { activeWarnings, currentWarnWeight } = await getWarnStats(userId, guild.id, evaluationResult.violations);
  console.log(`active warns: ${activeWarnings.length}`)

  // calculate mute duration and unit
  const { duration, unit } = getNextPunishment(activeWarnings.length + currentWarnWeight);


  // common arguments for all commands
  const commonPayload = {
    guild: guild,
    targetUser: member,
    moderatorUser: client.user,
    reason: reasonText,
    channel: channel,
    isAutomated: true
  };

  // issue the mute/warn/ban
  if ((activeWarnings.length > 2 || currentWarnWeight >= 4) && isNewUser == true) {
    punishUser({ ...commonPayload, banflag: 1 });
  } else {
    await punishUser({
      ...commonPayload,
      currentWarnWeight: currentWarnWeight,
      duration: duration,
      unit: unit
    });
  }
}