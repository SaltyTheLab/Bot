import { type APIChannel, type APIEmbed, type APIEmbedImage, type APIMessage, type APIUser, ButtonStyle } from 'discord-api-types/payloads';
import { guildconfigs, usersCollection } from './Database';
import { response } from './rest';
import { ComponentType, InteractionResponseType, type APIApplicationCommandInteraction, type APIMessageComponentInteraction, type APIEmbedAuthor, type APIGuildMember } from 'discord-api-types/v10'
import { type Document, ObjectId } from 'mongodb';
interface PunishUserOptions {
  guildId: string;
  target: string;
  moderatorUser: APIUser;
  reason: string;
  channelId: string;
  currentWarnWeight: number;
  isAutomated?: boolean;
  interaction?: APIApplicationCommandInteraction | APIMessageComponentInteraction;
  banflag?: boolean;
  kick?: boolean;
}
const statusMap: Record<string, { cmd: string, log: string, dm: string, color: number }> = {
  Ban: { cmd: 'was banned', log: 'banned a member', dm: `you were banned from`, color: 0xd10000 },
  Kick: { cmd: 'was kicked', log: 'kicked a member', dm: `you were kicked from`, color: 0x838383 },
  Mute: { cmd: 'was issued a mute', log: 'muted a member', dm: `you were given a`, color: 0xff4444 },
  Warn: { cmd: 'was issued a warning', log: 'warned a member', dm: `you were given a warning`, color: 0xffcc00 }
};
export default async function punishUser({ guildId, target, moderatorUser, reason, channelId, currentWarnWeight, isAutomated, interaction, banflag, kick }: PunishUserOptions) {
  const user = await response({ method: "GET", endpoint: `users/${target}` }) as APIUser;
  const { Stages, name, icon, modChannels } = await guildconfigs.findOne({ guildId: guildId }, { projection: { Stages: 1, name: 1, icon: 1, modChannels: 1 } }) as Document
  const { punishments, avatar, nick } = await usersCollection.findOne({ userId: target, guildId: guildId }, { projection: { punishments: 1, avatar: 1, nick: 1 } }) as any;

  const activeWarns = punishments.length > 0 ? punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0) : 0;
  const totalWarns = activeWarns + currentWarnWeight;
  const useravatar = avatar
    ? `https://cdn.discordapp.com/avatars/${target}/${avatar}${avatar!.includes('a_') ? '.gif' : '.png'}`
    : `https://cdn.discordapp.com/embed/avatars/${user.discriminator === "0" ? Number(BigInt(target) >> 22n) % 6 : Number(user.discriminator) % 5}.png`;

  let warnType = banflag ? 'Ban' : kick ? 'Kick' : 'Warn';
  let durationMs = 0, durationStr = '';
  const stage = Stages[Math.min(totalWarns - 1, Stages.length - 1)];
  if ((interaction && interaction.data.options[0].name === 'Mute') || (warnType === 'Warn' && stage.minutes > 0)) {
    const unitMap: Record<string, number> = { min: 60000, hour: 3600000, day: 86400000 };
    if (interaction && interaction.data.options[0].name === 'Mute') {
      durationMs = interaction!.data.options[0].options[2].value * unitMap[interaction.data.options[0].options[3].value]!;
      durationStr = `${interaction!.data.options[0].options[2].value} ${interaction.data.options[0].options[3].value}`;
    }
    if (warnType === 'Warn' && stage.minutes > 0) {
      durationMs = stage.minutes * 60000;
      durationStr = stage.minutes >= 60 ? `${Math.ceil(stage.minutes / 60)} hour mute` : `${stage.minutes} min mute`;
    }
    warnType = 'Mute';
  }
  const cmdembed = {
    embeds: [{
      color: statusMap[warnType]!.color,
      author: { name: `${nick} ${warnType === 'Mute' ? `was issued a ${durationStr}` : statusMap[warnType]!.cmd}`, icon_url: useravatar }
    }]
  }
  const finalMessage: any = !isAutomated && interaction ?
    Response.json({ type: InteractionResponseType.ChannelMessageWithSource, data: cmdembed })
    :
    await response({ method: "POST", endpoint: `channels/${channelId}/messages`, body: cmdembed }) as APIMessage;
  const object = new ObjectId();
  const newPunishment = { _id: object, userId: target, moderatorId: moderatorUser.id, reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: currentWarnWeight, type: warnType, guildId, channel: channelId, refrence: `https://discord.com/channels/${guildId}/${channelId}/${interaction ? interaction!.message!.id : finalMessage.id}`, warns: totalWarns - 1 };
  await usersCollection.updateOne({ userId: target, guildId }, { $push: { punishments: newPunishment as any } }, { upsert: true });
  const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
  const logEmbed: APIEmbed = {
    color: statusMap[warnType]!.color,
    author: { name: `${moderatorUser.username} ${statusMap[warnType]!.log}`, icon_url: `https://cdn.discordapp.com/avatars/${moderatorUser.id}/${moderatorUser.avatar}.${moderatorUser.avatar!.startsWith('a_') ? 'gif' : 'png'}` },
    thumbnail: { url: useravatar },
    fields: [
      { name: 'user.id:', value: `<@${target}>`, inline: true },
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
  const dmchannel = await response({ method: "POST", endpoint: `users/@me/channels`, body: { recipient_id: target } }) as APIChannel;
  if (!dmchannel)
    logEmbed.footer!.text = 'User DMed 🚫';
  else
    await response({
      method: "POST",
      endpoint: `channels/${dmchannel.id}/messages`, body: {
        embeds: [{
          color: statusMap[warnType]!.color, author: { name: nick, icon_url: useravatar } as APIEmbedAuthor,
          thumbnail: { url: `https://cdn.discordapp.com/icons/${guildId}/${icon}.png` } as APIEmbedImage,
          description: `<@${target}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${name}](https://discord.com/channels/${guildId}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${name}` : `in ${name}`}`,
          fields: [
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            ...(['Ban', 'Kick'].includes(warnType) ? [] : [
              { name: 'Punishment:', value: `\`${currentWarnWeight} warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
              { name: 'Active Warnings:', value: `\`${totalWarns}\``, inline: false },
              { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:F>` }
            ])
          ],
          timestamp: new Date().toISOString()
        }],
        components: warnType === 'Ban' ? [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }] : undefined,
      } as APIMessage
    });
  switch (warnType) {
    case 'Ban':
      await guildconfigs.updateOne({ guildId }, { $set: { ban: target } });
      await response({ method: "PUT", endpoint: `guilds/${guildId}/bans/${target}`, body: { delete_message_seconds: 604800 }, reason: `Ban Command: ${reason}` });
      break;
    case 'Mute':
      await response({ method: "PATCH", endpoint: `guilds/${guildId}/members/${target}`, body: { communication_disabled_until: new Date(Date.now() + Math.min(durationMs, 2419200000)).toISOString() } as APIGuildMember, reason: reason });
      break;
    case 'Kick':
      await response({ method: "DELETE", endpoint: `guilds/${guildId}/members/${target}` });
      break;
  }
  await response({ method: "POST", endpoint: `channels/${warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel}/messages`, body: { embeds: [logEmbed] } });
  if (['Warn', 'Mute'].includes(warnType)) {
    setTimeout(async () => {
      await usersCollection.updateOne({ userId: target, guildId }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
    }, 86400000);
  }
  if (interaction)
    return finalMessage
}