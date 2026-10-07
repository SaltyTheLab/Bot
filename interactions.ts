import { guildconfigs, usersCollection, logos } from "./Database";
import { type Document, type WithId, ObjectId } from "mongodb";
import sharp from 'sharp'
import { SignJWT, jwtVerify } from 'jose'
import { ed25519 } from '@noble/curves/ed25519.js'
import { StatusCodes } from "http-status-codes";
import { appendFile } from "node:fs/promises";
import { AppTokenAuthProvider } from "@twurple/auth"
import { ApiClient } from '@twurple/api'
import { type APIMessageComponentInteraction, InteractionType, ComponentType, type APIEmbed, type APIInteraction, type APIMessage, InteractionResponseType, MessageFlags, type APIGuild, type APIGuildMember, type APIModalSubmitInteraction, type APIUser, type APIActionRowComponent, type APIChannel, ButtonStyle, type APIChatInputApplicationCommandGuildInteraction, ChannelType, type APIRole, type APIAutoModerationRule, Collection, ApplicationCommandOptionType, subtext, bold, quote, type APIButtonComponentWithCustomId, ModalBuilder, TextInputStyle, REST, Routes, type APIDMChannel, type APIApplicationCommandInteractionDataOption, type APIApplicationCommandInteractionDataBasicOption, type APIMessageTopLevelComponent, OAuth2Routes, type RESTPostOAuth2AccessTokenResult, type APIInteractionDataResolvedGuildMember, type APIApplicationCommandBasicOption, type APIMessageComponent, PermissionFlagsBits, ContainerBuilder, EmbedBuilder, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, ButtonBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, type APIMediaGalleryComponent } from "discord.js";
const rest = new REST().setToken(`${Bun.env.TOKEN}`)
const Client = new ApiClient({ authProvider: new AppTokenAuthProvider(Bun.env.TWITCH_ID!, Bun.env.TWITCH_SECRET!) })
type CommandContext = {
    body: APIChatInputApplicationCommandGuildInteraction;
    res: { type: InteractionResponseType; data: APIMessage | {} };
    guildConfig: WithId<Document> | null; // lazy — only fetched if a handler actually calls it
    target?: string
    targetuser?: APIUser;
    targetmember?: APIInteractionDataResolvedGuildMember;
    restrictedToFullMod?: boolean;
};
type OptionValueMap = {
    [ApplicationCommandOptionType.Subcommand]: APIApplicationCommandBasicOption
    [ApplicationCommandOptionType.String]: string;
    [ApplicationCommandOptionType.Integer]: number;
    [ApplicationCommandOptionType.Number]: number;
    [ApplicationCommandOptionType.Boolean]: boolean;
    [ApplicationCommandOptionType.User]: string;
    [ApplicationCommandOptionType.Channel]: string;
    [ApplicationCommandOptionType.Role]: string;
    [ApplicationCommandOptionType.Mentionable]: string;
    [ApplicationCommandOptionType.Attachment]: string;
};
const PART_CONFIG: Record<number, { modal: ModalBuilder, fields: string[] }> = {
    1: {
        modal: new ModalBuilder({
            title: 'Experience & Activity',
            customId: 'apply-modal-1',
            components: [
                {
                    type: ComponentType.Label, label: 'What age range are you in?', component: { custom_id: 'age', type: ComponentType.StringSelect, options: [{ label: '12 or under', value: '12 or under' }, { label: '13 to 15', value: '13-15' }, { label: '16 to 17', value: '16-17' }, { label: '18 or over', value: '18 or over' }] }
                },
                {
                    type: ComponentType.Label, label: 'Any prior mod experience?', component: { custom_id: 'experience', type: ComponentType.TextInput, style: TextInputStyle.Paragraph, max_length: 300 }
                },
                {
                    type: ComponentType.Label, label: 'Have you been warned/muted?', component: {
                        custom_id: 'punishments', type: ComponentType.TextInput, style: TextInputStyle.Short, max_length: 100
                    }
                },
                {
                    type: ComponentType.Label, label: 'Timezone?', component: {
                        custom_id: 'timezone', type: ComponentType.TextInput, style: TextInputStyle.Short, max_length: 8
                    }
                },
                {
                    type: ComponentType.Label, label: 'How active are you in the server?', component: {
                        custom_id: 'activity', type: ComponentType.TextInput, style: TextInputStyle.Short, max_length: 150
                    }
                }],

        }),
        fields: ['Agerange', 'Experience', 'History', 'Timezone', 'Activity']
    },
    2: {
        modal: new ModalBuilder({
            title: 'Definitions, Why mod, and Staff issues',
            customId: 'apply-modal-2',
            components: [
                {
                    type: ComponentType.Label,
                    label: 'Why should you be on the team?',
                    component: {
                        custom_id: 'why',
                        type: ComponentType.TextInput,
                        style: TextInputStyle.Paragraph,
                        max_length: 500
                    }
                },
                {
                    type: ComponentType.Label, label: 'What is your definition of a troll?', component: {
                        type: ComponentType.TextInput,
                        custom_id: 'trolldef',
                        style: TextInputStyle.Short,
                        max_length: 65
                    }
                },
                {
                    type: ComponentType.Label, label: 'What is your definition of a raid?', component: {
                        type: ComponentType.TextInput,
                        custom_id: 'raiddef',
                        style: TextInputStyle.Short,
                        max_length: 65
                    }
                },
                {
                    type: ComponentType.Label, label: 'You disagree with an action from staff', component: {
                        type: ComponentType.TextInput,
                        style: TextInputStyle.Paragraph,
                        max_length: 300,
                        custom_id: 'staffissues'
                    }
                },
                {
                    type: ComponentType.Label, label: 'How would you handle a member report?', component: {
                        custom_id: 'memberreport', type: ComponentType.TextInput, style: TextInputStyle.Paragraph, max_length: 300
                    }
                }]
        }),
        fields: ['why', 'Trolldef', 'Raiddef', 'Staffissues', 'Memberreport']
    },
    3: {
        modal: new ModalBuilder({
        title: 'Situations',
            customId: 'apply-modal-3',
            components: [{
                type: ComponentType.Label, label: 'A member messages you about being harassed', component: {
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Paragraph,
                    max_length: 350,
                    custom_id: 'dmmember'
                }
            },
            {
                type: ComponentType.Label, label: 'Users are arguing in general chat', component: {
                    custom_id: 'arguments',
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Paragraph,
                    max_length: 350
                }
            }, {
                type: ComponentType.Label, label: 'A member DMs you about a rule-breaking DM', component: {
                    type: ComponentType.TextInput,
                    custom_id: 'rulebreakdm',
                    style: TextInputStyle.Paragraph,
                    max_length: 350
                }
            },
            {
                type: ComponentType.Label, label: 'Staff is failing to follow the rules', component: {
                    custom_id: 'staffrulebreak', type: ComponentType.TextInput, style: TextInputStyle.Paragraph, max_length: 350
                }
            },
            {
                type: ComponentType.Label, label: 'A user shares illegal content', component: {
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Paragraph,
                    max_length: 350,
                    custom_id: 'illegal',
                }
            }]

        }),
        fields: ['dmmember', 'arguments', 'rulebreakdm', 'staffrulebreak', 'illegal']
    },
};
await Bun.write("./interpid.txt", String(process.pid))
const commands = new Collection<string, ((ctx: CommandContext) => Promise<Response | void>) & { cooldownMs?: number }>();
const statusMap: Record<string, { cmd: string, log: string, dm: string, color: number }> = {
    Ban: { cmd: 'was banned', log: 'banned a member', dm: `you were banned from`, color: 0xd10000 },
    Kick: { cmd: 'was kicked', log: 'kicked a member', dm: `you were kicked from`, color: 0x838383 },
    Mute: { cmd: 'was issued a mute', log: 'muted a member', dm: `you were given a`, color: 0xff4444 },
    Warn: { cmd: 'was issued a warning', log: 'warned a member', dm: `you were given a warning`, color: 0xffcc00 }
};
const key = crypto.getRandomValues(new Uint8Array(32));
function flattenLeafOptions(options: APIApplicationCommandInteractionDataOption[] | undefined): { path: string[]; leaves: APIApplicationCommandInteractionDataBasicOption[] } {
    const path: string[] = [];
    let level = options;
    while (level) {
        const sub = level.find(o => o.type === ApplicationCommandOptionType.Subcommand || o.type === ApplicationCommandOptionType.SubcommandGroup);
        if (!sub) return { path, leaves: level as APIApplicationCommandInteractionDataBasicOption[] };
        path.push(sub.name);
        level = (sub as any).options;
    }
    return { path, leaves: [] };
}
function resolveOptions<T extends Record<string, keyof OptionValueMap>>(options: APIApplicationCommandInteractionDataOption[] | undefined, schema: T): { subcommandPath: string[] } & { [K in keyof T]?: OptionValueMap[T[K]] } {
    const { path, leaves } = flattenLeafOptions(options);
    const result: any = { subcommandPath: path };
    for (const key in schema) { const opt = leaves.find(o => o.name === key); result[key] = opt?.type === schema[key] ? opt?.value : undefined; }
    return result;
}
function getComparableEmbed(embedData: APIEmbed): string | null {
    if (!embedData) return null; const normalizeText = (text: string | null) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    return JSON.stringify({
        title: embedData.title ? normalizeText(embedData.title) : null,
        description: embedData.description ? normalizeText(embedData.description) : null,
        url: embedData.url ? normalizeText(embedData.url) : null,
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    });
}
function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
}
function rangeForStreak(streak: number, k = 2): { min: number, max: number } {
    const width = Math.max(5, 100 / (1 + k * Math.log(streak + 1)));
    const center = width / 2 + (Math.random() - 0.5) * (100 - width); // range wanders, not glued to center
    let min = Math.ceil(Math.max(1, center - width / 2));
    let max = Math.ceil(Math.min(100, center + width / 2));
    return { min, max };
}
function findComponent(components: APIMessageComponent[], predicate: (c: APIMessageComponent) => boolean): APIMessageComponent | null {
    for (const c of components) {
        if (predicate(c)) return c;
        if ('components' in c) { const found = findComponent(c.components, predicate); if (found) return found; }
        if ('accessory' in c && predicate(c.accessory)) { return c.accessory as APIMessageComponent; }
    }
    return null;
}
function buildNoteView(notes: any[], index: number, user: APIUser, mod: APIUser, opener: string, disabled = false) {
    const n = notes[index];
    const quoted = String(n.note).split('\n').map(l => `> ${l}`).join('\n');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`note-prev-${user.id}-${index}-${opener}`).setLabel('◀️ prev').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index === 0),
        new ButtonBuilder().setCustomId(`note-next-${user.id}-${index}-${opener}`).setLabel('▶️ next').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index >= notes.length - 1),
        new ButtonBuilder().setCustomId(`note-del-${user.id}-${index}-${opener}-${n._id}`).setLabel('🗑️ delete').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    );
    return new ContainerBuilder()
        .setAccentColor(0xdddddd)
        .addSectionComponents(section(
            `<@${user.id}> notes | \`${index + 1} of ${notes.length}\`\n${quoted}\n\n${subtext(`<@${mod.id}> | ${fmtDate(n.timestamp)}`)}`,
            avatarOf(user),
        ))
        .addActionRowComponents(row);
}

