import { EmbedBuilder, MessageType, MessageFlagsBitField } from "discord.js";
import { getUser, saveUser } from '../Database/databaseAndFunctions.js';
import forbbidenWordsData from '../moderation/forbiddenwords.json' with {type: 'json'};
import globalwordsData from '../moderation/globalwords.json' with {type: 'json'}
import { LRUCache } from 'lru-cache';
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
import punishUser from '../moderation/punishUser.js';
const forbiddenWords = new Set(forbbidenWordsData);
const globalWords = new Set(globalwordsData);
const userMessageTrackers = new LRUCache({ max: 50, ttl: 15 * 60 * 1000, updateAgeOnGet: true, ttlAutopurge: true });
const replies = new Map([
    ['bark', 'bark'],
    ['cute', 'You\'re Cute'],
    ['adorable', 'You\'re adorable'],
    ['potato', 'tomato, potato, potato, patato'],
    ['grr', 'Don\'t you growl at me'],
    ['<@364089951660408843>', 'awooooooooo']
])
const multireplies = [
    { keyword: ['bark', 'at', 'you'], reply: "woof woof bark bark\nwoof woof woof bark bark\nwoof woof woof\nwoof woof woof\nbark bark bark" },
    { keyword: ['say', 'the', 'line'], reply: 'stay frosty :3' },
    { keyword: ['execute', 'order', '66'], reply: 'Not the Padawans!!!' },
    { keyword: ['hello', 'there'], reply: 'general Kenobi' }
];
async function applyUserXP(member, channel, author, guild) {
    const { userData, rank } = await getUser({ userId: author.id, guildId: guild.id, modflag: true });
    const verifiedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
    userData.xp += 20;
    userData.totalmessages += 1;
    const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
    if (userData.xp >= xpNeeded) {
        userData.level++;
        userData.xp = 0;
        channel.send({
            embeds: [new EmbedBuilder({
                author: { name: `${author.tag} leveled up to ${userData.level}!`, iconURL: author.displayAvatarURL({ dynamic: true }) },
                color: 0x00AE86,
                footer: { text: `you are now rank ${rank} in ${guild.name}`, iconURL: guild.iconURL({ extension: 'png', size: 64 }) }
            })]
        });
    }
    if (userData.level >= 3 && !member.roles.cache.has(verifiedRole) && verifiedRole)
        member.roles.add(verifiedRole);
    saveUser({ userId: author.id, guildId: guild.id, userData: userData });
}
export async function messageUpdate(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logChannel = oldMessage.guild.channels.cache.get(guildChannelMap[oldMessage.guild.id].modChannels.updatedlogChannel);
    if (!logChannel) return;
    const embed = new EmbedBuilder({
        description: `<@${newMessage.author.id}> edited a message in <#${newMessage.channelId}>\n\n` +
            `**Before:**\n${oldMessage.content}\n\n` +
            `**After:**\n${newMessage.content}\n\n` +
            `[Event Link](https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${oldMessage.id})`,
        color: 0x309eff,
        thumbnail: { url: newMessage.author.displayAvatarURL() },
        footer: { text: `ID: ${newMessage.id}` },
        timestamp: Date.now()
    })
    logChannel.send({ embeds: [embed] });
}
export async function messageDelete(message) {
    if (!message.guild || message.partial || !message.author || message.author.bot) return;
    const logChannel = message.guild.channels.cache.get(guildChannelMap[message.guild.id].modChannels.deletedlogChannel);
    if (!logChannel) return;
    const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const hasAttachment = message.attachments.size > 0;
    let title = `Message by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    if (hasAttachment && !message.content) title = `Image by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    else if (hasAttachment && message.content) title = `Image and text by <@${message.author.id}> was deleted in <#${message.channel.id}>`;
    const imageAttachments = message.attachments.filter(att => att.contentType?.startsWith('image/')).map(att => att.url);
    const mainEmbed = new EmbedBuilder({
        color: 0xf03030,
        description: [title, message.content || '_No content_\n', `[Event Link](${messageLink})`].join('\n'),
        thumbnail: { url: message.author.displayAvatarURL() },
        footer: { text: `ID: ${message.id}` },
        timestamp: Date.now()
    })
    hasAttachment ? mainEmbed.setImage(imageAttachments[0]) : null
    const additionalImageEmbeds = imageAttachments.slice(1, 9).map(url =>
        new EmbedBuilder({
            color: 0xf03030, description: title + `\n[Event Link](${messageLink})`, image: url, thumbnail: { url: message.author.displayAvatarURL() },
            footer: { text: `ID: ${message.id}` }, timestamp: Date.now()
        }))
    logChannel.send({ embeds: imageAttachments.length > 1 ? [mainEmbed, ...additionalImageEmbeds] : [mainEmbed] });
};
export async function messageCreate(client, message) {
    const { guild, author, member, content, channel, attachments, flags, type, mentions, embeds } = message;
    if (author.bot || !guild || !member) return;
    const sentbystaff = member.permissions.has('ModerateMembers')
    // eslint-disable-next-line no-useless-escape
    const messageWords = content.replace(/<a?:\w+:\d+>/g, '').replace(/[\-!.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '').toLowerCase()
    if (channel.id === guildChannelMap[guild.id].publicChannels.countingChannel) {
        const countingState = client.countingState
        if (!messageWords.trim() || isNaN(parseInt(messageWords.trim())) || Number(messageWords) !== parseInt(messageWords.trim())) return;
        const lastUser = countingState.getLastUser(guild.id)
        const expectedNumber = countingState.getCount(guild.id) + 1
        if (parseInt(messageWords.trim()) === expectedNumber && lastUser !== author.id) { countingState.increaseCount(author.id, guild.id); message.react('✅'); return; }
        else {
            message.reply({ content: `you already counted or put a number down <@${author.id}>!(number reset)` })
            countingState.reset(guild.id); message.react('❌'); return;
        }
    }
    for (const [keyword, reply] of replies) { if (messageWords.includes(keyword)) { message.reply({ content: reply }); break; } }
    for (const { keyword, reply } of multireplies) { if (keyword.every(k => messageWords.includes(k))) { message.reply({ content: reply }); break; } }
    if (messageWords.includes('<@857445139416088647>')) message.react('1257522749635563561');
    if (messageWords.includes('bad') && messageWords.includes('bot')) message.react('😡');
    if (type !== MessageType.UserJoin) applyUserXP(member, channel, author, guild)
    if (sentbystaff) return;
    const [exclusions, mediaexclusions] = [guildChannelMap[guild.id].exclusions, guildChannelMap[guild.id].mediaexclusions,]
    let globalword, matchedWord = null;
    const isChannelExcluded = Object.values(exclusions).some(id => id === channel.parentId || id === channel.id);
    const words = messageWords.toLowerCase().split(/\s+/g);
    for (const word of words) { if (globalWords.has(word)) { globalword = word; break; } if (!isChannelExcluded && forbiddenWords.has(word)) { matchedWord = word; break; } }
    let capSpam;
    if (messageWords.length >= 20) { const upperCaseOnly = messageWords.match(/[A-Z]/g); if (upperCaseOnly) capSpam = upperCaseOnly.length / messageWords.length > 0.7; }
    let { mediaCount, total, duplicateCounts } = userMessageTrackers.get(`${author.id}-${guild.id}`) ?? ({ total: 0, mediaCount: 0, duplicateCounts: new Map() });
    const { Duplicatespamthreshold: duplicateThreshold, mediathreshold: mediathreshold, messagethreshold: messageThreshold } = guildChannelMap[guild.id].automodsettings;
    total += 1;
    const embedcheck = embeds.some(embed => {
        const urls = [embed.image?.url, embed.video?.url, embed.thumbnail?.url].filter(Boolean);
        return urls.some(url => /\.(gif|jpe?g|png|mp4|webm)$/i.test(url));
    })
    if ((attachments.size > 0 || embedcheck)
        && !flags.has(MessageFlagsBitField.Flags.IsVoiceMessage) && !Object.values(mediaexclusions).some(id => id === channel.parentId || id === channel.id)) mediaCount += 1;
    const currentContentCount = (duplicateCounts.get(messageWords) || 0) + 1;
    const duplicateSpam = currentContentCount > duplicateThreshold
    const mediaViolation = mediaCount > mediathreshold && total < messageThreshold
    if (messageWords.length > 0) duplicateCounts.set(messageWords, currentContentCount);
    if (duplicateSpam) duplicateCounts.clear();
    if (total >= messageThreshold) { total = 0; mediaCount = 0; }
    else if (mediaViolation) mediaCount = 0;
    userMessageTrackers.set(`${author.id}-${guild.id}`, { total: total, mediaCount: mediaCount, duplicateCounts: duplicateCounts })
    const { userData } = await getUser({ userId: author.id, guildId: guild.id, modflag: true })
    const generalspam = channel.messages.cache.filter(m => m.author.id === author.id && m.createdTimestamp > (Date.now() - 4 * 1000)).size >= 8;
    const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
    const [hasInvite, everyonePing] = [inviteRegex.test(messageWords), mentions.everyone];
    if (globalword || matchedWord || hasInvite || everyonePing) await message.delete()
    const checks = [
        { flag: hasInvite, reason: 'Discord invite', Weight: 2 },
        { flag: globalword, reason: "Saying a slur", Weight: 2 },
        { flag: matchedWord, reason: `NSFW word`, Weight: 1 },
        { flag: everyonePing, reason: 'Mass pinging', Weight: 2 },
        { flag: generalspam, reason: 'Spamming', Weight: 1 },
        { flag: duplicateSpam, reason: 'Spamming the same message', Weight: 1 },
        { flag: mediaViolation, reason: 'Media violation', Weight: 1 },
        { flag: capSpam, reason: 'Spamming Caps', Weight: 1 }
    ];
    let totalWeight = checks.filter(check => check.flag).reduce((acc, check) => { return acc + check.Weight }, 0);
    if (totalWeight == 0) return;
    let reasonText = `AutoMod: ${checks.filter(check => check.flag).map(check => check.reason).join('; ')}`;
    const isNewUser = Date.now() - member.joinedTimestamp < 2 * 24 * 60 * 60 * 1000 && userData.level < 3
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const commoninputs = { guild: guild, target: member, moderatorUser: client.user, reason: reasonText, channel: channel, isAutomated: true }
    const bannable = isNewUser && (totalWeight >= 3 || everyonePing || hasInvite)
    if (bannable) await punishUser({ ...commoninputs, banflag: true });
    else await punishUser({ ...commoninputs, currentWarnWeight: totalWeight })
}