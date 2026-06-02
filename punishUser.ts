import { APIChannel, APIEmbed, APIEmbedField, APIMessage, APIUser, ButtonStyle } from 'discord-api-types/payloads';
import { guildconfigs, usersCollection } from './Database';
import { get, put, pull, patch, post } from './rest';
import { ComponentType, APIApplicationCommandInteraction, APIMessageComponentInteraction, APIComponentInActionRow } from 'discord-api-types/v10'
import { type Document, ObjectId } from 'mongodb';
const statusMap: Record<string, { cmd: string, log: string, dm: string, color: number }> = {
  Ban: { cmd: 'was banned', log: 'banned a member', dm: `you were banned from`, color: 0xd10000 },
  Kick: { cmd: 'was kicked', log: 'kicked a member', dm: `you were kicked from`, color: 0x838383 },
  Mute: { cmd: 'was issued a mute', log: 'muted a member', dm: `you were given a mute`, color: 0xff4444 },
  Warn: { cmd: 'was issued a warning', log: 'warned a member', dm: `you were given a warning`, color: 0xffcc00 }
};
interface PunishUserOptions {
  guildId: string; target: string; moderatorUser: APIUser; reason: string; channelId: string; currentWarnWeight: number;
  isAutomated?: boolean;
  interaction?: APIApplicationCommandInteraction | APIMessageComponentInteraction;
  banflag?: boolean;
  kick?: boolean;
}
export default async function punishUser({ guildId, target, moderatorUser, reason, channelId, isAutomated, currentWarnWeight, interaction, banflag, kick }: PunishUserOptions) {
  const user = await get(`/users/${target}`) as APIUser;
  const { stages, name, icon } = await guildconfigs.findOne({ guildId: guildId }, { projection: { Stages: 1, name: 1, icon: 1 } }) as Document
  const useravatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}${user.avatar!.includes('a_') ? '.gif' : '.png'}`
    : `https://cdn.discordapp.com/embed/avatars/${user.discriminator === "0" ? Number(BigInt(user.id) >> 22n) % 6 : Number(user.discriminator) % 5}.png`;

  // 1. Calculate historical active warns prior to insertion
  const { punishments } = await usersCollection.findOne({ userId: user.id, guildId }, { projection: { punishments: 1 } }) as any;
  const activeWarns = punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0);
  const totalWarns = activeWarns + currentWarnWeight;

  // 2. Resolve punishment variables early
  let warnType = banflag ? 'Ban' : kick ? 'Kick' : 'Warn';
  let durationMs = 0, durationStr = '';
  const stage = stages[Math.min(totalWarns - 1, stages.length - 1)];

  if ((interaction && interaction.data.options[0]?.name === 'Mute') || (warnType === 'Warn' && stage.minutes > 0)) {
    const unitMap: Record<string, number> = { min: 60000, hour: 3600000, day: 86400000 };
    durationMs = interaction!.data.options[0].options[2].value * unitMap[interaction!.data.options[0].options[3].value];
    durationStr = `${interaction!.data.options[0].options[2].value} ${interaction!.data.options[0].options[3].value}`;
    if (warnType === 'Warn' && stage.minutes > 0) {
      durationMs = stage.minutes * 60000;
      durationStr = stage.minutes >= 60 ? `${Math.ceil(stage.minutes / 60)} hour mute` : `${stage.minutes} min mute`;
    }
    warnType = 'Mute';
  }

  // 3. Post notification to the channel
  const config = statusMap[warnType]
  const finalMessage = !isAutomated && interaction ?
    await patch(`webhooks/${interaction!.application_id}/${interaction!.token}/messages/@original`, {
      embeds: [{
        color: statusMap[warnType].color,
        author: { name: `${user.username} ${warnType === 'mute' ? `was issued a ${durationStr} mute` : config.cmd}`, icon_url: useravatar }
      }]
    }) as APIMessage
    : await post(`channels/${channelId}/messages`, {
      embeds: [{
        color: statusMap[warnType].color,
        author: { name: `${user.username} ${warnType === 'mute' ? `was issued a ${durationStr} mute` : config.cmd}`, icon_url: useravatar }
      }]
    }) as APIMessage;

  // 4. Save to Database with a single, unified insert/push execution
  const object = new ObjectId();
  const newPunishment = { _id: object, userId: user.id, moderatorId: moderatorUser.id, reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: currentWarnWeight, type: warnType, guildId, channel: channelId, refrence: `https://discord.com/channels/${guildId}/${channelId}/${finalMessage.id}`, warns: totalWarns - 1 };
  await usersCollection.updateOne({ userId: user.id, guildId }, { $push: { punishments: newPunishment as any } }, { upsert: true });

  // 5. Structure Log Formatting & References
  const updatedHistory = [...punishments, newPunishment];
  const caseHistory = (warnType === 'Ban' ? updatedHistory.filter((r: any) => r.type === 'Ban') : updatedHistory.filter((r: any) => r.type !== 'Kick'))
    .slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);

  const logEmbed: APIEmbed = {
    color: config.color,
    author: { name: `${moderatorUser.username} ${config.log}`, icon_url: `https://cdn.discordapp.com/avatars/${moderatorUser.id}/${moderatorUser.avatar}.${moderatorUser.avatar!.startsWith('a_') ? 'gif' : 'png'}` },
    thumbnail: { url: useravatar },
    fields: [
      { name: 'user.id:', value: `<@${user.id}>`, inline: true },
      { name: 'Channel:', value: `<#${channelId}>`, inline: true },
      { name: 'History:', value: caseHistory.join(' | ') || "none", inline: true },
      { name: 'Reason:', value: `\`${reason}\``, inline: false },
      ...(['Ban', 'Kick'].includes(warnType) ? [] : [
        { name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
        { name: 'Warns at log time:', value: `\`${activeWarns}\``, inline: false },
        { name: 'Next Punishment:', value: `\`${stage.label}\``, inline: false }
      ])
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'User DMed ✅' }
  };

  // 6. Send User DM Notification
  try {
    const targetDmDescription = warnType === 'Ban' ? `you were banned from [${name}](https://discord.com/channels/${guildId}).\n\nTo appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `you were given a \`${durationStr}\` mute in ${name}` : `${config.dm}in ${name}`
    const dmchannel = await post(`users/@me/channels`, { recipient_id: user.id }) as APIChannel;
    await post(`channels/${dmchannel.id}/messages`, {
      embeds: [{
        color: statusMap[warnType].color, author: { name: user.username, icon_url: useravatar },
        thumbnail: { url: `https://cdn.discordapp.com/icons/${guildId}/${icon}.png` },
        description: `<@${user.id}>, ${targetDmDescription}`,
        fields: [
          { name: 'Reason:', value: `\`${reason}\``, inline: false },
          ...(['Ban', 'Kick'].includes(warnType) ? [] : [
            { name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
            { name: 'Active Warnings:', value: `\`${totalWarns}\``, inline: false },
            { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:F>` }
          ])
        ] as APIEmbedField[],
        timestamp: new Date().toISOString()
      }] as APIEmbed,
      components: warnType === 'Ban' ? [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] as APIComponentInActionRow[] }] : undefined,
    } as APIMessage);
  } catch { logEmbed.footer!.text = 'User DMed 🚫'; }

  // 7. Fire Off Native Server Discord Actions
  switch (warnType) {
    case 'Ban':
      await guildconfigs.updateOne({ guildId }, { $set: { ban: user.id } });
      await put(`guilds/${guildId}/bans/${user.id}`, { delete_message_seconds: 604800 }, `Ban Command: ${reason}`);
      break;
    case 'Mute':
      await patch(`guilds/${guildId}/members/${user.id}`, { communication_disabled_until: new Date(Date.now() + Math.min(durationMs, 2419200000)).toISOString() }, reason);
      break;
    case 'Kick':
      await pull(`guilds/${guildId}/members/${user.id}`);
      break;
  }
  // 8. Deliver final audit log and set up active mitigation cleanup
  const { modChannels } = await guildconfigs.findOne({ guildId }, { projection: { modChannels: 1 } }) as Document;
  await post(`channels/${warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel}/messages`, { embeds: [logEmbed] });

  if (['Warn', 'Mute'].includes(warnType)) {
    setTimeout(async () => {
      await usersCollection.updateOne({ userId: user.id, guildId }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
    }, 86400000);
  }
}