function buildModlogView(logs: any[], index: number, user: APIUser, mod: APIUser, opener: string, isAdmin: boolean, disabled = false) {
    const p = logs[index];
    const mins = Math.round(p.duration / 60000);
    const hours = Math.floor(mins / 60);
    const embed = new EmbedBuilder()
        .setColor(LOG_COLORS[p.type] ?? 0x838383)
        .setThumbnail(avatarOf(user))
        .addFields(
            { name: '**Member:**', value: `<@${user.id}>`, inline: true },
            { name: '**type:**', value: `\`${p.type}\``, inline: true },
            { name: '**Active:**', value: `\`${p.active == 1 ? 'true' : 'false'}\``, inline: true },
            { name: '**Reason:**', value: `\`${p.reason}\`` },
            { name: '**Punishments:**', value: `${p.type == 'Ban' ? '`Ban`' : `\`${p.weight} warn\``}${p.duration ? `,\`${hours > 0 ? `${hours} hour` : `${mins} minute`} Mute\`` : ''}` },
            { name: '**Warns at Log Time:**', value: `\`${p.warns}\`` },
            { name: '**Channel:**', value: `<#${p.channel}>\n\n[Event Link](${p.refrence})` },
        )
        .setFooter({ text: `Staff: ${mod.username} | log ${index + 1} of ${logs.length} | ${fmtDate(p.timestamp)}`, iconURL: avatarOf(mod) });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`modlog-prev-${user.id}-${index}-${opener}`).setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index === 0),
        new ButtonBuilder().setCustomId(`modlog-next-${user.id}-${index}-${opener}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index >= logs.length - 1),
    );
    if (isAdmin) row.addComponents(
        new ButtonBuilder().setCustomId(`modlog-del-${user.id}-${index}-${opener}-${p._id}`).setLabel('Delete').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    );
    return { embeds: [embed.toJSON()], components: [row.toJSON()] };
}
function highlowRow(start: number, secret: number, streak: number, pot: number, min: number, max: number) {
    const tail = `${start}-${secret}-${streak}-${pot}-${min}-${max}`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`highlow-higher-${tail}`).setLabel('Higher').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`highlow-lower-${tail}`).setLabel('Lower').setStyle(ButtonStyle.Danger),
    );
    if (pot > 0) row.addComponents(
        new ButtonBuilder().setCustomId(`highlow-cashout-${pot}`).setLabel(`Cash Out (${pot})`).setStyle(ButtonStyle.Success),
    );
    return row;
}
const ephemeral = (content: string) => Response.json({ type: InteractionResponseType.ChannelMessageWithSource, data: { content, flags: MessageFlags.Ephemeral } });
const v2 = (...parts: { toJSON(): any }[]) => ({ flags: MessageFlags.IsComponentsV2 as const, components: parts.map(p => p.toJSON()) });
const section = (text: string, thumb: string) =>
    new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb));
const LOG_COLORS: Record<string, number> = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
const fmtDate = (ts: number) => new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
const avatarOf = (u: { id: string; avatar: string | null }) =>
    u.avatar
        ? rest.cdn.avatar(u.id, u.avatar)
        : rest.cdn.defaultAvatar(Number((BigInt(u.id) >> 22n) % 6n));
const notice = (description: string, color?: number) => new EmbedBuilder().setDescription(description).setColor(color ?? null).toJSON();

function generateButtons(board: string[], p1: string, p2: string, current: string, disabled: boolean) {
    return [0, 1, 2].map(i =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            [0, 1, 2].map(j => {
                const index = i * 3 + j;
                const cell = board[index]!;
                return new ButtonBuilder()
                    .setCustomId(`ttt-${board.join('')}-${p1}-${p2}-${current}-${index}`)
                    .setLabel(cell === '_' ? '\u200b' : cell)
                    .setStyle(cell === 'X' ? ButtonStyle.Primary : cell === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary)
                    .setDisabled(cell !== '_' || disabled);
            }),
        ),
    );
}

async function buildBlacklistEmbed(targetUser: APIUser, guild_id: string) {
    const doc = await usersCollection.findOne({ userId: targetUser.id, guildId: guild_id }, { projection: { blacklist: 1 } });
    const blacklist: string[] = doc?.blacklist ?? [];
    const embed = new EmbedBuilder().setDescription(
        `<@${targetUser.id}>'s blacklist\n\nblacklist: ${blacklist.length ? blacklist.map(r => `<@&${r}>`).join(', ') : 'empty'}`,
    );
    return { embed, blacklist };
}

