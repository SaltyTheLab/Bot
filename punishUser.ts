import { guildconfigs, usersCollection } from './Database';
import { get, put, pull, patch, post } from './rest';
import { ComponentType } from './types'
import type { Punishment, userObject, messageObject, guildObject, channelObject, BaseInteraction, AppCommandInteraction, MessageComponentInteraction } from './types';
import { type Document, ObjectId } from 'mongodb';
const punishmentStages = [
  { type: 'Warn', label: '15 min mute', minutes: 0 },
  { type: 'Mute', label: '30 min mute', minutes: 15 },
  { type: 'Mute', label: '45 min mute', minutes: 30 },
  { type: 'Mute', label: '1 hour mute', minutes: 45 },
  { type: 'Mute', label: '2 hour mute', minutes: 60 },
  { type: 'Mute', label: '4 hour mute', minutes: 120 },
  { type: 'Mute', label: '8 hour mute', minutes: 240 },
  { type: 'Mute', label: '16 hour mute', minutes: 960 },
  { type: 'Mute', label: '16 hour mute', minutes: 960 }
];
const unitMap: Record<string, number> = { min: 60000, hour: 3600000, day: 86400000 };
const Log_Type: Record<string, number> = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
export default async function punishUser(guildId: string, target: string, avatar: string, moderatorUser: { username: string, id: string, avatar: string }, reason: string, channelId: string, isAutomated: boolean, interaction: BaseInteraction<AppCommandInteraction> | BaseInteraction<MessageComponentInteraction> | undefined, currentWarnWeight: number, banflag: boolean, kick: boolean) {
  const user = await get(`/users/${target}`) as userObject
  const useravatar = avatar ? `https://cdn.discordapp.com/avatars/${target}/${avatar}${avatar.includes('a_') ? '.gif' : '.png'}` : `https://cdn.discordapp.com/embed/avatars/${user.discriminator === "0" ? Number(BigInt(target) >> 22n) % 6 : Number(user.discriminator) % 5}.png`;
  let warns: number = 0, durationMs: number = 0;
  let durationStr: string = '', warnType: string = banflag ? 'Ban' : kick ? 'Kick' : 'Warn';
  let refrences: Array<Punishment> = [];
  const guild = await get(`guilds/${guildId}`) as guildObject;
  const object = new ObjectId();
  let { punishments } = await usersCollection.findOneAndUpdate(
    { userId: target, guildId: guildId },
    {
      $push: { punishments: { _id: object, userId: target, moderatorId: moderatorUser.id, reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: currentWarnWeight, type: warnType, guildId: guildId, channel: channelId, refrence: `` } } as any
    },
    { returnDocument: 'after', projection: { punishments: 1 } }
  ) as Document;
  if (punishments.length > 0) warns = punishments.filter((p: Punishment) => p.active === 1).reduce((acc: number, entry: Punishment) => acc + (entry.weight || 1), 0);
  const { type, minutes, label } = punishmentStages[Math.min(warns - 1, punishmentStages.length - 1)] as { type: string, label: string, minutes: number };
  if (interaction?.data.options[0] && interaction?.data.options[0].name == 'Mute') {
    durationMs = interaction?.data.options[0].options[2].value as number * unitMap[interaction?.data.options[0].options[3].value];
    durationStr = `${interaction?.data.options[0].options[2].value} ${interaction?.data.options[0].options[3].value}`;
    warnType = 'Mute';
  } else if (warnType == 'Warn' && type === 'Mute') {
    durationMs = minutes * 1000
    durationStr = minutes >= 60 ? `${Math.ceil(minutes / 60)} hour mute` : `${Math.ceil(minutes)} min mute`
    warnType = 'Mute'
  }
  const cmdMap: Record<string, string> = { Ban: 'was banned', Kick: 'was kicked', Warn: 'was issued a warning', Mute: `was issued a ${durationStr} mute` };
  const logColor = Log_Type[warnType];
  const finalMessage = !isAutomated && interaction ?
    await patch(`webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, { embeds: [{ color: logColor, author: { name: `${user.username} ${cmdMap[warnType]}`, icon_url: useravatar } }] }) as messageObject
    : await post(`channels/${channelId}/messages`, { embeds: [{ color: logColor, author: { name: `${user.username} ${cmdMap[warnType]}`, icon_url: useravatar } }] }) as messageObject;
  ({ punishments } = await usersCollection.findOneAndUpdate(
    { "punishments._id": object },
    { $set: { "punishments.$.warns": warns - 1, "punishments.$.refrence": `https://discord.com/channels/${guildId}/${channelId}/${finalMessage.id}`, "punishments.$.type": warnType, "punishments.$.duration": durationMs } }, { returnDocument: 'after', projection: { punishments: 1 } }) as Document);
  const statusMap: Record<string, { log: string, dm: string }> = {
    Ban: { log: 'banned a member', dm: `you were banned from [${guild.name}](https://discord.com/channels/${guild.id}).\n\n\nTo appeal this decision, please join our dedicated appeal server using the button below.` },
    Kick: { log: 'kicked a member', dm: `you were kicked from ${guild.name}` },
    Mute: { log: 'muted a member', dm: `you were given a \`${durationStr}\` mute in ${guild.name}` },
    Warn: { log: 'warned a member', dm: `you were given a warning in ${guild.name}` }
  };
  const { log, dm } = statusMap[warnType];
  refrences = punishments.length > 0 ? ((warnType === 'Ban' ? punishments.filter((r: Punishment) => r.type === 'Ban')
    : punishments.filter((r: Punishment) => r.type !== 'Kick')).slice(0, 10).map((punishment: Punishment, index: number) => { if (punishment.refrence) return `[Case ${index + 1}](${punishment.refrence})` }).filter(Boolean)) : [];
  const logEmbed = {
    color: logColor,
    author: { name: `${moderatorUser.username} ${log}`, icon_url: `https://cdn.discordapp.com/avatars/${moderatorUser.id}/${moderatorUser.avatar}.${moderatorUser.avatar.startsWith('a_') ? 'gif' : 'png'}` },
    thumbnail: { url: useravatar },
    fields: [
      { name: 'Target:', value: `<@${target}>`, inline: true },
      { name: 'Channel:', value: `<#${channelId}>`, inline: true },
      { name: 'History:', value: `${refrences.length > 0 ? refrences.join(' | ') : "none"}`, inline: true },
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      ...(warnType !== 'Ban' && warnType !== 'Kick') ? [{ name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false }, { name: 'Warns at log time:', value: `\`${warns - currentWarnWeight}\``, inline: false }, { name: 'Next Punishment:', value: `\`${label}\``, inline: false }] : [],
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'User DMed ✅' }
  }
  try {
    const dmchannel = await post(`users/@me/channels`, { recipient_id: target }) as channelObject;
    await post(`channels/${dmchannel.id}/messages`, {
      embeds: [{
        color: logColor,
        author: { name: `${user.username}`, icon_url: useravatar },
        thumbnail: { url: `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png` },
        description: `<@${target}>, ${dm}`,
        fields: [
          { name: 'Reason:', value: `\`${reason}\``, inline: false },
          ...(warnType !== 'Ban' && warnType !== 'Kick') ? [{ name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr !== '' ? `, \`${durationStr}\`` : ''}`, inline: false },
          { name: 'Active Warnings:', value: `\`${warns}\``, inline: false },
          { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:F>` }] : []
        ],
        timestamp: new Date().toISOString()
      }],
      components: warnType === 'Ban' ? [{ type: ComponentType.ACTION_ROW, components: [{ type: ComponentType.BUTTON, style: 5, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }] : null
    })
  } catch { logEmbed.footer = { text: 'User DMed 🚫' } }
  switch (warnType) {
    case 'Ban': await guildconfigs.updateOne({ guildId: guildId }, { $set: { ban: target } }); await put(`guilds/${guildId}/bans/${target}`, { delete_message_seconds: 604800 }, `Ban Command: ${reason}`, null);
      break;
    case 'Mute': {
      const expiry = new Date(Date.now() + Math.min(durationMs, 2419200000)).toISOString()
      await patch(`guilds/${guildId}/members/${target}`, { communication_disabled_until: expiry }, reason)
      break;
    }
    case 'Kick': await pull(`guilds/${guildId}/members/${target}`);
      break;
  }
  const { modChannels } = await guildconfigs.findOne({ guildId: guildId }, { projection: { modChannels: 1 } }) as Document
  const logChannelId: string = warnType == 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel;
  await post(`channels/${logChannelId}/messages`, { embeds: [logEmbed] })
  if (warnType == 'Warn' || warnType == 'Mute')
    setTimeout(async () => { await usersCollection.updateOne({ userId: user.id, guildId: guildId }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] }); }, 24 * 60 * 60 * 1000);
}