async function runPunishment({ body, res, guildConfig }: CommandContext): Promise<Response> {
    const { guild_id, channel, member, data: { resolved, options } } = body;
    const { subcommandPath, target, reason } = resolveOptions(options, { target: ApplicationCommandOptionType.User, reason: ApplicationCommandOptionType.String })
    const targetUser = resolved?.users![target!]
    res.type = InteractionResponseType.DeferredChannelMessageWithSource;
    const { Stages, guildname, icon, modChannels } = guildConfig as Document;
    const { punishments } = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1 } }) as any;
    const activeWarns = punishments.length > 0 ? punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0) : 0;
    const totalWarns = activeWarns + 1;
    let warnType = subcommandPath[0] === 'ban' ? 'Ban' : subcommandPath[0] === 'kick' ? 'Kick' : subcommandPath[0] === 'mute' ? 'Mute' : 'Warn';
    const stage = Stages[activeWarns]
    let durationMs: number = 0, durationStr: string | null = null
    if ((Stages[activeWarns].minutes > 0 && warnType === 'Warn') || warnType == 'Mute') {
        const { unit, duration } = resolveOptions(options, { unit: ApplicationCommandOptionType.String, duration: ApplicationCommandOptionType.String })
        const unitMap: Record<string, number> = { min: 60000, hour: 3600000, day: 86400000 };
        durationMs = stage.minutes > 0 ? stage.minutes * 60000 : parseInt(duration!) * unitMap[unit!]!
        durationStr = stage.minutes > 0 ? stage.label : `${duration} ${unit}`;
        warnType = 'Mute'
    }
    const finalembed = new EmbedBuilder()
        .setColor(statusMap[warnType]!.color)
        .setAuthor({ name: `${targetUser!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : statusMap[warnType]!.cmd}`, iconURL: rest.cdn.avatar(targetUser!.id, targetUser!.avatar!) })
    const finalMessage: any = await rest.patch(Routes.webhookMessage(body.application_id, body.token), {
        body: { embeds: [finalembed.toJSON()] }
    });
    const object = new ObjectId();
    const newPunishment = { _id: object, userId: target, moderatorId: member!.user.id, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: 1, type: warnType, guildId: guild_id, channel: channel.id, refrence: `https://discord.com/channels/${guild_id}/${channel.id}/${finalMessage.id}`, warns: totalWarns - 1 };
    await usersCollection.updateOne({ userId: targetUser!.id, guildId: guild_id }, { $push: { punishments: newPunishment as any } });
    const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
    let dm = true
    const dmchannel = await rest.post(Routes.userChannels(), { body: { recipient_id: targetUser!.id } }) as APIDMChannel
    const dmResult = await rest.post(Routes.channelMessages(dmchannel.id), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: statusMap[warnType]!.color,
                components: [{
                    type: ComponentType.Section,
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: `${icon}` }
                    },
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `<@${targetUser!.id}>, ${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${guildname}](https://discord.com/channels/${guild_id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${guildname}` : `in ${guildname}`}`
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `Reason: \`${reason}\` ${['Ban', 'Kick'].includes(warnType) ? '' : `\nPunishment: ${durationStr ? `\`1 warn,${durationStr}\`` : `\`1 warn\``}`}\nActive Warnings: \`${totalWarns}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`
                        }]
                },
                    ...(warnType === 'Ban' ? [{
                        type: ComponentType.ActionRow,
                        components: [{
                            type: ComponentType.Button,
                            style: ButtonStyle.Link,
                            label: "Appeal",
                            url: 'https://discord.gg/qMjjyXyYbr'
                        }]
                    }] : [])]
            }]

        }
    }) 
    if (!dmResult) dm = false
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId: guild_id }, { $set: { Ban: targetUser!.id } });
            await rest.put(Routes.guildBan(guild_id!, targetUser!.id), { body: { delete_message_seconds: 604800 }, reason: `Ban Command: ${reason}` });
            break;
        case 'Mute':
            await rest.patch(Routes.guildMember(guild_id!, targetUser!.id), { body: { communication_disabled_until: new Date(Date.now() + Math.min(durationMs, 2419200000)).toISOString() }, reason: reason });
            break;
        case 'Kick':
            await rest.delete(Routes.guildMember(guild_id!, targetUser!.id));
            break;
    }
    await rest.post(Routes.channelMessages(warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: statusMap[warnType]!.color,
                components: [{
                    type: ComponentType.Section,
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: `https://cdn.discordapp.com/avatars/${targetUser!.id}/${targetUser!.avatar}.webp` }
                    },
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `${member!.user.username} ${statusMap[warnType]!.log}\n\nuser:<@${targetUser!.id}>\nChannel: <#${channel.id}>\nHistory: ${caseHistory.join(' | ') || "none"}\nReason: \`${reason}\`\n${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: ${durationStr ? `\`1 warn,${durationStr}\`` : `\`1 warn\``}`}\nNext Punishment: \`${Stages[Math.min(totalWarns - 1, Stages.length - 1)].label}\`\n\n${subtext(dm ? 'User DMed ✅' : 'User DMed 🚫')}`
                    }]
                }]
            }]
        }
    })
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne({ userId: targetUser!.id, guildId: guild_id }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
        }, 86400000);
    }
    return Response.json(res);
}
async function syncEmbed(guildId: string, embedName: string, config: { channelid: string, embeds: APIEmbed[], components: APIMessageTopLevelComponent[], reactions?: { emoji: string; roleId: string }[], format: string, messageId?: string }) {
    const { channelid, embeds, components, reactions, format, messageId: existingMessageId } = config;
    const isV2 = format === 'v2';
    const body = isV2 ? { flags: MessageFlags.IsComponentsV2, components: components } as APIMessage : { embeds: embeds, components: components } as APIMessage;
    const sendNewMessage = async () => {
        const message = await rest.post(Routes.channelMessages(channelid), { body }) as APIMessage;
        await guildconfigs.updateOne({ guildId }, { $set: { [`messageConfigs.${embedName}.messageId`]: message.id } });
        for (const reaction of reactions || []) {
            await rest.put(Routes.channelMessageOwnReaction(channelid, message.id, reaction.emoji));
        }
        await appendFile("./log.log", `📝 Sent '${embedName}'. Message ID: ${message.id}\n`);
        return { status: 'sent', messageId: message.id };
    };
    if (!existingMessageId) return sendNewMessage();

    let message: APIMessage;
    try {
        message = await rest.get(Routes.channelMessage(channelid, existingMessageId)) as APIMessage;
    } catch {
        return sendNewMessage();
    }
    const different = isV2 ? JSON.stringify(message.components) !== JSON.stringify(components ?? [])
        : message.embeds.map((e) => getComparableEmbed(e)).join('|||') !== embeds.map((e) => getComparableEmbed(e)).join('|||');
    if (different) await rest.patch(Routes.channelMessage(channelid, message.id), { body });
    await guildconfigs.updateOne({ guildId }, { $set: { [`messageConfigs.${embedName}.messageId`]: message.id } });
    return { status: 'updated', messageId: message.id, changed: different };
}
async function withGuards({ body, res, guildConfig, restrictedToFullMod = false }: CommandContext): Promise<Response | void> {
    const { member, data: { options, resolved } } = body;
    const { target } = resolveOptions(options, { target: ApplicationCommandOptionType.User } as const);
    const targetuser = resolved?.users?.[target!];
    const targetmember = resolved?.members?.[target!];
    const { modChannels, staffroles } = guildConfig as WithId<Document>;
    if (target === member?.user.id) {
        res.data = { embeds: [notice('You cannot moderate yourself.')], flags: MessageFlags.Ephemeral };
        return Response.json(res);
    }
    if (targetuser?.bot) {
        res.data = { embeds: [notice('You cannot moderate bots.')], flags: MessageFlags.Ephemeral };
        return Response.json(res);
    }
    if (restrictedToFullMod && member?.roles.includes(staffroles[2])) {
        await rest.post(Routes.channelMessages(modChannels.adminChannel), {
            body: { embeds: [{ description: `Jr. mod ${member?.user} tried to use a mod only command.` }] }
        });
        res.data = { embeds: [notice('Jr mods do not have access to this command.')], flags: MessageFlags.Ephemeral };
        return Response.json(res);
    }
    if (targetmember?.roles.some((r: string) => staffroles.includes(r))) {
        await rest.post(Routes.channelMessages(modChannels.adminChannel), {
            body: { embeds: [{ description: `<@${member?.user.id}> tried to moderate <@${targetuser!.id}>.` }] }
        });
        res.data = { embeds: [notice('You cannot moderate other staff members.')], flags: MessageFlags.Ephemeral };
        return Response.json(res);
    }
};
function buildApplicationHub(application: any | {}) {
    const sections = [1, 2, 3].map(part => {
        const done = PART_CONFIG[part]!.fields.every(f => application?.[f] !== undefined && application?.[f] !== '');
        return {
            type: ComponentType.Section,
            components: [{ type: ComponentType.TextDisplay, content: `${done ? '✅' : '⬜'} **Part ${part}: ${PART_CONFIG[part]!.modal.data.title}**` }],
            accessory: { type: ComponentType.Button, disabled: done, style: done ? ButtonStyle.Secondary : ButtonStyle.Primary, label: done ? 'Done' : 'Fill out', custom_id: `apply-part-${part}` },
        };
    });
    const allDone = [1, 2, 3].every(p => PART_CONFIG[p]!.fields.every(f => application?.[f] !== undefined && application?.[f] !== ''));
    return [{
        type: ComponentType.Container,
        accent_color: allDone ? 0x2ecc71 : 0x5865F2,
        components: [
            { type: ComponentType.TextDisplay, content: '## Moderator Application\nFill out each section below, in any order. You can reopen and edit a section any time before submitting.' },
            ...sections,
            { type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: 3, label: 'Submit Application', custom_id: 'apply-submit', disabled: !allDone }] },
        ],
    }];
}
commands.set('dnd', async ({ body, res }) => {
    const { subcommandPath } = resolveOptions(body.data.options, {})
    res.data = { content: `you rolled a ${Math.ceil(Math.random() * parseInt(subcommandPath[0]!))}` };
})
commands.set('games.rps', async ({ body, res }) => {
    const { member, guild_id, data: { options } } = body;
    const { choice } = resolveOptions(options, { choice: ApplicationCommandOptionType.String })
    const oppChoices = ['rock', 'paper', 'scissors'];
    const opp = oppChoices[Math.floor(Math.random() * 3)]!;
    const beats: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const result = beats[opp] === choice!.toLowerCase() ? 'you win!!!' : beats[choice!] === opp ? 'Febot Wins!!!' : "It's a tie!";
    if (result === 'you win!!!') await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: 20 } });
    const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(result)
        .setDescription(`You chose **${choice!}**.\nOpponent chose **${opp}**.`)
    res.data = { embeds: [embed.toJSON()] };
})
commands.set('games.logos', async ({ body }) => {
    const { member } = body;
    const { logolist } = await logos.findOne({}) as any;
    const logo = logolist[Math.floor(Math.random() * logolist.length)];
    const distractors = shuffle(logolist.filter((l: any) => l.brand !== logo.brand)).slice(0, 3).map((l: any) => l.brand);
    const comps = shuffle([logo.brand, ...distractors]).map((opt: string) =>
        new ButtonBuilder()
            .setCustomId(`logos-${opt}-${logo.brand}`)
            .setLabel(opt)
            .setStyle(ButtonStyle.Primary)
    )
    const form = new FormData();
    form.append('files[0]', new Blob([await Bun.file(logo.image).arrayBuffer()]), 'logo.png');
    const container = new ContainerBuilder()
        .setAccentColor(Math.floor(Math.random() * 16777215))
        .addTextDisplayComponents(new TextDisplayBuilder({ content: `Guess this logo ${member?.user.username}` }))
        .addMediaGalleryComponents(new MediaGalleryBuilder({ items: [{ media: { url: 'attachment://logo.png' } }] }))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(comps))
    form.append('payload_json', JSON.stringify({
        type: 4,
        data: {
            flags: MessageFlags.IsComponentsV2,
            components: [container.toJSON()],
            attachments: [{ id: 0, filename: 'logo.png' }]
        }
    }));
    return new Response(form);
})
commands.set('games.tictactoe', async ({ body, res }) => {
    const { member, data: { options } } = body;
    const { opponent } = resolveOptions(options, { opponent: ApplicationCommandOptionType.User });
    const me = member!.user.id;
    if (me === opponent) {
        res.data = { content: "You can't play against yourself.", flags: MessageFlags.Ephemeral };
        return;
    }
    const current = Math.random() < 0.5 ? me : opponent!;
    const container = new ContainerBuilder()
        .setAccentColor(0x0000ff)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@${opponent}>, <@${me}> wants to play tictactoe`))
        .addActionRowComponents(...generateButtons(Array(9).fill('_'), me, opponent!, current, false));
    res.data = { flags: MessageFlags.IsComponentsV2, components: [container.toJSON()] };
});
commands.set('games.highlow', async ({ res }) => {
    const { min, max } = rangeForStreak(0);
    const start = min + Math.ceil(Math.random() * (max - min));
    let secret = min + Math.ceil(Math.random() * (max - min));
    while (secret === start) secret = min + Math.ceil(Math.random() * (max - min));
    const embed = new EmbedBuilder()
        .setColor(0x333300)
        .setTitle('Higher or Lower')
        .setDescription('I am thinking of a number. Do you think my number is higher or lower than the number below?')
        .addFields({ name: 'Current Number:', value: `${start}` });
    const row = highlowRow(start, secret, 0, 0, min, max)
    res.data = { embeds: [embed.toJSON()], components: [row.toJSON()] };
});
commands.set('games.bet', async ({ body, res }) => {
    const { member, guild_id, data: { options } } = body;
    const { amount } = resolveOptions(options, { amount: ApplicationCommandOptionType.Integer });
    const user = member!.user;
    const doc = await usersCollection.findOne({ userId: user.id, guildId: guild_id }, { projection: { coins: 1 } });
    const coins: number = doc?.coins ?? 0;
    if (!amount || amount <= 0 || amount > coins) {
        res.data = { content: amount && amount > 0 ? 'You cannot bet more than you have!' : 'Your bet must be at least 1.', flags: MessageFlags.Ephemeral };
        return;
    }
    const win = Math.random() >= 0.5;
    await usersCollection.updateOne({ userId: user.id, guildId: guild_id }, { $inc: { coins: win ? Math.ceil(amount * 1.5) : -amount } });
    const embed = new EmbedBuilder()
        .setColor(win ? 0x007a00 : 0x7a0000)
        .setAuthor({ name: `${user.username} you bet ${amount} and ${win ? 'won' : 'lost'}!`, iconURL: avatarOf(user) });
    res.data = { embeds: [embed.toJSON()] };
});
commands.set('appeal', async ({ body, res, guildConfig }) => {
    const { member, guild_id } = body;
    const { guildname } = guildConfig as WithId<Document>;
    const userdata = await usersCollection.find({ userId: member?.user.id }).toArray();
    const seenGuilds = new Map<string, string>();
    for (const data of userdata) {
        for (const p of data.punishments || []) {
            const ban = p.filter((p: any) => p.type == "Ban")
            if (ban.length > 0 && !seenGuilds.has(guild_id!)) seenGuilds.set(guild_id!, guildname);
        }
    }
    const opts = Array.from(seenGuilds).map(([id, gName]) => ({ label: gName, value: id }));
    if (!opts.length) {
        res.data = { content: "I couldn't find any entries", flags: MessageFlags.Ephemeral };
        return;
    }
    const modal = new ModalBuilder()
        .setCustomId('appealModal')
        .setTitle('Ban Appeal Submission')
        .addLabelComponents([
            { type: ComponentType.Label, label: "Guild", component: { type: ComponentType.StringSelect, custom_id: 'guildId', max_values: 1, options: opts, required: true } },
            { type: ComponentType.Label, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 1, required: true } },
            { type: ComponentType.Label, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
            { type: ComponentType.Label, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } },
            { type: ComponentType.Label, label: 'Ban appeal evidence can go here.', component: { type: 19, custom_id: 'evidence', required: false, min_values: 1, max_values: 5 } }
        ])
    res.type = InteractionResponseType.Modal;
    res.data = modal.toJSON();
});
commands.set('rank', async ({ body, guildConfig }) => {
    const { member, guild_id, data: { options, resolved } } = body
    const { target } = resolveOptions(options, { target: ApplicationCommandOptionType.User })
    const targetUser = options ? resolved!.users![target!] : member!.user;
    const { level, xp, coins, totalmessages } = await usersCollection.findOne({ userId: targetUser!.id, guildId: guild_id }, { projection: { level: 1, xp: 1, coins: 1, avatar: 1, totalmessages: 1, nick: 1 } }) as Document;
    const { exponent, baseMultiplier, roundToNearest, flatOffset } = guildConfig as Document
    const rank = await usersCollection.countDocuments({ guildId: guild_id, $or: [{ level: { $gt: level } }, { level: level, xp: { $gt: xp } }] });
    const avRes = await fetch(avatarOf({ id: targetUser!.id!, avatar: targetUser!.avatar! }));
    const resizedAvatarBuf = await new Bun.Image(await avRes.arrayBuffer()).resize(100, 100).png().toBase64();
    const reqXp = Math.round(((level < 100 ? level : 100) ** exponent * baseMultiplier + flatOffset) / roundToNearest);
    const rankCardSvg = `<svg width="500" height="150" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="avatarClip"><circle cx="70" cy="75" r="50"/></clipPath></defs><rect width="500" height="150" rx="16" fill="#2c2f33"/><circle cx="70" cy="75" r="52" stroke="#3ba55d" stroke-width="3" fill="none" /><image href="data:image/png;base64,${resizedAvatarBuf}" x="20" y="25" width="100" height="100" clip-path="url(#avatarClip)"/><text x="130" y="60" fill="white" font-size="20" font-family="Arial" font-weight="bold">${targetUser?.username.slice(0, 15) + (targetUser?.username.length! > 15 ? "..." : "")}</text><text x="300" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="middle">Level ${level}</text><text x="440" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="end">Rank #${rank + 1}</text><rect x="130" y="85" width="350" height="20" rx="10" fill="#484b4e"/><rect x="130" y="85" width="${Math.min(Math.max(350 * (xp / reqXp), 25), 350)}" height="20" rx="10" fill="#3ba55d"/><text x="480" y="75" fill="#ccc" font-size="16" font-family="Arial" text-anchor="end">${xp} / ${reqXp} xp</text><text x="150" y="130" fill="#ccc" font-size="18" font-family="Arial">Coins: ${coins} | Messages: ${totalmessages}</text></svg>`;
    const rankCardBuffer = await sharp(Buffer.from(rankCardSvg)).png().toBuffer();
    const form = new FormData();
    form.append('files[0]', new Blob([rankCardBuffer], { type: "image/png" }), 'rankcard.png');
    form.append('payload_json', JSON.stringify({ type: InteractionResponseType.ChannelMessageWithSource }));
    return new Response(form);
});
commands.set('blacklist.show', async ({ body, res, }) => {
    const { guild_id, data: { resolved, options } } = body;
    const { target } = resolveOptions(options, { target: ApplicationCommandOptionType.User });
    const { embed } = await buildBlacklistEmbed(resolved?.users![target!]!, guild_id);
    res.data = { embeds: [embed] };
});
commands.set('blacklist.add', async ({ body, res }) => {
    const { guild_id, data: { resolved, options } } = body;
    const { target, role } = resolveOptions(options, { target: ApplicationCommandOptionType.User, role: ApplicationCommandOptionType.Role })
    const { embed, blacklist } = await buildBlacklistEmbed(resolved?.users![target!]!, guild_id!);
    if (!blacklist.includes(role as string)) {
        await usersCollection.updateOne({ userId: target, guildId: guild_id }, { $push: { blacklist: role } as any });
        await rest.delete(Routes.guildMemberRole(guild_id!, target!, role as string))
        embed.setDescription(`<@&${role}> was blacklisted from <@${target!}>`);
    } else {
        embed.setDescription(`<@&${role}> is already blacklisted from <@${target!}>`);
    }
    res.data = { embeds: [embed] };
});
commands.set('blacklist.remove', async ({ body, res }) => {
    const { guild_id, data: { resolved, options } } = body;
    const { target, role } = resolveOptions(options, { target: ApplicationCommandOptionType.User, role: ApplicationCommandOptionType.Role })
    const targetUser = resolved?.users![target!]
    const { embed } = await buildBlacklistEmbed(targetUser!, guild_id!);
    await usersCollection.updateOne({ userId: targetUser!.id, guildId: guild_id }, { $pull: { blacklist: role } as any });
    embed.setDescription(`<@&${role}> was removed from <@${targetUser!}>'s blacklist`);
    res.data = { embeds: [embed] };
});
commands.set('apply', async ({ body, res }) => {
    const { member, guild_id } = body;
    const doc = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { application: 1 } }) as any;
    res.type = InteractionResponseType.ChannelMessageWithSource
    res.data = { flags: MessageFlags.IsComponentsV2, components: buildApplicationHub(doc?.application ?? {}) };
});
commands.set('leaderboard', async ({ body, res }) => {
    const { guild_id } = body;
    const board = await usersCollection.find({ guildId: guild_id }).sort({ level: -1, xp: -1 }).limit(10).toArray();
    const guild = await rest.get(Routes.guild(guild_id!)) as APIGuild;
    const embed = new EmbedBuilder()
        .setTitle(`Most active in ${guild.name}`)
        .setColor(0x0c23a3)
        .setDescription(`**__LeaderBoard:__**\n${board.map((u, i) => `Rank \`${i + 1}\`: <@${u.userId}> - level \`${u.level}\` with \`${u.xp}\` xp`).join('\n')}`)
        .setTimestamp();
    if (guild.icon) embed.setThumbnail(rest.cdn.icon(guild_id!, guild.icon));
    res.data = { embeds: [embed.toJSON()] };
});
commands.set('modlogs', async ({ body, res }) => {
    const { member, guild_id, id, message, token, data: { options, resolved } } = body;
    const { target } = resolveOptions(options, { target: ApplicationCommandOptionType.User })
    const targetUser = resolved!.users![target!];
    const isAdmin = (BigInt(member!.permissions) & 8n) !== 0n;
    const { punishments } = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1, avatar: 1 } }) as any;
    if (!punishments?.length) {
        res.data = { embeds: [{ color: 0xf58931, description: `❌ No modlogs found for <@${targetUser!.id}>.` }] };
        return;
    }
    setTimeout(() => {
        const components = findComponent(message?.components!, c => 'custom_id' in c && c.custom_id.startsWith('modlog_')) as APIButtonComponentWithCustomId
        if (components) { components.disabled = true }
        rest.patch(Routes.webhookMessage(id, token), { body: { components: [{ type: 1, components: message?.components }] } }).catch(() => null);
    }, 600000);
    const moderator = await rest.get(Routes.user(punishments[0].moderatorId)) as APIUser
    res.data = buildModlogView(punishments, 0, targetUser!, moderator, member!.user.id, isAdmin)
});
commands.set('note.add', async ({ body, res }) => {
    const { member, guild_id, data: { options, resolved } } = body;
    const { target, note } = resolveOptions(options, { target: ApplicationCommandOptionType.User, note: ApplicationCommandOptionType.String });
    const targetUser = resolved!.users![target!]!;
    const result = await usersCollection.updateOne(
        { userId: targetUser.id, guildId: guild_id },
        { $push: { notes: { _id: new ObjectId(), moderatorId: member?.user.id, note, timestamp: Date.now() } } as any },
    );
    if (!result.matchedCount) {
        res.data = { embeds: [notice(`❌ No record found for <@${targetUser.id}>.`)], flags: MessageFlags.Ephemeral };
        return;
    }
    const container = new ContainerBuilder()
        .setAccentColor(0x00a900)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`📝 note created for <@${targetUser.id}>\n\n${quote(note!)}`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarOf(targetUser))),
        );
    res.data = { flags: MessageFlags.IsComponentsV2, components: [container.toJSON()] };
});
commands.set('note.show', async ({ body, res }) => {
    const { member, guild_id, data: { resolved, options } } = body;
    const { target } = resolveOptions(options, { target: ApplicationCommandOptionType.User })
    const u = resolved?.users![target!];
    const doc = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { notes: 1 } });
    const sortednotes: any[] = [...(doc?.notes ?? [])].sort((a, b) => b.timestamp - a.timestamp);
    if (!sortednotes.length) {
        res.data = { embeds: [new EmbedBuilder().setColor(0x00a900).setDescription(`❌ No notes found for <@${u!.id}>`).setThumbnail(avatarOf(u!)).toJSON()] };
        return;
    }
    const mod = await rest.get(Routes.user(sortednotes[0].moderatorId)) as APIUser;
    res.data = v2(buildNoteView(sortednotes, 0, u!, mod, member.user.id))
});
commands.set('applications.open', async ({ res, guildConfig }) => {
    const { modChannels } = guildConfig as Document
    await rest.put(Routes.channelPermission(modChannels.applyChannel, modChannels.applyChannel), { body: { type: 0, allow: "2147484672", deny: "0" } })
    res.data = { content: 'Apps have now been opened!' };
});
commands.set('applications.close', async ({ body, res, guildConfig }) => {
    const { modChannels } = guildConfig as Document;
    await rest.put(Routes.channelPermission(modChannels.applyChannel, modChannels.applyChannel), { body: { type: 0, allow: "0", deny: "2147484672", } })
    await usersCollection.updateMany({ guildId: body.guild_id }, { $set: { application: {} } });
    res.data = { content: 'Apps have now been closed!' };
});
commands.set('member.mute', async ({ body, res, guildConfig }) => {
    const blocked = await withGuards({ body, res, guildConfig });
    if (blocked) return blocked;
    runPunishment({ body, res, guildConfig }).catch(console.error);
    const { duration } = resolveOptions(body.data.options, { duration: ApplicationCommandOptionType.Integer } as const);
    if (duration! <= 0) { res.data = { embeds: [{ description: '❌ Invalid duration' }] }; return Response.json(res); }
    res.type = InteractionResponseType.DeferredChannelMessageWithSource
    return Response.json(res)
})
commands.set('member.ban', async ({ body, res, guildConfig, restrictedToFullMod = true }) => {
    const blocked = await withGuards({ body, res, guildConfig, restrictedToFullMod });
    if (blocked) return blocked;
    runPunishment({ body, res, guildConfig }).catch(console.error);
    res.type = InteractionResponseType.DeferredChannelMessageWithSource;
    return Response.json(res);
});
commands.set('member.warn', async ({ body, res, guildConfig }) => {
    await withGuards({ body, res, guildConfig })
    runPunishment({ body, res, guildConfig })
    res.type = InteractionResponseType.DeferredChannelMessageWithSource
    return Response.json(res)
});
commands.set('member.unwarn', async ({ body, res, guildConfig, restrictedToFullMod = true, }) => {
    const { target } = resolveOptions(body.data.options, { target: ApplicationCommandOptionType.User })
    await withGuards({ body, res, guildConfig, restrictedToFullMod })
    const { punishments } = await usersCollection.findOne({ userId: target, guildId: body.guild_id }, { projection: { punishments: 1 } }) as Document;
    const removed = punishments?.filter((p: any) => p.type === 'Warn').sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
    if (removed) { await usersCollection.updateOne({ userId: target, guildId: body.guild_id }, { $pull: { punishments: { _id: removed._id } } as any }); }
    res.data = removed ? { embeds: [notice(`Recent warn removed from <@${target}>`)] } : { embeds: [{ description: `no recent warns found for <@${target}>` }] };
    return Response.json(res)
})
commands.set('member.unmute', async ({ body, res, guildConfig, targetmember, targetuser, restrictedToFullMod = true }) => {
    await withGuards({ body, res, guildConfig, restrictedToFullMod })
    if (targetmember?.communication_disabled_until) {
        await rest.patch(Routes.guildMember(body.guild_id!, targetuser!.id), { body: { communication_disabled_until: null } });
        res.data = { embeds: [notice('⚠️ User has been unmuted.')] };
    } else {
        res.data = { embeds: [notice('⚠️ User is not muted.')] };
    }
    return Response.json(res)
})
commands.set('link', async ({ body, res }) => {
    const { member, data: { options } } = body;
    const { channel } = resolveOptions(options, { channel: ApplicationCommandOptionType.String })
    const twitchUser = await Client.users.getUserByName(channel!)
    if (!twitchUser) {
        res.data = { embeds: [{ description: `No Twitch channel found for \`${channel}\`.` }], flags: MessageFlags.Ephemeral };
        return;
    }
    await usersCollection.updateOne({ userId: member?.user.id, guildId: '1231453115937587270' }, { $set: { twitchChannelId: twitchUser.id, twitchChannelLogin: twitchUser.name } });
    res.data = { embeds: [{ description: `Level Linked to Twitch channel **${twitchUser.displayName}**.` }], flags: MessageFlags.Ephemeral };
});
commands.set('restart', async ({ res }) => {
    const botPid = parseInt(await Bun.file("./pid.txt").text());
    res.data = { embeds: [notice("🔄 **Restarting bot..**", 0x5865F2)] };
    Bun.spawn(["powershell", "-ExecutionPolicy", "Bypass", "-File", "C:\\Users\\micha\\Desktop\\Bot\\restart.ps1", "-BotPid", `${botPid}`, "-intpid", `${process.pid}`], { stderr: "pipe", stdout: 'pipe', stdin: 'pipe' });
});
const activeCooldowns = new Collection<string, number>(); // userId -> expiry timestamp
function checkCooldown(userId: string, isStaff: boolean, cooldownMs: number): Response | null {
    if (isStaff || cooldownMs <= 0) return null;
    const expiry = activeCooldowns.get(userId);
    if (expiry && expiry > Date.now()) {
        return Response.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { embeds: [{ description: `<@${userId}>, you are using commands too fast!` }], flags: MessageFlags.Ephemeral }
        });
    }
    activeCooldowns.set(userId, Date.now() + cooldownMs);
    return null;
}
async function handleCommands(body: APIChatInputApplicationCommandGuildInteraction) {
    const { guild_id, member, data: { name, options } } = body;
    const guildConfig = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, publicChannel: 1, staffroles: 1, guildname: 1, exponent: 1, baseMultiplier: 1, roundToNearest: 1, flatOffset: 1, icon: 1, Stages: 1 }, });
    const { subcommandPath } = resolveOptions(options, { subcommand: ApplicationCommandOptionType.Subcommand })
    const key = subcommandPath.length > 0 && name != "dnd" ? `${name}.${subcommandPath}` : name;
    const handler = commands.get(key);
    if (!handler) return Response.json({ type: InteractionResponseType.ChannelMessageWithSource, data: { content: `Unhandled command: ${key}`, flags: MessageFlags.Ephemeral } });
    if (member?.user.id) {
        const { staffroles } = guildConfig as WithId<Document>;
        const isStaff = member.roles.some((r: string) => staffroles.includes(r));
        const blocked = checkCooldown(member.user.id, isStaff, handler.cooldownMs ?? 3000);
        if (blocked) return blocked;
    }
    const res: { type: InteractionResponseType; data: any } = { type: InteractionResponseType.ChannelMessageWithSource, data: {} };
    return await handler({ body, res, guildConfig }) ?? Response.json(res);
}
async function handleModals(body: APIModalSubmitInteraction) {
    const { guild_id, member, data: { custom_id, components, resolved } } = body;
    const updates: Record<string, any> = {};
    const res: { type: InteractionResponseType, data: APIMessage | {} } = { type: InteractionResponseType.ChannelMessageWithSource, data: {} }
    if (custom_id.startsWith('appeal')) {
        const [gId, reason, justification, extra] = components as any;
        const targetGuild = gId.component.values[0];
        const gConf = await guildconfigs.findOne({ guildId: targetGuild }, { projection: { staffroles: 1, modChannels: 1 } }) as any;
        const attachments = resolved?.attachments || {};
        const appealMsg = await rest.post(Routes.channelMessages(gConf.modChannels.appealChannel), {
            body: {
                flags: MessageFlags.IsComponentsV2,
                components: [
                    { type: ComponentType.TextDisplay, content: `<@&${gConf.staffroles[0]}> <@&${gConf.staffroles[1]}>` },
                    {
                        type: ComponentType.Container,
                        accent_color: 0x13cbd8,
                        components: [
                            {
                                type: ComponentType.Section,
                                components: [{
                                    type: ComponentType.TextDisplay,
                                    content: `Appeal for <@${member?.user.id}>\n\nWhy did you get banned?\n${reason.component.value}\n\nWhy should we accept your appeal?\n${justification.component.value}\n\nExtra info:\n${extra.component.value || "None"}`
                                }],
                                accessory: { type: ComponentType.Thumbnail, media: { url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` } },
                            },
                            ...(Object.keys(attachments).length ? [{
                                type: ComponentType.MediaGallery,
                                items: Object.values(attachments).map((i: any) => ({ media: { url: i.url } })),
                            }] : []),
                        ],
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            { type: ComponentType.Button, custom_id: `unban_approve_${member?.user.id}`, label: 'Approve', style: ButtonStyle.Success },
                            { type: ComponentType.Button, custom_id: `unban_reject_${member?.user.id}`, label: 'Reject', style: ButtonStyle.Danger },
                        ],
                    },
                ],
            }
        }) as APIMessage
        await rest.post(Routes.threads(gConf.modChannels.appealChannel, appealMsg.id), { body: { type: 11, name: `${member?.user.username}` } });
        await usersCollection.updateOne({ userId: member?.user.id, guildId: targetGuild }, { $set: { appeals: { _id: new ObjectId(), reason: reason.component.value, justification: justification.component.value, extra: extra.component.value } } });
        res.data = { content: 'Your appeal has been submitted!', flags: 64 };
    }
    else if (custom_id.startsWith('apply-modal-')) {
        const part = Number(custom_id.split('-')[2]);
        const { modal, fields } = PART_CONFIG[part]!;
        if (modal) {
            (components).forEach((row: any) => {
                if (!row.component) return;
                const index = modal.components.findIndex((f: any) => f.component.custom_id === row.component.custom_id);
                if (index === -1) return;
                const dbKey = fields[index];
                updates[`application.${dbKey}`] = row.component.type === ComponentType.StringSelect ? row.component.values?.[0] : row.component.value;
            });

            await usersCollection.updateOne({ userId: member?.user.id, guildId: guild_id }, { $set: updates });
        }
        const doc = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { application: 1 } }) as any;
        res.type = InteractionResponseType.UpdateMessage;
        res.data = { flags: MessageFlags.IsComponentsV2, components: buildApplicationHub(doc?.application ?? {}) };
    }
    return Response.json(res)
}
function winProbability(choice: string, start: number, min: number, max: number): number {
    const count = choice === 'higher' ? (max - start) : (start - min);
    return Math.max(count, 1) / (max - min);
}
async function handleComponents(body: APIMessageComponentInteraction) {
    const res: { type: InteractionResponseType, data: ModalBuilder | APIMessage | {} } = { type: InteractionResponseType.UpdateMessage, data: {} }
    const { token, guild_id, member, data: { custom_id }, channel, application_id, message } = body
    const { modChannels, appealInvite, staffroles, generalchannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, staffroles: 1, appealInvite: 1, generalchannels: 1 } }) as Document
    const isAdmin = (BigInt(member!.permissions || 0n) & 8n) !== 0n;
    if (custom_id.startsWith('ban_')) {
        const [, targetId, inviteCode] = custom_id.split('_');
        if (member?.roles.includes(staffroles[2])) return ephemeral('jrs cannot use this button.');
        const targetUser = await rest.get(Routes.user(targetId!)) as APIUser;
        res.type = InteractionResponseType.DeferredChannelMessageWithSource;
        const { guildname, icon } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { guildname: 1, icon: 1 } }) as Document;
        await guildconfigs.updateOne({ guildId: guild_id }, { $set: { Ban: targetId } });
        const doc = await usersCollection.findOne({ userId: targetUser.id, guildId: guild_id }, { projection: { punishments: 1 } });
        const punishments: any[] = doc?.punishments ?? [];
        const avatar = avatarOf(targetUser);
        const finalMessage = await rest.post(Routes.webhook(application_id, token), {
            body: {
                embeds: [new EmbedBuilder().setColor(0xd10000).setAuthor({ name: `<@${targetUser.id}> was banned`, iconURL: avatar }).toJSON()]
            }
        }) as APIMessage

        const newPunishment = { _id: new ObjectId(), userId: targetUser.id, moderatorId: member!.user.id, reason: 'troll', duration: 0, timestamp: Date.now(), active: 1, weight: 1, type: 'Ban', guildId: guild_id, channel: channel.id, refrence: `https://discord.com/channels/${guild_id}/${channel.id}/${finalMessage.id}`, warns: 1 };
        await usersCollection.updateOne({ userId: targetUser.id, guildId: guild_id }, { $push: { punishments: newPunishment as any } });
        const caseHistory = [...punishments, newPunishment].filter(r => r.type === 'Ban').slice(0, 10)
            .map((p, i) => p.refrence ? `[Case ${i + 1}](${p.refrence})` : null).filter(Boolean);

        let dm = true;
        try {
            const dmchannel = await rest.post(Routes.userChannels(), { body: { recipient_id: targetUser.id } }) as APIDMChannel;
            const dmContainer = new ContainerBuilder()
                .setAccentColor(0xd10000)
                .addSectionComponents(section(
                    `<@${targetUser.id}>, you were banned from [${guildname}](https://discord.com/channels/${guild_id}). To appeal this decision, please join our dedicated appeal server using the button below.\n${bold('Reason:')} ${quote('troll')}`,
                    rest.cdn.icon(guild_id!, icon),
                ))
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Appeal').setURL('https://discord.gg/qMjjyXyYbr'),
                ));
            await rest.post(Routes.channelMessages(dmchannel.id), { body: v2(dmContainer) });
        } catch { dm = false; }

        await rest.put(Routes.guildBan(guild_id!, targetUser.id), { body: { delete_message_seconds: 604800 }, reason: 'Ban Command: troll' });
        await rest.post(Routes.channelMessages(modChannels.banlogChannel), {
            body: v2(new ContainerBuilder().setAccentColor(0xd10000).addSectionComponents(section(
                `${member!.user.username} banned a member\n\nuser: <@${targetUser.id}>\nChannel: <#${channel.id}>\nHistory: ${caseHistory.join(' | ') || 'none'}\nReason: Troll\n\n${subtext(dm ? 'User DMed ✅' : 'User DMed 🚫')}`,
                avatar,
            ))),
        });
        if (inviteCode !== 'none') await rest.delete(Routes.invite(inviteCode!));
        const btn = findComponent(message.components!, c => 'custom_id' in c && c.custom_id.startsWith('ban_')) as APIButtonComponentWithCustomId | null;
        if (btn) {
            btn.disabled = true;
            btn.style = ButtonStyle.Secondary;
            btn.label = inviteCode !== 'none' ? '🔨 Banned & Invite Deleted!' : '🔨 Banned!';
        }
        await rest.patch(Routes.channelMessage(channel.id, message.id), { body: { flags: MessageFlags.IsComponentsV2, components: message.components } });
    }
    else if (custom_id.startsWith('unban_')) {
        const [, action, userId] = custom_id.split('_');
        const approved = action === 'approve';
        const color = approved ? 0x008900 : 0x890000;
        const targetUser = await rest.get(Routes.user(userId!)) as APIUser;
        const doc = await usersCollection.findOne({ userId, guildId: guild_id }, { projection: { appeals: 1 } });
        const appeals = doc?.appeals;
        if (!appeals) return ephemeral('I could not find any appeal entries');
        if (!member?.roles.includes(staffroles[0])) {
            await rest.post(Routes.channelMessages(modChannels.adminChannel), { body: { embeds: [notice(`Letting you know <@${member?.user.id}> tried to jump the gun on an appeal.`)] } });
            return ephemeral('Please wait for an admin to make a decision.');
        }
        if (!approved) await usersCollection.deleteOne({ userId, guildId: guild_id }); // wipes the whole doc, see issue 9
        else {
            await rest.delete(Routes.guildBan(guild_id!, userId!));
            await usersCollection.updateOne({ userId, guildId: guild_id }, { $set: { appeals: {} } });
        }
        try {
            const dm = await rest.post(Routes.userChannels(), { body: { recipient_id: userId } }) as APIDMChannel;
            await rest.post(Routes.channelMessages(dm.id), {
                body: {
                    embeds: [new EmbedBuilder().setColor(color).setDescription(
                        approved ? `<@${userId}> your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealInvite}` : `<@${userId}> your ban appeal has been denied.`,
                    ).toJSON()]
                },
            });
        } catch { /* DMs closed */ }
        const gallery = findComponent(message.components!, c => c.type === ComponentType.MediaGallery) as APIMediaGalleryComponent | null;
        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addSectionComponents(section(
                `## Ban appeal: ${approved ? 'Approved' : 'Denied'}\n**Why did you get banned?**\n${appeals.reason}\n\n**Why accept appeal?**\n${appeals.justification}\n\n**Extra info**\n${appeals.extra || 'None'}`,
                avatarOf(targetUser),
            ));
        if (gallery) container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(gallery.items.map(i => ({ media: { url: i.media.url } }))),
        );
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            subtext(`${approved ? 'Approved' : 'Denied'} by <@${member.user.id}> | User ID: ${userId}`),
        ));
        res.data = v2(container);
    }
    else if (custom_id.startsWith('apply-part-')) {
        const part = Number(custom_id.split('-')[2]);
        res.type = InteractionResponseType.Modal;
        res.data = PART_CONFIG[part]!.modal.toJSON();
    }
    else if (custom_id === 'apply-submit') {
        const doc = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { application: 1 } });
        const application = doc?.application ?? {};
        const APP_FIELDS: [string, string][] = [
            ['Age Range:', 'Agerange'], ['Prior Experience:', 'Experience'], ['History:', 'History'], ['Timezone:', 'Timezone'],
            ['Server Activity:', 'Activity'], ['Why mod?:', 'why'], ['Troll definition:', 'Trolldef'], ['Raid definition:', 'Raiddef'],
            ['Staff issues action:', 'Staffissues'], ['Member report action:', 'Memberreport'],
            ['Harassment via DM response:', 'dmmember'], ['General chat argument step:', 'arguments'],
            ['Rulebreaking DM response:', 'rulebreakdm'], ['Mod breaking rules step:', 'staffrulebreak'], ['Illegal content step:', 'illegal'],
        ];
        const embed = new EmbedBuilder()
            .setColor(0x13b6df)
            .setTitle('Mod Application')
            .setAuthor({ name: `@${member!.user.username}`, iconURL: avatarOf(member!.user) })
            .addFields(APP_FIELDS.map(([name, key]) => ({ name, value: String(application[key] ?? 'N/A').slice(0, 1024) })))
            .setTimestamp();
        await rest.post(Routes.channelMessages(modChannels.applicationChannel), { body: { embeds: [embed.toJSON()] } });
        await usersCollection.updateOne({ userId: member?.user.id, guildId: guild_id }, { $set: { application: {} } });

        res.data = v2(new ContainerBuilder().setAccentColor(0x2ecc71).addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Application submitted!\nThanks for applying — the mod team will review it soon.'),
        ));
        // assuming you meant to clear the user's hub message, not the staff-channel post:
        setTimeout(() => { rest.delete(Routes.webhookMessage(application_id, token)).catch(() => null); }, 60_000);
    }
    else if (custom_id.startsWith('note-') || custom_id.startsWith('modlog-')) {
        const isNote = custom_id.startsWith('note-');
        const [, action, target, index, opener, itemId] = custom_id.split('-');
        if (member!.user.id !== opener) return ephemeral('You did not initiate this command');
        const targetUser = await rest.get(Routes.user(target!)) as APIUser;
        let idx = parseInt(index!);

        if (action === 'del') {
            const itemObjId = ObjectId.createFromHexString(itemId!);
            if (isNote) {
                const found = await usersCollection.findOne({ userId: target, guildId: guild_id, 'notes._id': itemObjId }, { projection: { 'notes.$': 1 } });
                const note = found?.notes?.[0];
                if (note && !isAdmin && Date.now() - note.timestamp >= 172_800_000) return ephemeral('Contact an admin, deletion time expired.');
                if (note) await usersCollection.updateOne({ userId: target, guildId: guild_id }, { $pull: { notes: { _id: itemObjId } } as any });
            } else {
                await usersCollection.updateOne({ userId: target, guildId: guild_id }, { $pull: { punishments: { _id: itemObjId } } as any });
            }
            idx = Math.max(0, idx - 1);
        } else {
            idx = Math.max(0, action === 'next' ? idx + 1 : idx - 1);
        }

        if (isNote) {
            const doc = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { notes: 1 } });
            const notes: any[] = [...(doc?.notes ?? [])].sort((a, b) => b.timestamp - a.timestamp);
            if (!notes.length) {
                res.data = v2(new ContainerBuilder().setAccentColor(0xdddddd).addTextDisplayComponents(new TextDisplayBuilder().setContent('All notes deleted.')));
                return Response.json(res);
            }
            idx = Math.min(idx, notes.length - 1);
            const mod = await rest.get(Routes.user(notes[idx].moderatorId)) as APIUser;
            res.data = v2(buildNoteView(notes, idx, targetUser, mod, opener!));
        } else {
            const doc = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1 } });
            const logs: any[] = doc?.punishments ?? [];
            if (!logs.length) {
                res.data = { embeds: [notice('All logs deleted.')], components: [] };
                return Response.json(res);
            }
            idx = Math.min(idx, logs.length - 1);
            const mod = await rest.get(Routes.user(logs[idx].moderatorId)) as APIUser;
            res.data = buildModlogView(logs, idx, targetUser, mod, opener!, isAdmin);
        }
    }
    else if (custom_id.startsWith('logos')) {
        const [, guess, logo] = custom_id.split('-');
        const { components } = message
        const ButtonRow = findComponent(components!, c => 'components' in c && c.components.some(b => 'custom_id' in b)) as APIActionRowComponent<APIButtonComponentWithCustomId>;
        ButtonRow!.components = ButtonRow!.components.map((b) => {
            const brand = b.custom_id?.split('-')[1];
            return {
                ...b,
                style: brand === logo ? ButtonStyle.Success : brand === guess ? ButtonStyle.Danger : ButtonStyle.Secondary,
                disabled: true
            };
        });
        if (guess === logo) await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: 20 } });
        res.type = InteractionResponseType.UpdateMessage;
        res.data = { flags: MessageFlags.IsComponentsV2, components: components };
    }
    else if (custom_id.startsWith('ttt-')) {
        const [, boardStr, player1, player2, currentplayer, index] = custom_id.split('-');
        if (member?.user.id !== currentplayer) return Response.json({ type: InteractionResponseType.ChannelMessageWithSource, data: { content: "It's not your turn.", flags: MessageFlags.Ephemeral } });
        const board = boardStr!.split('');
        const marker = currentplayer === player1 ? 'X' : 'O';
        board[parseInt(index!)] = marker;
        const win = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].some((c: number[]) => c.every((i: number) => board[i] === marker));
        const tie = !win && board.every((c: string) => c !== '_');
        if (win || tie) {
            if (win) await usersCollection.findOneAndUpdate({ userId: currentplayer, guildId: guild_id }, { $inc: { coins: 100 } });
            setTimeout(() => { rest.delete(Routes.webhookMessage(application_id, token)).catch(() => null); }, 10000);
        }
        const nextPl = currentplayer === player1 ? player2 : player1;
        res.data = v2(
            new ContainerBuilder()
                .setAccentColor(win ? 0xceab10 : tie ? 0x555555 : 0x0000ff)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${bold('TicTacToe')}\n${win ? `<@${currentplayer}> wins!` : tie ? "It's a draw!" : `It's <@${nextPl}> turn!`}`,
                ))
                .addActionRowComponents(...generateButtons(board, player1!, player2!, nextPl!, win || tie)),
        );
    }
    else if (custom_id.startsWith('highlow-')) {
        const owner = message.interaction_metadata?.user.id; // verify this field exists in your discord-api-types version
        if (owner && owner !== member!.user.id) return ephemeral('This is not your game.');
        const [, choice, startNum, secretNum, streakNum, potNum, prevMin, prevMax] = custom_id.split('-');
        if (choice === 'cashout') {
            const pot = parseInt(startNum!);
            await usersCollection.updateOne({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: pot } });
            res.data = {
                embeds: [new EmbedBuilder().setTitle('Cashed Out 💰').setColor(0x2ecc71).setDescription(`You walked away with **${pot}** coins. Smart move, or was it?`).toJSON()],
                components: [],
            };
        } else {
            const start = parseInt(startNum!), secret = parseInt(secretNum!), streak = parseInt(streakNum!), pot = parseInt(potNum!);
            const won = (choice === 'higher' && secret > start) || (choice === 'lower' && secret < start);
            if (won) {
                const gained = Math.round(8 / winProbability(choice!, start, parseInt(prevMin!), parseInt(prevMax!)));
                const { min, max } = rangeForStreak(streak + 1);
                const newStart = min + Math.ceil(Math.random() * (max - min));
                let newSecret = min + Math.ceil(Math.random() * (max - min));
                while (newSecret === newStart) newSecret = min + Math.ceil(Math.random() * (max - min));
                res.data = {
                    embeds: [new EmbedBuilder()
                        .setTitle(`Correct! (Streak: ${streak + 1})`)
                        .setColor(0xc79c0f)
                        .setDescription(`📉 Range tightening — this round's number is between **${min}** and **${max}**.`)
                        .addFields({ name: 'Current Number:', value: `${newStart}` })
                        .toJSON()],
                    components: [highlowRow(newStart, newSecret, streak + 1, pot + gained, min, max).toJSON()],
                };
            } else {
                if (streak === 0) await usersCollection.updateOne({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: -10 } });
                res.data = {
                    embeds: [new EmbedBuilder()
                        .setTitle('You Lost! 💀')
                        .setColor(0x870000)
                        .setDescription(`The number was **${secret}**.\n(Guess was ${choice} than ${start})\n\nYou lost a pot of **${pot}** coins. 💸`)
                        .toJSON()],
                    components: [],
                };
            }
        }
    }
    else if (custom_id.startsWith('highlow-')) {
        const [, choice, startNum, secretNum, streakNum, potNum, Prevmin, Prevmax] = custom_id.split('-');
        const start = parseInt(startNum!), secret = parseInt(secretNum!), streak = parseInt(streakNum!), pot = parseInt(potNum!);
        const won = (choice === 'higher' && secret > start) || (choice === 'lower' && secret < start);
        if (won) {
            const p = winProbability(choice, start, parseInt(Prevmin!), parseInt(Prevmax!));
            const gained = Math.round(8 / p);
            const { min, max } = rangeForStreak(streak + 1);
            const newStart = min + Math.ceil(Math.random() * (max - min));
            let newSecret = min + Math.ceil(Math.random() * (max - min));
            while (newSecret === newStart) newSecret = min + Math.ceil(Math.random() * (max - min));
            res.type = InteractionResponseType.UpdateMessage;
            res.data = {
                embeds: [{
                    title: `Correct! (Streak: ${streak + 1})`,
                    color: 0xc79c0f,
                    description: `\n\n📉 Range tightening — this round's number is between **${min}** and **${max}**.`,
                    fields: [{ name: 'Current Number:', value: `${newStart}` }]
                }],
                components: [{
                    type: 1, components: [
                        { type: 2, label: "Higher", style: 1, custom_id: `highlow-higher-${newStart}-${newSecret}-${streak + 1}-${pot + gained}-${min}-${max}` },
                        { type: 2, label: "Lower", style: 4, custom_id: `highlow-lower-${newStart}-${newSecret}-${streak + 1}-${pot + gained}-${min}-${max}` },
                        { type: 2, label: `Cash Out (${pot + gained})`, style: 3, custom_id: `highlow-cashout-${pot + gained}` }
                    ]
                }]
            };
        }
        else if (choice == 'cashout') {
            const pot = parseInt(startNum!);
            await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: pot } });
            res.type = InteractionResponseType.UpdateMessage;
            res.data = {
                embeds: [{ title: "Cashed Out 💰", color: 0x2ecc71, description: `You walked away with **${pot}** coins. Smart move — or was it?` }],
                components: []
            };
        }
        else {
            if (streak === 0)
                await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: -10 } });
            res.type = InteractionResponseType.UpdateMessage;
            res.data = {
                embeds: [{
                    title: "You Lost! 💀",
                    color: 0x870000,
                    description: `The number was **${secret}**.\n(Guess was ${choice} than ${start})\n\nYou lost a pot of **${pot}** coins. 💸`
                }],
                components: []
            };
        }
    }
    else if (custom_id.startsWith('verify')) {
        const joinedTime = await usersCollection.findOne({ guildId: guild_id, userId: member?.user.id }, { projection: { joinedTime: 1 } }) as Document
        if (Date.now() - joinedTime.joinedTime < ((Math.random() + 5) * 1000)) {
            const channel = await rest.post(Routes.userChannels(), { body: { recipient_id: member?.user.id } }) as APIDMChannel
            await rest.post(Routes.channelMessages(channel.id), {
                body: {
                    embeds: [{
                        author: { name: member?.user.username, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member!.user.avatar}.png` },
                        description: `Hi <@${member?.user.id}>, your interaction speed with the verification system was too fast for a typical human and was flagged for an auto kick.\n\nYou are free to rejoin the server through a new or public invite.`
                    }]
                }
            });
            await rest.delete(Routes.guildMember(guild_id!, member?.user.id));
            return;
        }
        const av = member?.user.avatar ? rest.cdn.avatar(member!.user.id, member.user.avatar) : rest.cdn.defaultAvatar(6);
        await rest.put(Routes.guildMemberRole(guild_id!, member!.user.id, '1463354464747524136'));
        await rest.post(Routes.channelMessages(generalchannels[0]), { body: { embeds: [{ description: `Everyone, Welcome <@${member?.user.id}> to the server !\n\n`, thumbnail: { url: av }, fields: [{ name: 'Discord Join Date:', value: `<t:${Number(((BigInt(member!.user.id) >> 22n) + 1420070400000n) / 1000n)}>`, inline: true }] }] } }) 
        await usersCollection.findOneAndUpdate({ userId: member?.user.id }, { $set: { verified: true } })
        res.type = InteractionResponseType.ChannelMessageWithSource
        res.data = { content: `Welcome to the cave <@${member?.user.id}>!!`, flags: 64 }
    }
    return Response.json(res)
}

const corsHeaders = {
    "Access-Control-Allow-Origin": Bun.env.CONFIGURATOR_ORIGIN!, "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Credentials": "true",
};
async function getSession(req: Bun.BunRequest) {
    const token = req.cookies.get('session')
    if (!token) return null
    try {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] },)
        return payload.sub ? { userId: payload.sub } : null;
    } catch { return null; }
}
async function roleFromStaffroles(userId: string, guildId: string, staffroles: string[], ownerId: string): Promise<"owner" | "admin" | "mod" | null> {
    if (ownerId && userId === ownerId) return "owner"; // guild owner always has admin access, even before staffroles are configured
    if (staffroles.length < 2) return null;
    const [adminRoleId, modRoleId] = staffroles;
    const member = await rest.get(Routes.guildMember(guildId, userId)) as APIGuildMember
    if (member.roles.includes(adminRoleId!)) return "admin";
    if (member.roles.includes(modRoleId!)) return "mod";
    return null;
}
Bun.serve({
    port: 3000,
    websocket: { open() { }, message() { }, close() { } },
    routes: {
        "/": () => new Response(Bun.file("./index.html")),
        "/controller.js": () => new Response(Bun.file("./dist/controller.js"), { headers: { "Content-Type": "application/javascript" } }),
        "/favicon.ico": () => new Response(null, { status: 204 }),
        "/output.css": () => new Response(Bun.file("./dist/output.css"), { headers: { "Content-Type": "text/css" } }),
        "/api/auth/discord/login": (req) => {
            const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
            req.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 300, });
            const params = new URLSearchParams({ client_id: Bun.env.CLIENT_ID!, redirect_uri: Bun.env.DISCORD_REDIRECT_URI!, response_type: "code", scope: "identify", state: state });
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: `${OAuth2Routes.authorizationURL}?${params}` } });
        },
        "/api/auth/discord/redirect": async (req) => {
            const url = new URL(req.url);
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state")
            const expected = req.cookies.get("oauth_state")
            if (!code || !state || !expected || state !== expected) return new Response("Invalid OAuth state", { status: StatusCodes.BAD_REQUEST })
            req.cookies.delete("oauth_state");
            const tokenRes = await rest.post(Routes.oauth2TokenExchange(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                passThroughBody: true,
                body: new URLSearchParams({
                    client_id: Bun.env.CLIENT_ID!,
                    client_secret: Bun.env.DISCORD_SECRET!,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: Bun.env.DISCORD_REDIRECT_URI!,
                })
            }) as RESTPostOAuth2AccessTokenResult;
            const discordUser = await rest.get(Routes.user(), { auth: false, headers: { Authorization: `Bearer ${tokenRes.access_token}` } }) as APIUser
            if (!discordUser) return new Response(null, { status: StatusCodes.GATEWAY_TIMEOUT })
            req.cookies.set("session", await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(discordUser.id).setIssuedAt().setExpirationTime("24H").sign(key), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86400, });
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: "/", } });
        },
        "/api/sendembed": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            POST: async (req) => {
                const { guildId, embedName, config } = await req.json();
                try {
                    const result = await syncEmbed(guildId, embedName, config);
                    return new Response(JSON.stringify(result), { headers: corsHeaders });
                } catch {
                    return new Response(JSON.stringify({ error: 'Failed to sync embed' }), { status: StatusCodes.INTERNAL_SERVER_ERROR, headers: corsHeaders });
                }
            }
        },
        "/api/deleteembed/:guildId/:key": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            DELETE: async (req) => {
                const { guildId, key } = req.params
                const doc = await guildconfigs.findOne({ guildId: guildId }, { projection: { [`messageConfigs.${key}`]: 1 } }) as any;
                const { channelid, messageId } = doc?.messageConfigs?.[key] || {};
                try { await rest.delete(Routes.channelMessage(channelid, messageId)); }
                catch (err) { throw err; }
                await guildconfigs.findOneAndUpdate({ guildId: guildId }, { $unset: { [`messageConfigs.${key}`]: '' } })
                return Response.json({ status: 200 })
            }
        },
        "/api/auth/me": {
            GET: async (req) => {
                const session = await getSession(req)
                const headers = { ...corsHeaders, "Cache-Control": "no-store" };
                if (!session) return Response.json({ loggedIn: false }, { headers });
                try {
                    const user = await rest.get(Routes.user(session.userId)) as APIUser;
                    return Response.json({ user: { ...user }, loggedIn: true }, { headers });
                } catch {
                    return Response.json({ error: "Could not resolve user" }, { status: StatusCodes.NOT_FOUND, headers });
                }
            }
        },
        "/api/auth/logout": {
            POST: (req) => {
                req.cookies.delete("session")
                return new Response(null, { status: StatusCodes.NO_CONTENT, headers: { ...corsHeaders, "Set-Cookie": "session=; Path=/; Max-Age=0" } });
            }
        },
        "/api/guilds": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            GET: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const docs = await guildconfigs.find({}, { projection: { guildId: 1, name: 1, staffroles: 1, _id: 0, ownerId: 1 } }).toArray();
                const results = await Promise.all(docs.map(async (doc) => {
                    const role = await roleFromStaffroles(session.userId, doc.guildId, doc.staffroles as string[], doc.ownerId as string)
                    return { guildId: doc.guildId as string, name: (doc.name as string) ?? null, role: role };
                }));
                const authorized = results.filter((r) => r!.role !== null)
                return Response.json(authorized, { headers: corsHeaders });
            }
        },
        "/api/guilds/:guildId": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            GET: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                const doc = await guildconfigs.findOne({ guildId: guildId });
                if (!doc) return Response.json({ error: "Not found" }, { status: StatusCodes.NOT_FOUND, headers: corsHeaders });
                const [guildRoles, guildChannels, rules] = await Promise.all([
                    rest.get(Routes.guildRoles(guildId)) as Promise<APIRole[]>,
                    rest.get(Routes.guildChannels(guildId)) as Promise<APIChannel[]>,
                    rest.get(Routes.guildAutoModerationRules(guildId)) as Promise<APIAutoModerationRule[]>,
                ]);
                const selectableChannels = guildChannels
                    .filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type))
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                return Response.json({
                    ...doc,
                    _viewerRole: await roleFromStaffroles(session.userId, guildId, doc.staffroles as string[], doc.ownerId as string),
                    guildRoles: guildRoles,
                    guildChannels: selectableChannels,
                    staffRoles: guildRoles.filter((role: APIRole) => (BigInt(role.permissions) & (PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.Administrator)) !== 0n && !role.managed),
                    rules: (rules.map(r => ({ id: r.id, name: r.name })))
                }, { headers: corsHeaders });
            },
            PUT: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                await guildconfigs.findOneAndUpdate({ guildId: guildId }, { $set: { ...await req.json() } }, { projection: { messageConfigs: 1 }, returnDocument: "after" }) as Document;
                return Response.json({ ok: true }, { headers: corsHeaders });
            },
            DELETE: async (req) => {
                const session = await getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                await rest.delete(Routes.guildMember(guildId, '1420927654701301951'))
                await guildconfigs.deleteOne({ guildId: guildId });
                await usersCollection.deleteMany({ guildId: guildId });
                return Response.json({ ok: true }, { headers: corsHeaders });
            }
        },
        "/interactions": async (req) => {
            const rawBody = await req.text();
            const data = new TextEncoder().encode(req.headers.get('X-Signature-Timestamp') + rawBody);
            const signature = new Uint8Array(Buffer.from(req.headers.get('x-signature-ed25519')!, 'hex'));
            const publickey = new Uint8Array(Buffer.from(`${Bun.env.DISCORD_PKEY}`, 'hex'));
            if (!ed25519.verify(signature, data, publickey)) return new Response('Unauthorized', { status: StatusCodes.UNAUTHORIZED });
            const body: APIInteraction = JSON.parse(rawBody);
            if (body.type == InteractionType.Ping) return Response.json({ type: InteractionResponseType.Pong });
            switch (body.type) {
                case InteractionType.ApplicationCommand: return await handleCommands(body as APIChatInputApplicationCommandGuildInteraction);
                case InteractionType.MessageComponent: return await handleComponents(body);
                case InteractionType.ModalSubmit: return await handleModals(body);
            }
        }
    }
})
