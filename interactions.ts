import { guildconfigs, usersCollection, logos } from "./Database";
import { response } from "./rest"
import { type Document, type WithId, ObjectId } from "mongodb";
import sharp from 'sharp'
import { ed25519 } from '@noble/curves/ed25519.js'
import { StatusCodes } from "http-status-codes";
import { appendFile } from "node:fs/promises";
import { type APIMessageComponentInteraction, InteractionType, ComponentType, type APIEmbed, type APIInteraction, type APIMessageComponent, type APIMessage, InteractionResponseType, MessageFlags, type APIGuild, type APIGuildMember, type APIModalSubmitInteraction, type APIUser, type APIActionRowComponent, type APIComponentInMessageActionRow, type APIButtonComponent, type APIChannel, ButtonStyle, type APIChatInputApplicationCommandGuildInteraction, ChannelType, type APIRole, type APIAutoModerationRule, type APIApplicationCommandSubcommandOption, type APIApplicationCommandBasicOption, DiscordAPIError, Collection, ApplicationCommandOptionType, type APIInteractionDataResolvedGuildMember } from "discord.js";
type CommandContext = {
    body: APIChatInputApplicationCommandGuildInteraction;
    res: { type: InteractionResponseType; data: any };
    guildConfig: () => Promise<Document>; // lazy — only fetched if a handler actually calls it
};
type CommandHandler = ((ctx: CommandContext) => Promise<Response | void>) & { cooldownMs?: number };
await Bun.write("./interpid.txt", String(process.pid))
const DEFAULT_COOLDOWN_MS = 3000;
const activeCooldowns = new Collection<string, number>(); // userId -> expiry timestamp
const commands = new Collection<string, CommandHandler>()
const corsHeaders = {
    "Access-Control-Allow-Origin": Bun.env.CONFIGURATOR_ORIGIN!, "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Credentials": "true",
};
const sessions = new Map<string, { userId: string; expires: number }>();
const oauthStates = new Map<string, number>();
const CONFIGURATOR_MANAGED_KEYS = ["modChannels", "publicChannels", "generalchannels", "reactions", "automodsettings", "responses", "staffroles", "Stages", "messageConfigs"] as const;
const statusMap: Record<string, { cmd: string, log: string, dm: string, color: number }> = {
    Ban: { cmd: 'was banned', log: 'banned a member', dm: `you were banned from`, color: 0xd10000 },
    Kick: { cmd: 'was kicked', log: 'kicked a member', dm: `you were kicked from`, color: 0x838383 },
    Mute: { cmd: 'was issued a mute', log: 'muted a member', dm: `you were given a`, color: 0xff4444 },
    Warn: { cmd: 'was issued a warning', log: 'warned a member', dm: `you were given a warning`, color: 0xffcc00 }
};
const unitMap: Record<string, number> = { min: 60000, hour: 3600000, day: 86400000 };
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
function getComparableEmbed(embedData: APIEmbed) {
    if (!embedData) return null; const normalizeText = (text: string | null) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    return JSON.stringify({
        title: embedData.title ? normalizeText(embedData.title) : null,
        description: embedData.description ? normalizeText(embedData.description) : null,
        url: embedData.url ? normalizeText(embedData.url) : null,
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    } as APIEmbed);
}
function shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function generateButtons(gameBoard: string[], player1: string, player2: string, currentplayer: string, disabled: boolean = false) {
    const rows: APIMessageComponent[] = [];
    for (let i = 0; i < 3; i++) {
        const row: APIActionRowComponent<APIComponentInMessageActionRow> = { type: ComponentType.ActionRow, components: [] as APIButtonComponent[] };
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            row.components.push({
                type: ComponentType.Button,
                custom_id: `tictactoe-${gameBoard.join(',')}-${player1}-${player2}-${currentplayer}-${index}`,
                label: gameBoard[index] === ' ' ? '\u200b' : gameBoard[index],
                style: gameBoard[index] === 'X' ? 1 : gameBoard[index] === 'O' ? 4 : 2,
                disabled: gameBoard[index] !== ' ' || disabled,
            })
        }
        rows.push(row);
    }
    return rows;
}
function randomToken() {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}
function parseCookies(req: Request): Record<string, string> {
    const header = req.headers.get("cookie") || "";
    const out: Record<string, string> = {};
    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
    return out;
}
function getSession(req: Request) {
    const sid = parseCookies(req)["session"];
    if (!sid) return null;
    const session = sessions.get(sid);
    if (!session || session.expires < Date.now()) { sessions.delete(sid); return null; }
    return session;
}
function roleFromStaffroles(userId: string, memberRoles: string[] | null, staffroles?: string[], ownerId?: string): "owner" | "admin" | "mod" | null {
    if (ownerId && userId === ownerId) return "owner"; // guild owner always has admin access, even before staffroles are configured
    if (!memberRoles || !staffroles || staffroles.length < 2) return null;
    const [adminRoleId, modRoleId] = staffroles;
    if (memberRoles.includes(adminRoleId!)) return "admin";
    if (memberRoles.includes(modRoleId!)) return "mod";
    return null;
}
async function buildLogEmbed(targetUser: APIUser, log: WithId<Document>, idx: number, totalLogs: number) {
    const LOG_COLORS: Record<string, number> = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
    const moderator = await response({ method: "GET", endpoint: `users/${log.moderatorId}` }) as APIUser;
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
    const mins = Math.round(log.duration / 60000);
    const hours = Math.floor(mins / 60);
    return {
        color: LOG_COLORS[log.type],
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.png` },
        fields: [
            { name: '**Member:**', value: `<@${log.userId}>`, inline: true },
            { name: '**type:**', value: `\`${log.type}\``, inline: true },
            { name: '**Active:**', value: `\`${log.active == 1 ? 'true' : 'false'}\``, inline: true },
            { name: '**Reason:**', value: `\`${log.reason}\`` },
            { name: `**Punishments:**`, value: `${log.type == 'Ban' ? `\`Ban\`` : `\`${log.weight} warn\``}${log.duration ? (hours > 0 ? `\`,${hours} hour Mute\`` : `,\`${mins} minute Mute\``) : ''}` },
            { name: '**Warns at Log Time:**', value: ` \`${log.warns}\`` },
            { name: '**Channel:**', value: `<#${log.channel}>\n\n [Event Link](${log.refrence})` }
        ],
        footer: { text: `Staff: ${moderator.username} | log ${idx + 1} of ${totalLogs} | ${formattedDate} `, icon_url: `https://cdn.discordapp.com/avatars/${log.moderatorId}/${moderator.avatar}.png` }
    } as APIEmbed
};
async function buildBlacklistEmbed(targetUser: any, guild_id: string): Promise<{ embed: APIEmbed; blacklist: string[] }> {
    const { blacklist } = await usersCollection.findOne({ userId: targetUser.id, guildId: guild_id }, { projection: { blacklist: 1 } }) as any;
    const embed: APIEmbed = { description: `<@${targetUser.id}>'s blacklist\n\nblacklist: ${blacklist?.length ? blacklist.map((r: string) => `<@&${r}>`).join(', ') : 'empty'}` };
    return { embed, blacklist };
}
async function memberGuards(ctx: CommandContext): Promise<boolean | null> {
    const { body, res, guildConfig } = ctx;
    const { member } = body;
    const subcommand = body.data.options![0] as APIApplicationCommandSubcommandOption;
    const target = subcommand.options![0]!.value as string;
    const targetmember: APIInteractionDataResolvedGuildMember | undefined = body.data.resolved!.members![target];
    const targetuser = body.data.resolved?.users![target];
    const { modChannels, staffroles } = await guildConfig();

    if (targetuser!.id === member?.user.id) {
        res.data = { embeds: [{ description: 'You cannot moderate yourself.' }], flags: MessageFlags.Ephemeral };
        return true;
    }
    if (member?.roles.includes(staffroles[2]) && ['ban', 'unwarn', 'unmute'].includes(subcommand.name)) {
        await response({ method: "POST", endpoint: `channels/${modChannels.adminChannel}/messages`, body: { embeds: [{ description: `Jr. mod ${member?.user} tried to use a mod only command.` }] } });
        res.data = { embeds: [{ description: 'Jr mods do not have access to this command.' }], flags: MessageFlags.Ephemeral };
        return true;
    }
    if (targetmember && targetmember.roles.some((r: string) => staffroles.includes(r))) {
        await response({ method: "POST", endpoint: `channels/${modChannels.adminChannel}/messages`, body: { embeds: [{ description: `<@${member?.user.id}> tried to moderate <@${target}>.` }] } });
        res.data = { embeds: [{ description: 'You cannot moderate other staff members.' }], flags: MessageFlags.Ephemeral };
        return true;
    }
    if (targetuser && targetuser.bot) {
        res.data = { embeds: [{ description: `You cannot moderate bots.` }], flags: 64 };
        return true;
    }
    if (targetmember && targetmember?.communication_disabled_until) {
        ctx.res.data = { embeds: [{ description: '⚠️ User is already muted.' }] };
        return true;
    }
    if (subcommand.name == 'mute' && subcommand.options![2]!.value <= 0) {
        ctx.res.data = { embeds: [{ description: '❌ Invalid duration' }] };
        return true;
    }
    return false;
}
async function runPunishment(ctx: CommandContext): Promise<Response> {
    const { body, res } = ctx;
    const { guild_id, channel, member, data: { resolved, options } } = body;
    const subcommand = options![0] as APIApplicationCommandSubcommandOption;
    const target = resolved?.users![0]
    const reason = String(subcommand.options![1]!.value)
    res.type = InteractionResponseType.DeferredChannelMessageWithSource;
    const { Stages, guildname, icon, modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Stages: 1, guildname: 1, icon: 1, modChannels: 1 } }) as Document
    const { punishments } = await usersCollection.findOne({ userId: target!.id, guildId: guild_id }, { projection: { punishments: 1 } }) as any;
    const activeWarns = punishments.length > 0 ? punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0) : 0;
    const totalWarns = activeWarns + 1;
    const warnType = subcommand.name === 'ban' ? 'Ban' : subcommand.name === 'kick' ? 'Kick' : subcommand.name === 'mute' ? 'Mute' : 'Warn';
    let durationMs: number = 0, durationStr: string | null = null
    if (warnType === 'Mute') {
        durationMs = subcommand!.options![2]!.value * unitMap[subcommand!.options![3]!.value]!
        durationStr = `${subcommand!.options![2]!.value} ${subcommand!.options![3]!.value}`;
    }
    const finalMessage: any = await response({
        method: "POST", endpoint: `/webhooks/${body?.application_id}/${body?.token}`, body: {
            embeds: [{
                color: statusMap[warnType]!.color,
                author: { name: `${target!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : statusMap[warnType]!.cmd}`, icon_url: `https://cdn.discordapp.com/avatars/${target!.id}/${target!.avatar}.webp` }
            }]
        }
    })
    const object = new ObjectId();
    const newPunishment = { _id: object, userId: target, moderatorId: member.user.id, reason: reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: 1, type: warnType, guildId: guild_id, channel: channel.id, refrence: `https://discord.com/channels/${guild_id}/${channel.id}/${finalMessage.id}`, warns: totalWarns - 1 };
    await usersCollection.updateOne({ userId: target, guildId: guild_id }, { $push: { punishments: newPunishment as any } });
    const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
    const logEmbed: APIEmbed = {
        color: statusMap[warnType]!.color,
        author: { name: `${member.user.username} ${statusMap[warnType]!.log}`, icon_url: `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}` },
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${target!.id}/${target!.avatar}.webp` },
        fields: [
            { name: 'user.id:', value: `<@${target!.id}>`, inline: true },
            { name: 'Channel:', value: `<#${channel.id}>`, inline: true },
            { name: 'History:', value: caseHistory.join(' | ') || "none", inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
            ...(['Ban', 'Kick'].includes(warnType) ? [] : [
                { name: 'Punishment:', value: durationStr && body ? `\`${durationStr}\`` : `\`1 warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
                { name: 'Warns at log time:', value: `\`${activeWarns}\``, inline: false },
                { name: 'Next Punishment:', value: `\`${Stages[Math.min(totalWarns - 1, Stages.length - 1)].label}\``, inline: false }
            ])
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'User DMed ✅' }
    };
    const dmchannel = await response({ method: 'POST', endpoint: `/users/@me/channels`, body: { recipient_id: target!.id } })
    const dmResult = await response({
        method: 'POST', endpoint: `/channels/${dmchannel.id}/messages`, body: {
            embeds: [{
                color: statusMap[warnType]!.color, author: { name: target!.username, icon_url: `https://cdn.discordapp.com/avatars/${target!.id}/${target!.avatar}.webp` },
                thumbnail: { url: `${icon}` },
                description: `<@${target!.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${guildname}](https://discord.com/channels/${guild_id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${guildname}` : `in ${guildname}`}`,
                fields: [
                    { name: 'Reason:', value: `\`${reason}\``, inline: false },
                    ...(['Ban', 'Kick'].includes(warnType) ? [] : [
                        { name: 'Punishment:', value: durationStr && body ? `\`${durationStr}\`` : `\`1 warn\`${durationStr ? `, \`${durationStr}\`` : ''}`, inline: false },
                        { name: 'Active Warnings:', value: `\`${totalWarns}\``, inline: false },
                        { name: 'Warn expires:', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:F>` }
                    ])
                ],
                timestamp: new Date().toISOString()
            }],
            components: warnType === 'Ban' ? [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }] : undefined
        }
    })
    if (!dmResult) logEmbed.footer!.text === 'User DMed 🚫';
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId: guild_id }, { $set: { ban: target!.id } });
            await response({ method: "PUT", endpoint: `/guilds/${guild_id}/bans/${target!.id}`, body: { delete_message_seconds: 604800 }, reason: `Ban Command: ${reason}` })
            break;
        case 'Mute':
            await response({ method: "PATCH", endpoint: `/guilds/${guild_id}/members/${target!.id}`, body: { communication_disabled_until: new Date(Date.now() + Math.min(durationMs, 2419200000)).toISOString() }, reason: reason })
            break;
        case 'Kick':
            await response({ method: "DELETE", endpoint: `/guilds/${guild_id}/members/${target!.id}` })
            break;
    }
    await response({
        method: "POST", endpoint: `/channels/${warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel}/messages`, body: {
            embeds: [logEmbed]
        }
    }
    )
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne({ userId: target!.id, guildId: guild_id }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
        }, 86400000);
    }
    return Response.json(res);
}
async function handleCommands(body: APIChatInputApplicationCommandGuildInteraction) {
    const { guild_id, member, data: { name, options } } = body;
    let cached: Document | null = null;
    const guildConfig = async () => {
        if (!cached) {
            cached = await guildconfigs.findOne(
                { guildId: guild_id },
                { projection: { modChannels: 1, publicChannel: 1, staffroles: 1, guildname: 1 } }
            ) as Document;
        }
        return cached;
    };
    const key = options?.[0] && options?.[0].type == ApplicationCommandOptionType.Subcommand && name !== 'member' ? `${name}.${options?.[0].name}` : name;
    const handler = commands.get(key);
    if (!handler) return Response.json({ type: 4, data: { content: `Unhandled command: ${key}`, flags: 64 } });
    if (member?.user.id) {
        const { staffroles } = await guildConfig();
        const isStaff = member.roles.some((r: string) => staffroles.includes(r));
        const blocked = checkCooldown(member.user.id, isStaff, handler.cooldownMs ?? DEFAULT_COOLDOWN_MS);
        if (blocked) return blocked;
    }
    const res: { type: InteractionResponseType; data: any } = { type: InteractionResponseType.ChannelMessageWithSource, data: {} };
    return await handler({ body, res, guildConfig }) ?? Response.json(res);
}
async function handleModals(body: APIModalSubmitInteraction) {
    const { guild_id, member, data: { custom_id, components, resolved } } = body;
    const { modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1 } }) as Document
    const updates: Record<string, any> = {};
    const res: { type: InteractionResponseType.ChannelMessageWithSource, data: any } = { type: InteractionResponseType.ChannelMessageWithSource, data: {} }
    if (custom_id.startsWith('appeal')) {
        const [gId, reason, justification, extra, img] = components as any;
        const targetGuild = gId.component.values[0];
        const gConf = await guildconfigs.findOne({ guildId: targetGuild }, { projection: { staffroles: 1, modChannels: 1 } }) as any;
        const attachments = resolved?.attachments || {};
        const attId = img.component.values[0];
        const mainembed = {
            author: { name: `${member?.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` },
            color: 0x13cbd8, title: "Ban Appeal",
            fields: [{ name: 'Why did you get banned?', value: reason.component.value }, { name: 'Why should we accept your appeal?', value: justification.component.value }, { name: 'Extra info', value: extra.component.value || "None" }],
            footer: { text: `User ID: ${member?.user.id}` }, timestamp: new Date().toISOString(),
            image: attachments[attId] ? { url: attachments[attId].url } : {}
        };
        const appealMsg = await response({
            method: "POST",
            endpoint: `channels/${gConf.modChannels.appealChannel}/messages`,
            body: {
                content: `<@&${gConf.staffroles[0]}> <@&${gConf.staffroles[1]}>`,
                embeds: [mainembed],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            { type: ComponentType.Button, custom_id: `unban_approve_${member?.user.id}`, label: 'Approve', style: ButtonStyle.Success },
                            { type: ComponentType.Button, custom_id: `unban_reject_${member?.user.id}`, label: 'Reject', style: ButtonStyle.Danger }]
                    }]
            }
        }) as any;
        const extraImgs = Object.values(attachments).map((i: any) => ({ url: `https://discord.com/channels/${gConf.modChannels.appealChannel}/messages/${appealMsg.id}`, image: { url: i.url } }));
        await response({
            method: "PATCH",
            endpoint: `channels/${gConf.modChannels.appealChannel}/messages/${appealMsg.id}`,
            body: {
                embeds: [mainembed, ...extraImgs],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            { type: ComponentType.Button, custom_id: `unban_approve_${member?.user.id}`, label: 'Approve', style: ButtonStyle.Success },
                            { type: ComponentType.Button, custom_id: `unban_reject_${member?.user.id}`, label: 'Reject', style: ButtonStyle.Danger }]
                    }]
            }
        });
        await response({ method: "POST", endpoint: `channels/${gConf.modChannels.appealChannel}/messages/${appealMsg.id}/threads`, body: { type: 11, name: `${member?.user.username}` } });
        await usersCollection.updateOne({ userId: member?.user.id, guildId: targetGuild }, { $set: { appeals: { _id: new ObjectId(), reason: reason.component.value, justification: justification.component.value, extra: extra.component.value } } });
        res.data = { content: 'Your appeal has been submitted!', flags: 64 }
    }
    else if (custom_id.startsWith('situations')) {
        const [dm, arg, amb, staff, ill] = components as any;
        const { application } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }) as any;
        await response({
            method: "POST",
            endpoint: `channels/${modChannels.applicationChannel}/messages`, body: {
                embeds: [{
                    author: { name: `@${member?.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` },
                    color: 0x13b6df, title: `Mod Application`,
                    fields: [
                        { name: 'Age Range:', value: `${application.Agerange}` }, { name: 'Prior Experience:', value: `${application.Experience}` }, { name: 'History:', value: `${application.History}` }, { name: 'Timezone:', value: `${application.Timezone}` }, { name: `Server Activity:`, value: `${application.Activity}` }, { name: 'Why mod?:', value: `${application.why}` }, { name: 'Troll definition:', value: `${application.Trolldef}` }, { name: 'Raid definition:', value: `${application.Raiddef}` }, { name: 'Staff issues action:', value: `${application.Staffissues}` }, { name: 'Member report action:', value: `${application.Memberreport}` },
                        { name: 'Harassment via DM response:', value: dm.component.value }, { name: 'General chat argument step:', value: arg.component.value }, { name: 'Rulebreaking DM response:', value: amb.component.value }, { name: 'Mod breaking rules step:', value: staff.component.value }, { name: 'Illegal content step:', value: ill.component.value }
                    ]
                }], timestamp: new Date().toISOString()
            }
        });
        await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $set: { application: {} } });
        res.data = { content: 'your application was successfuly submitted!!' }
    }
    else if (custom_id.startsWith('Defs, reasons')) {
        components.forEach((row: any) => {
            const { component } = row
            if (!row.component) return; // Guard clause safety check
            switch (component.custom_id) {
                case 'why':
                    updates['application.why'] = component.value;
                    break;
                case 'trolldef':
                    updates['application.Trolldef'] = component.value;
                    break;
                case 'raiddef':
                    updates['application.Raiddef'] = component.value;
                    break;
                case 'staffissues':
                    updates['application.Staffissues'] = component.value;
                    break;
                case 'memberreport':
                    updates['application.Memberreport'] = component.value;
                    break;
            }
        })

        await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $set: updates });
        res.data = { content: 'Part 2 saved!', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'Next Section', style: 1 }] }], flags: 64 }
    }
    else if (custom_id.startsWith('server')) {
        components.forEach((row: any) => {
            const { component } = row
            if (!row.component) return; // Guard clause safety check
            if (component.type == ComponentType.StringSelect)
                updates['application.Agerange'] = component.values?.[0];
            if (component.type == ComponentType.TextInput)
                switch (component.custom_id) {
                    case 'experience':
                        updates['application.Experience'] = row.component.value;
                        break;
                    case 'punishments':
                        updates['application.History'] = row.component.value;
                        break;
                    case 'timezone':
                        updates['application.Timezone'] = row.component.value;
                        break;
                    case 'activity':
                        updates['application.Activity'] = row.component.value;
                        break;
                }
        })
        await usersCollection.updateOne({ userId: member?.user.id, guildId: guild_id }, { $set: updates });
        res.data = { content: 'Part 1 saved!', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'Next Section', style: 1 }] }], flags: 64 }
    }
    return Response.json(res)
}
async function handleComponents(body: APIMessageComponentInteraction) {
    const res: { type: InteractionResponseType, data: any } = { type: InteractionResponseType.Pong, data: {} }
    const { token, guild_id, member, data: { custom_id }, channel, application_id, message } = body
    const { modChannels, appealInvite, staffroles, generalchannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { modChannels: 1, staffroles: 1, appealInvite: 1, generalchannels: 1 } }) as Document
    const isAdmin = (BigInt(member!.permissions || 0n) & 8n) !== 0n;
    if (custom_id.startsWith('ban_')) {
        const [, targetId, inviteCode] = custom_id.split('_');
        if (member?.roles.includes(staffroles[2])) return Response.json({ type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'jrs cannot use this button.', flags: MessageFlags.Ephemeral } });
        const targetUser = await response({ method: "GET", endpoint: `users/${targetId}` }) as APIUser
        res.type = InteractionResponseType.DeferredChannelMessageWithSource;
        const { guildname, icon, modChannels } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { Stages: 1, guildname: 1, icon: 1, modChannels: 1 } }) as Document
        const { punishments } = await usersCollection.findOne({ userId: targetUser!.id, guildId: guild_id }, { projection: { punishments: 1 } }) as any;
        const finalMessage: any = await response({
            method: "POST", endpoint: `/webhooks/${body?.application_id}/${body?.token}`, body: {
                embeds: [{
                    color: 0xd10000,
                    author: { name: `${targetUser!.id} was banned`, icon_url: `https://cdn.discordapp.com/avatars/${targetUser!.id}/${targetUser!.avatar}.webp` }
                }]
            }
        })
        const object = new ObjectId();
        const newPunishment = { _id: object, userId: targetUser.id, moderatorId: member!.user.id, reason: 'troll', duration: 0, timestamp: Date.now(), active: 1, weight: 1, type: 'Ban', guildId: guild_id, channel: channel.id, refrence: `https://discord.com/channels/${guild_id}/${channel.id}/${finalMessage.id}`, warns: 1 };
        await usersCollection.updateOne({ userId: targetUser!.id, guildId: guild_id }, { $push: { punishments: newPunishment as any } });
        const caseHistory = [...punishments, newPunishment].filter((r: any) => r.type === "Ban").slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
        const logEmbed: APIEmbed = {
            color: 0xd10000,
            author: { name: `${member!.user.username} banned a member`, icon_url: `https://cdn.discordapp.com/avatars/${member!.user.id}/${member!.user.avatar}` },
            thumbnail: { url: `https://cdn.discordapp.com/avatars/${targetUser!.id}/${targetUser!.avatar}.webp` },
            fields: [
                { name: 'user.id:', value: `<@${targetUser!.id}>`, inline: true },
                { name: 'Channel:', value: `<#${channel.id}>`, inline: true },
                { name: 'History:', value: caseHistory.join(' | ') || "none", inline: true },
                { name: 'Reason:', value: `\`troll\``, inline: false },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'User DMed ✅' }
        };
        const dmchannel = await response({ method: 'POST', endpoint: `/users/@me/channels`, body: { recipient_id: targetUser!.id } })
        const dmResult = await response({
            method: 'POST', endpoint: `/channels/${dmchannel.id}/messages`, body: {
                embeds: [{
                    color: 0xd10000, author: { name: targetUser!.username, icon_url: `https://cdn.discordapp.com/avatars/${targetUser!.id}/${targetUser!.avatar}.webp` },
                    thumbnail: { url: `${icon}` },
                    description: `<@${targetUser!.id}>, you were banned from [${guildname}](https://discord.com/channels/${guild_id}). To appeal this decision, please join our dedicated appeal server using the button below.`,
                    fields: [
                        { name: 'Reason:', value: `\`troll\``, inline: false },
                    ],
                    timestamp: new Date().toISOString()
                }],
                components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }] }]
            }
        })
        if (!dmResult) logEmbed.footer!.text = 'User DMed 🚫';
        await guildconfigs.updateOne({ guildId: guild_id }, { $set: { Ban: targetUser!.id } });
        await response({ method: "PUT", endpoint: `/guilds/${guild_id}/bans/${targetUser!.id}`, body: { delete_message_seconds: 604800 }, reason: `Ban Command: troll` })
        await response({ method: "POST", endpoint: `/channels/${modChannels.banlogChannel}/messages`, body: { embeds: [logEmbed] } })
        if (inviteCode !== 'none') await response({ method: "DELETE", endpoint: `/invites/${inviteCode}` });
        await response({ method: "PATCH", endpoint: `/channels/${channel.id}/messages/${message.id}`, body: { components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, custom_id: 'expired', label: inviteCode !== 'none' ? '🔨 Banned & Invite Deleted!' : '🔨 Banned!', style: ButtonStyle.Danger, disabled: true }] }] } as APIMessage });
        res.data = { embeds: [{ description: `Banned <@${targetId}>${inviteCode !== 'none' ? ' Invite was deleted' : ''}` }], message_reference: { message_id: message.id } }
    }
    else if (custom_id.startsWith('unban_')) {
        const [, action, userId] = custom_id.split('_');
        const targetUser = await response({ method: "GET", endpoint: `users/${userId}` }) as APIUser
        const { appeals } = await usersCollection.findOne({ userId: userId, guildId: guild_id }, { projection: { appeals: 1 } }) as any;
        if (!appeals) return Response.json({ content: `I could not find any appeal entries`, flags: 64 });
        if (!member?.roles.includes(staffroles[0])) {
            await response({ method: "POST", endpoint: `channels/${modChannels.adminChannel}/messages`, body: { content: `Letting you know <@${member?.user.id}> tried to jump the gun on an appeal.` } });
            res.data = { content: `Please wait for an admin to make a decision. `, flags: 64 }
            return Response.json(res)
        }
        if (action === 'reject') await usersCollection.deleteOne({ userId: userId, guildId: guild_id });
        else { await response({ method: "DELETE", endpoint: `guilds/${guild_id}/bans/${userId}` }); await usersCollection.updateOne({ userId: userId, guildId: guild_id }, { $set: { appeals: {} } }); }
        const dm = await response({ method: "POST", endpoint: `users/@me/channels`, body: { recipient_id: userId } }) as any;
        await response({ method: "POST", endpoint: `channels/${dm.id}/messages`, body: { embeds: [{ color: action == 'reject' ? 0x890000 : 0x008900, description: action == 'reject' ? `<@${userId}> your ban appeal has been denied.` : `<@${userId}> your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealInvite}` }] } });
        res.type = InteractionResponseType.UpdateMessage
        res.data = {
            embeds: [{
                color: action === 'reject' ? 0x890000 : 0x008900, title: `Ban appeal`,
                author: { name: ((await response({ method: "GET", endpoint: `users/${userId}` })) as any).username, iconURL: `https://cdn.discordapp.com/avatars/${userId}/${targetUser.avatar}.${targetUser.avatar?.startsWith('a_') ? 'gif' : 'png'}` },
                fields: [{ name: 'Why did you get banned?', value: appeals.reason }, { name: 'Why accept appeal?', value: appeals.justification }, { name: 'Extra info', value: appeals.extra }, { name: action === 'reject' ? 'Denied by:' : 'Approved by:', value: `<@${member.user.id}> `, inline: true }],
                image: { url: message.attachments[0]?.proxy_url }, footer: { text: `User ID: ${userId}` }, timestamp: new Date().toISOString()
            }],
            components: [{ type: 1, components: [{ type: 2, custom_id: `unban_approve_${userId}_${guild_id}`, label: 'Approve', style: 3, disabled: true }, { type: 2, custom_id: `unban_reject_${userId}_${guild_id}`, label: 'Reject', style: 4, disabled: true }] }]
        }
    }
    else if (custom_id.startsWith('next_modal_three')) {
        res.type = InteractionResponseType.Modal,
            res.data = {
                custom_id: 'situations', title: 'Situations (3/3)',
                components: [
                    { type: ComponentType.Label, label: 'A member messages you about being harrassed', component: { type: 4, custom_id: 'dmmember', required: true, style: 2, max_length: 350 } },
                    { type: ComponentType.Label, label: 'Users are arguing in general chat', component: { type: 4, custom_id: 'arguments', style: 2, required: true, max_length: 350 } },
                    { type: ComponentType.Label, label: 'A member DMs you about a rule-breaking DM', component: { type: 4, custom_id: 'rulebreakdm', required: true, style: 2, max_length: 350 } },
                    { type: ComponentType.Label, label: 'Staff is failing to follow the rules', component: { type: 4, custom_id: 'staffrulebreak', required: true, style: 2, max_length: 350 } },
                    { type: ComponentType.Label, label: 'A user shares illegal content', component: { type: 4, custom_id: 'illegal', required: true, style: 2, max_length: 350 } }
                ]
            }
    }
    else if (custom_id.startsWith('next_modal_two')) {
        const { application } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { application: 1 } }) as any;
        if (application?.Memberreport) {
            res.type = InteractionResponseType.ChannelMessageWithSource
            res.data = { content: 'Already filled out.', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_three', label: 'skip Section', style: 1 }] }], flags: 64 }
            return Response.json(res)
        } else {
            res.type = InteractionResponseType.Modal
            res.data = {
                custom_id: 'Defs, reasons, and issues', title: 'Definitions, Why mod, and Staff issues (2/3)',
                components: [
                    { type: ComponentType.Label, label: 'Why should you be on the team?', component: { type: 4, custom_id: 'why', required: true, style: 2, max_length: 500 } },
                    { type: ComponentType.Label, label: 'What is your definition of a troll?', component: { type: 4, custom_id: 'trolldef', required: true, style: 1, max_length: 65 } },
                    { type: ComponentType.Label, label: 'What is your definition of a raid?', component: { type: 4, custom_id: 'raiddef', required: true, style: 1, max_length: 65 } },
                    { type: ComponentType.Label, label: 'You disagree with an action from staff', component: { type: 4, custom_id: 'staffissues', required: true, style: 2, max_length: 300 } },
                    { type: ComponentType.Label, label: 'How would you handle a member report?', component: { type: 4, custom_id: 'memberreport', required: true, style: 2, max_length: 300 } }
                ]
            }
        }
    }
    else if (custom_id.startsWith('note-') || custom_id.startsWith('modlog-')) {
        const isNote = custom_id.startsWith('note-');
        const [, action, target, index, opener, noteOrLogId] = custom_id.split('-');
        const targetUser = await response({ method: "GET", endpoint: `users/${target}` }) as APIUser
        if (member!.user.id !== opener) return Response.json({ type: 4, data: { content: 'You did not initiate this command', flags: 64 } });
        let idx = parseInt(index!);
        if (action === 'del') {
            const targetId = ObjectId.createFromHexString(noteOrLogId!);
            if (isNote) {
                const doc = await usersCollection.findOne({ userId: targetUser.id, guildId: guild_id, "notes._id": targetId }, { projection: { "notes.$": 1 } }) as any;
                if (doc?.notes?.[0] && (Date.now() - doc.notes[0].timestamp < 172800000 || isAdmin)) {
                    await usersCollection.updateOne({ userId: targetUser.id, guildId: guild_id }, { $pull: { notes: { _id: targetId } } as any });
                    idx = Math.max(0, idx - 1);
                } else {
                    res.type = InteractionResponseType.UpdateMessage
                    res.data = { content: `Contact an admin, deletion time expired.`, flags: 64 }
                    return Response.json(res)
                }
            } else {
                await usersCollection.updateOne({ userId: target, guildId: guild_id }, { $pull: { punishments: { _id: targetId } as any } });
                idx = Math.max(0, idx - 1);
            }
        } else
            idx = Math.max(0, action === 'next' ? idx + 1 : idx - 1);
        if (isNote) {
            // Uniformly matching Newest First sort order matching initial command rendering
            const [newData] = await usersCollection.aggregate([{ $match: { userId: targetUser.id, guildId: guild_id } }, { $unwind: "$notes" }, { $sort: { "notes.timestamp": -1 } }, { $facet: { "notes": [{ $skip: idx }, { $limit: 1 }], "total": [{ $count: "count" }] } }]).toArray();
            if (!newData?.total?.length) {
                res.type = InteractionResponseType.UpdateMessage
                res.data = { embeds: [{ description: "All notes deleted.", color: 0xdddddd }] }
                return Response.json(res);
            }

            const count = newData.total[0].count;
            const activeNote = newData.notes[0].notes;
            const m = await response({ method: "GET", endpoint: `users/${activeNote.moderatorId}` });
            res.type = InteractionResponseType.UpdateMessage
            res.data = {
                embeds: [{ color: 0xdddddd, thumbnail: { url: `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.png` }, description: `<@${targetUser.id}> notes | \`${idx + 1} of ${count}\`\n> ${activeNote.note}`, footer: { text: `${m.username} | ${new Date(activeNote.timestamp).toLocaleString('en-US')}`, icon_url: `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png` } }],
                components: [{
                    type: ComponentType.ActionRow, components: [
                        { type: ComponentType.Button, custom_id: `note-prev-${target}-${idx}-${opener}`, label: '⬅️ Back', style: 2, disabled: idx === 0 },
                        { type: ComponentType.Button, custom_id: `note-next-${target}-${idx}-${opener}`, label: 'Next ➡️', style: 2, disabled: idx >= count - 1 },
                        { type: ComponentType.Button, custom_id: `note-del-${target}-${idx}-${opener}-${activeNote._id}`, label: 'Delete', style: 4 }
                    ]
                }]
            }
        } else {
            const { punishments } = await usersCollection.findOne({ userId: target, guildId: guild_id }, { projection: { punishments: 1, avatar: 1 } }) as any;
            if (!punishments?.length) {
                res.type = InteractionResponseType.UpdateMessage
                res.data = { embeds: [{ description: `All logs deleted.` }], components: [] }
                return Response.json(res)
            }
            const activeLog = punishments[Math.min(idx, punishments.length - 1)];
            res.type = InteractionResponseType.UpdateMessage
            res.data = {
                embeds: [await buildLogEmbed(targetUser!, activeLog, idx, punishments.length)],
                components: [{
                    type: 1, components: [
                        { type: 2, custom_id: `modlog-prev-${target}-${idx}-${opener}`, label: '⬅️ Back', style: 2, disabled: idx === 0 },
                        { type: 2, custom_id: `modlog-next-${target}-${idx}-${opener}`, label: 'Next ➡️', style: 2, disabled: idx >= punishments.length - 1 },
                        ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${target}-${idx}-${opener}-${activeLog._id}`, label: 'Delete', style: 4 }] : [])
                    ]
                }]
            }
        }
    }
    else if (custom_id.startsWith('logos')) {
        const [, guess, logo] = custom_id.split('-');
        const updated = message.components![0]?.components.map((b: any) => {
            const brand = b.custom_id?.split('-')[1];
            return { type: ComponentType.Button, label: b.label, custom_id: b.custom_id, style: brand === logo ? 3 : brand === guess ? 4 : 2, disabled: true };
        });
        if (guess === logo) await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: 20 } });
        res.type = InteractionResponseType.UpdateMessage
        res.data = { components: [{ type: ComponentType.ActionRow, components: updated }] }
    }
    else if (custom_id.startsWith('tictactoe')) {
        const [, boardStr, player1, player2, currentplayer, index] = custom_id.split('-');
        if (member?.user.id !== currentplayer) return Response.json({ type: 4, data: { content: "It's not your turn.", flags: 64 } });
        const board = boardStr!.split(',');
        const marker = currentplayer === player1 ? 'X' : 'O';
        board[parseInt(index!)] = marker;
        const win = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].some((c: any) => c.every((i: number) => board[i] === marker));
        const tie = !win && board.every((c: string) => c !== ' ');
        if (win || tie) {
            if (win) await usersCollection.findOneAndUpdate({ userId: currentplayer, guildId: guild_id }, { $inc: { coins: 100 } });
            setTimeout(() => { response({ method: "DELETE", endpoint: `webhooks/${application_id}/${token}/messages/@original` }).catch(() => null); }, 10000);
            res.type = InteractionResponseType.UpdateMessage
            res.data = { embeds: [{ color: win ? 0xceab10 : 0x555555, title: 'TicTacToe', description: win ? `<@${currentplayer}> wins!!` : `It's a draw!` }], components: generateButtons(board, player1!, player2!, currentplayer!, true) }
            return Response.json(res);
        }
        const nextPl = currentplayer === player1 ? player2 : player1;
        res.type = InteractionResponseType.UpdateMessage
        res.data = { embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: `It's <@${nextPl}> turn!` }], components: generateButtons(board, player1!, player2!, nextPl!) }
    }
    else if (custom_id.startsWith('highlow')) {
        const [, choice, startNum, secretNum] = custom_id.split('-');
        const start = parseInt(startNum!), secret = parseInt(secretNum!);
        const won = (choice === 'higher' && secret > start) || (choice === 'lower' && secret < start);
        await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: won ? 10 : -10 } });
        res.type = InteractionResponseType.UpdateMessage
        res.data = { embeds: [{ title: won ? "You Won! 🎉" : "You Lost! 💀", color: won ? 0xc79c0f : 0x870000, description: `The number was **${secret}**.\n(Guess was ${choice} than ${start})` }], components: [] }
    }
    else if (custom_id.startsWith('verify')) {
        const joinedTime = await usersCollection.findOne({ guildId: guild_id, userId: member?.user.id }, { projection: { joinedTime: 1 } }) as Document
        if (Date.now() - joinedTime.joinedTime < ((Math.random() + 5) * 1000)) {
            const channel = await response({ method: "POST", endpoint: `users/@me/channels`, body: { recipient_id: member?.user.id } })
            await response({
                method: "POST",
                endpoint: `channels/${channel.id}`, body: {
                    embeds: [{
                        author: { name: member?.user.username, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member!.user.avatar}.png` },
                        description: `Hi <@${member?.user.id}>, your interaction speed with the verification system was too fast for a typical human and was flagged for an auto kick.\n\nYou are free to rejoin the server through a new or public invite.`
                    }]
                } as APIMessage
            })
            await response({ method: "DELETE", endpoint: `guilds/${guild_id}/members/${member?.user.id}` })
            return;
        }
        const av = member?.user.avatar ? `https://cdn.discordapp.com/avatars/${member!.user.id}/${member!.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(BigInt(member!.user.id) >> 22n) % 6n}.png`;
        await response({ method: "PUT", endpoint: `guilds/${guild_id}/members/${member!.user.id}/roles/1463354464747524136` });
        await response({ method: "POST", endpoint: `channels/${generalchannels[0]}/messages`, body: { embeds: [{ description: `Everyone, Welcome <@${member?.user.id}> to the server !\n\n`, thumbnail: { url: av }, fields: [{ name: 'Discord Join Date:', value: `<t:${Number(((BigInt(member!.user.id) >> 22n) + 1420070400000n) / 1000n)}>`, inline: true }] }] } as APIMessage });
        res.type = InteractionResponseType.ChannelMessageWithSource
        res.data = { content: `Welcome to the cave <@${member?.user.id}>!!`, flags: 64 }
    }
    return Response.json(res)
}
async function fetchMemberRoles(userId: string, guildId: string): Promise<string[] | null> {
    try {
        const member = await response({ method: "GET", endpoint: `guilds/${guildId}/members/${userId}` }) as APIGuildMember;
        return member.roles;
    } catch {
        return null; // not a member of that guild (or guild/user not found)
    }
}
commands.set('dnd', async ({ body, res }) => {
    const sides = parseInt(body.data.options![0]!.name.slice(1));
    const rolled = Math.floor(Math.random() * sides) + 1;
    res.data = { content: `you rolled a ${rolled}` };
})
commands.set('games.rps', async ({ body, res }) => {
    const { member, guild_id } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const move: string = subcommandoptions[0]!.value;
    const oppChoices = ['rock', 'paper', 'scissors'];
    const opp = oppChoices[Math.floor(Math.random() * 3)]!;
    const beats: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const result = opp === move.toLowerCase() ? "It's a tie!" : beats[opp] === move.toLowerCase() ? 'you win!!!' : 'Febot Wins!!!';
    if (result === 'you win!!!') await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: 20 } });
    res.data = { embeds: [{ title: result, description: `You chose **${move}**.\nOpponent chose **${opp}**.`, color: 0xffa500 }] };
})
commands.set('games.logos', async ({ body }) => {
    const { member } = body;
    const { logolist } = await logos.findOne({}) as any;
    const logo = logolist[Math.floor(Math.random() * logolist.length)];
    const distractors = shuffle(logolist.filter((l: any) => l.brand !== logo.brand)).slice(0, 3).map((l: any) => l.brand);
    const comps = shuffle([logo.brand, ...distractors]).map((opt: string) => ({ type: 2, custom_id: `logos-${opt}-${logo.brand}`, label: opt, style: 1 }));
    const form = new FormData();
    form.append('files[0]', new Blob([await Bun.file(logo.image).arrayBuffer()]), 'logo.png');
    form.append('payload_json', JSON.stringify({
        type: 4,
        data: {
            embeds: [{ author: { name: `Guess this logo ${member?.user.username}`, icon_url: `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` }, color: Math.floor(Math.random() * 16777215), image: { url: `attachment://logo.png` } }],
            components: [{ type: 1, components: comps }]
        }
    }));
    return new Response(form); // early return — dispatcher skips Response.json(res)
})
commands.set('games.bet', async ({ body, res }) => {
    const { member, guild_id } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const coincount: number = subcommandoptions[0]!.value;
    const { coins } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { coins: 1 } }) as any;
    if (coincount > coins) return Response.json({ type: 4, data: { content: `You cannot bet more than you have!`, flags: 64 } });
    const win = Math.random() >= 0.5;
    await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guild_id }, { $inc: { coins: win ? Math.ceil(coincount * 1.5) : -coincount } });
    res.data = {
        embeds: [{
            color: win ? 0x007a00 : 0x7a0000,
            author: { name: `${member?.user.username} you bet ${coincount} and ${win ? 'won' : 'lost'}!`, icon_url: member?.user.avatar ? `https://cdn.discordapp.com/avatars/${member?.user.id}/${member?.user.avatar}.png` : "" }
        }]
    };
});
commands.set('appeal', async ({ body, res, guildConfig }) => {
    const { guildname } = await guildConfig();
    const userdata = await usersCollection.find({ userId: body.member?.user.id }).toArray();
    const seenGuilds = new Map<string, string>();
    for (const data of userdata) {
        for (const p of data.punishments || []) {
            if (p.type === "Ban" && !seenGuilds.has(body.guild_id)) {
                seenGuilds.set(body.guild_id, guildname);
            }
        }
    };
    const opts = Array.from(seenGuilds).map(([id, gName]) => ({ label: gName, value: id }));
    if (!opts.length) {
        res.data = { content: "I couldn't find any entries", flags: 64 }
        return Response.json(res)
    }
    res.type = InteractionResponseType.Modal
    res.data = {
        custom_id: 'appealModal', title: 'Ban Appeal Submission',
        components: [
            { type: ComponentType.Label, label: "Guild", component: { type: ComponentType.StringSelect, custom_id: 'guildId', max_values: 1, options: opts, required: true } },
            { type: ComponentType.Label, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 1, required: true } },
            { type: ComponentType.Label, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
            { type: ComponentType.Label, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } },
            { type: ComponentType.Label, label: 'Ban appeal evidence can go here.', component: { type: 19, custom_id: 'evidence', required: false, min_values: 1, max_values: 5 } }
        ]
    }
})
commands.set('games.tictactoe', async ({ body, res }) => {
    const { member } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const player2: string = subcommandoptions[0]!.value;
    if (member?.user.id === player2) return Response.json({ type: 4, data: { content: "You can't play against yourself.", flags: 64 } });
    const current = Math.random() < 0.5 ? member!.user.id : player2;
    res.data = {
        content: `<@${player2}>, <@${member?.user.id}> wants to play tictactoe`,
        embeds: [{ color: 0x0000ff, title: 'TicTacToe', description: `It's <@${current}>'s turn to move.` }],
        components: generateButtons(Array(9).fill(' '), member!.user.id, player2, current!)
    };
});
commands.set('games.highlow', async ({ res }) => {
    const start = Math.ceil(Math.random() * 100);
    let secret = Math.ceil(Math.random() * 100);
    while (secret === start) secret = Math.ceil(Math.random() * 100);
    res.data = {
        embeds: [{ color: 0x333300, title: "Higher or Lower", description: `I am thinking of a number. Do you think my number is higher or lower than the number below? `, fields: [{ name: 'Current Number:', value: `${start}` }] }],
        components: [{
            type: 1, components: [
                { type: 2, label: "Higher", style: 1, custom_id: `highlow-higher-${start}-${secret}` },
                { type: 2, label: "Lower", style: 4, custom_id: `highlow-lower-${start}-${secret}` }
            ]
        }]
    };
});
commands.set('rank', async ({ body }) => {
    const { options, resolved } = body.data;
    const { member, guild_id } = body;
    const targetUser = options ? resolved!.users![options[0]!.value] : member.user;
    const { level, xp, coins, totalmessages } = await usersCollection.findOne({ userId: targetUser!.id, guildId: guild_id }, { projection: { level: 1, xp: 1, coins: 1, avatar: 1, totalmessages: 1, nick: 1 } }) as Document;
    const { exponent, baseMultiplier, roundToNearest, flatOffset } = await guildconfigs.findOne({ guildId: guild_id }, { projection: { exponent: 1, baseMultiplier: 1, roundToNearest: 1, flatOffset: 1 } }) as Document;
    const rank = await usersCollection.countDocuments({ guildId: guild_id, $or: [{ level: { $gt: level } }, { level: level, xp: { $gt: xp } }] });
    const avRes = await response({ method: "GET", endpoint: targetUser!.avatar ? `https://cdn.discordapp.com/avatars/${targetUser?.id}/${targetUser!.avatar}.webp` : `https://cdn.discordapp.com/embed/avatars/${targetUser!.discriminator !== '0' ? parseInt(targetUser!.discriminator) % 5 : Number((BigInt(targetUser!.id) >> 22n) % 6n)}.png` });
    const resizedAvatarBuf = await new Bun.Image(await avRes.arrayBuffer()).resize(100, 100).png().toBase64();
    const reqXp = Math.round(((level < 100 ? level : 100) ** exponent * baseMultiplier + flatOffset) / roundToNearest);
    const rankCardSvg = `<svg width="500" height="150" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="avatarClip"><circle cx="70" cy="75" r="50"/></clipPath></defs><rect width="500" height="150" rx="16" fill="#2c2f33"/><circle cx="70" cy="75" r="52" stroke="#3ba55d" stroke-width="3" fill="none" /><image href="data:image/png;base64,${resizedAvatarBuf}" x="20" y="25" width="100" height="100" clip-path="url(#avatarClip)"/><text x="130" y="60" fill="white" font-size="20" font-family="Arial" font-weight="bold">${targetUser?.username.slice(0, 15) + (targetUser?.username.length! > 15 ? "..." : "")}</text><text x="300" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="middle">Level ${level}</text><text x="440" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="end">Rank #${rank + 1}</text><rect x="130" y="85" width="350" height="20" rx="10" fill="#484b4e"/><rect x="130" y="85" width="${Math.min(Math.max(350 * (xp / reqXp), 25), 350)}" height="20" rx="10" fill="#3ba55d"/><text x="480" y="75" fill="#ccc" font-size="16" font-family="Arial" text-anchor="end">${xp} / ${reqXp} xp</text><text x="150" y="130" fill="#ccc" font-size="18" font-family="Arial">Coins: ${coins} | Messages: ${totalmessages}</text></svg>`;
    const rankCardBuffer = await sharp(Buffer.from(rankCardSvg)).png().toBuffer();
    const form = new FormData();
    form.append('files[0]', new Blob([rankCardBuffer], { type: "image/png" }), 'rankcard.png');
    form.append('payload_json', JSON.stringify({ type: InteractionResponseType.ChannelMessageWithSource }));
    return new Response(form);
});
commands.set('blacklist.view', async ({ body, res }) => {
    const { guild_id } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const targetUser = body.data.resolved?.users![subcommandoptions[0]!.value as string];
    const { embed } = await buildBlacklistEmbed(targetUser, guild_id);
    res.data = { embeds: [embed] };
});
commands.set('blacklist.add', async ({ body, res }) => {
    const { guild_id } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const targetUser = body.data.resolved?.users![subcommandoptions[0]!.value as string];
    const role = subcommandoptions[1]!.value as string;
    const { embed, blacklist } = await buildBlacklistEmbed(targetUser, guild_id);
    if (!blacklist.includes(role)) {
        await usersCollection.updateOne({ userId: targetUser!.id, guildId: guild_id }, { $push: { blacklist: role } as any });
        await response({ method: "DELETE", endpoint: `guilds/${guild_id}/members/${targetUser!.id}/roles/${role}` });
        embed.description = `<@&${role}> was blacklisted from <@${targetUser!.id}>`;
    } else {
        embed.description = `<@&${role}> is already blacklisted from <@${targetUser!.id}>`;
    }
    res.data = { embeds: [embed] };
});
commands.set('blacklist.remove', async ({ body, res }) => {
    const { guild_id } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const targetUser = body.data.resolved?.users![subcommandoptions[0]!.value as string];
    const role = subcommandoptions[1]!.value as string;
    const { embed } = await buildBlacklistEmbed(targetUser, guild_id);
    await usersCollection.updateOne({ userId: targetUser!.id, guildId: guild_id }, { $pull: { blacklist: role } as any });
    embed.description = `<@&${role}> was removed from <@${targetUser!.id}>'s blacklist`;
    res.data = { embeds: [embed] };
});
commands.set('apply', async ({ body, res }) => {
    const { member, guild_id } = body;
    const { application } = await usersCollection.findOne({ userId: member?.user.id, guildId: guild_id }, { projection: { application: 1 } }) as any;
    if (application?.Activity) {
        res.data = { content: 'Already Completed. Click the button below to continue.', components: [{ type: 1, components: [{ type: 2, custom_id: 'next_modal_two', label: 'skip Part 1', style: 1 }] }], flags: 64 };
        return;
    }
    res.type = InteractionResponseType.Modal;
    res.data = {
        title: 'Experience and Activity (1/3)',
        custom_id: 'server',
        components: [
            { type: ComponentType.Label, label: `What age range are you in?`, component: { type: 3, custom_id: 'age', options: [{ label: '12 or under', value: '12 or under' }, { label: '13 to 15', value: '13-15' }, { label: '16 to 17', value: '16-17' }, { label: '18 or over', value: '18 or over' }], max_values: 1, required: true } },
            { type: ComponentType.Label, label: 'Any prior mod experience?', component: { type: 4, custom_id: 'experience', required: true, style: 2, max_length: 300 } },
            { type: ComponentType.Label, label: 'Have you been warned/muted?', component: { type: 4, custom_id: 'punishments', required: true, style: 1, max_length: 100 } },
            { type: ComponentType.Label, label: 'Timezone?', component: { type: 4, custom_id: 'timezone', required: true, style: 1, placeholder: 'put current time if unsure', max_length: 8 } },
            { type: ComponentType.Label, label: `How active are you in the server?`, component: { type: 4, custom_id: 'activity', style: 1, required: true, max_length: 150 } }
        ]
    };
});
commands.set('leaderboard', async ({ body, res }) => {
    const { guild_id } = body;
    const board = await usersCollection.find({ guildId: guild_id }).limit(10).sort({ level: -1, xp: -1 }).toArray();
    const guild = await response({ method: "GET", endpoint: `guilds/${guild_id}` }) as APIGuild;
    res.data = {
        embeds: [{
            title: `Most active in ${guild.name}`, thumbnail: { url: `https://cdn.discordapp.com/icons/${guild_id}/${guild.icon}.png` }, color: 0x0c23a3,
            description: `**__LeaderBoard:__**\n${board.map((u: any, idx) => `Rank \`${idx + 1}\`: <@${u.userId}> - level \`${u.level}\` with \`${u.xp}\` xp`).join('\n')}`,
            timestamp: new Date().toISOString()
        }]
    };
});
commands.set('modlogs', async ({ body, res }) => {
    const { options, resolved } = body.data;
    const { member, guild_id, id, token } = body;
    const target = options![0]!.value as string;
    const targetUser = resolved!.users![target];
    const isAdmin = (BigInt(member!.permissions) & 8n) !== 0n;
    const { punishments } = await usersCollection.findOne({ userId: targetUser!.id, guildId: guild_id }, { projection: { punishments: 1, avatar: 1 } }) as any;
    if (!punishments?.length) {
        res.data = { embeds: [{ color: 0xf58931, description: `❌ No modlogs found for <@${targetUser!.id}>.` }] };
        return;
    }
    const btn = (disabled: boolean) => [
        { type: 2, custom_id: `modlog-prev-${targetUser!.id}-0-${member?.user.id}`, label: '⬅️ Back', style: 2, disabled: true },
        { type: 2, custom_id: `modlog-next-${targetUser!.id}-0-${member?.user.id}`, label: 'Next ➡️', style: 2, disabled: punishments.length <= 1 || disabled },
        ...(isAdmin ? [{ type: 2, custom_id: `modlog-del-${targetUser!.id}-0-${member?.user.id}-${punishments[0]._id}`, label: 'Delete', style: 4, disabled }] : [])
    ];
    setTimeout(() => { response({ method: "PATCH", endpoint: `webhooks/${id}/${token}/messages/@original`, body: { components: [{ type: 1, components: btn(true) }] } }).catch(() => null); }, 600000);
    res.data = {
        embeds: [await buildLogEmbed(targetUser!, punishments[0], 0, punishments.length)],
        components: [{ type: 1, components: btn(false) }]
    };
});
commands.set('note.add', async ({ body, res }) => {
    const { member, guild_id } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const targetUser = subcommandoptions[0]!.value as string;
    const note = subcommandoptions[1]!.value as string;
    await usersCollection.updateOne({ userId: targetUser, guildId: guild_id }, { $push: { notes: { _id: new ObjectId(), moderatorId: member?.user.id, note, timestamp: Date.now() } } as any });
    res.data = { embeds: [{ color: 0x00a900, description: `📝 note created for <@${targetUser}>\n\n > ${note}` }] };
});
commands.set('note.show', async ({ body, res }) => {
    const { member, guild_id, application_id, token } = body;
    const subcommandoptions = (body.data.options![0] as APIApplicationCommandSubcommandOption).options as APIApplicationCommandBasicOption[];
    const targetUser = subcommandoptions[0]!.value as string;
    const u = body.data.resolved?.users![targetUser];
    const emptyEmbed: APIEmbed = { color: 0x00a900, description: `❌ No notes found for <@${u!.id}>`, thumbnail: { url: `https://cdn.discordapp.com/avatars/${u!.id}/${u!.avatar}.png` } };

    const [newData] = await usersCollection.aggregate([
        { $match: { userId: u!.id, guildId: guild_id } },
        { $unwind: "$notes" },
        { $sort: { "notes.timestamp": -1 } },
        { $facet: { "notes": [{ $skip: 0 }, { $limit: 1 }], "total": [{ $count: "count" }] } }
    ]).toArray();

    if (!newData?.total?.length) {
        res.data = { embeds: [emptyEmbed] };
        return;
    }

    const count = newData.total[0].count;
    const firstNote = newData.notes[0].notes;
    const mod = await response({ method: "GET", endpoint: `users/${firstNote.moderatorId}` }) as any;
    const dateStr = new Date(firstNote.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
    const btn = (disabled: boolean) => [
        { type: ComponentType.Button, custom_id: `note-prev-${u!.id}-0-${member?.user.id}`, label: '◀️ prev', style: ButtonStyle.Secondary, disabled: true },
        { type: ComponentType.Button, custom_id: `note-next-${u!.id}-0-${member?.user.id}`, label: '▶️ next', style: ButtonStyle.Secondary, disabled: count <= 1 || disabled },
        { type: ComponentType.Button, custom_id: `note-del-${u!.id}-0-${member?.user.id}-${firstNote._id}`, label: '🗑️ delete', style: ButtonStyle.Danger, disabled }
    ];
    setTimeout(() => { response({ method: "PATCH", endpoint: `webhooks/${application_id}/${token}/messages/@original`, body: { components: [{ type: 1, components: btn(true) }] } }).catch(() => null); }, 600000);
    res.data = {
        embeds: [{ color: 0xdddddd, thumbnail: { url: `https://cdn.discordapp.com/avatars/${u!.id}/${u!.avatar}.png` }, description: `<@${u!.id}> notes | \`${1} of ${count}\`\n > ${firstNote.note}`, footer: { text: `${mod.username} | ${dateStr}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` } }],
        components: [{ type: 1, components: btn(false) }]
    };
});
commands.set('applications.open', async ({ body, res }) => {
    const { guild_id, channel } = body;
    await response({ method: "PATCH", endpoint: `channels/${channel.id}`, body: { permissionOverwrites: [{ id: guild_id, type: 0, allow: "2147848672", deny: "0" }] } });
    res.data = { content: 'Apps have now been opened!' };
});
commands.set('applications.close', async ({ body, res }) => {
    const { guild_id, channel } = body;
    await response({ method: "PATCH", endpoint: `channels/${channel.id}`, body: { permissionOverwrites: [{ id: guild_id, type: 0, allow: "0", deny: "2147848672" }] } });
    await usersCollection.updateMany({ guildId: guild_id }, { $set: { application: {} } });
    res.data = { content: 'Apps have now been closed!' };
});
commands.set('member', async (ctx) => {
    const guarded = await memberGuards(ctx);
    if (guarded) return;
    return runPunishment(ctx);
});
commands.set('appeal', async ({ body, res, guildConfig }) => {
    const { member, guild_id } = body;
    const { guildname } = await guildConfig();
    const userdata = await usersCollection.find({ userId: member?.user.id }).toArray();
    const seenGuilds = new Map<string, string>();
    for (const data of userdata) {
        for (const p of data.punishments || []) {
            if (p.type === "Ban" && !seenGuilds.has(guild_id)) {
                seenGuilds.set(guild_id, guildname);
            }
        }
    }
    const opts = Array.from(seenGuilds).map(([id, gName]) => ({ label: gName, value: id }));
    if (!opts.length) {
        res.data = { content: "I couldn't find any entries", flags: 64 };
        return;
    }
    res.type = InteractionResponseType.Modal;
    res.data = {
        custom_id: 'appealModal', title: 'Ban Appeal Submission',
        components: [
            { type: ComponentType.Label, label: "Guild", component: { type: ComponentType.StringSelect, custom_id: 'guildId', max_values: 1, options: opts, required: true } },
            { type: ComponentType.Label, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 1, required: true } },
            { type: ComponentType.Label, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
            { type: ComponentType.Label, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } },
            { type: ComponentType.Label, label: 'Ban appeal evidence can go here.', component: { type: 19, custom_id: 'evidence', required: false, min_values: 1, max_values: 5 } }
        ]
    };
});
commands.set('link', async ({ body, res }) => {
    const { member } = body;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await usersCollection.updateOne(
        { userId: member?.user.id, guildId: '1231453115937587270' },
        { $set: { twitchLinkCode: code, twitchLinkExpires: Date.now() + 10 * 60000 } }
    );
    res.data = { embeds: [{ description: `Type \`!verify ${code}\` in Twitch chat within 10 minutes.` }], flags: 64 };
});
commands.set('refresh', async ({ body, res }) => {
    const { guild_id, application_id, token } = body;
    (async () => {
        const existing = await guildconfigs.findOne({ guildId: guild_id }, { projection: { _id: 0, messageConfigs: 1 } }) as Document;
        const { messageConfigs } = existing;
        for (const [embedName, config] of Object.entries(messageConfigs as Document)) {
            const { channelid, embeds, components, reactions, messageId } = config;
            try {
                if (!messageId) throw new Error("no message sent yet");
                const message = await response({ method: "GET", endpoint: `channels/${channelid}/messages/${messageId}` }) as any;
                const different = message.embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||') !== embeds.map((embed: APIEmbed) => getComparableEmbed(embed)).join('|||');
                if (different) {
                    await response({ method: "PATCH", endpoint: `channels/${channelid}/messages/${messageId}`, body: { embeds: embeds, ...components } });
                }
            } catch {
                let msg: APIMessage;
                try {
                    msg = await response({ method: "POST", endpoint: `channels/${channelid}/messages`, body: { embeds: embeds, components: components } });
                } catch (err) {
                    if (err instanceof DiscordAPIError) {
                        await appendFile("./log.log", `Error sending embed: ${embedName} cause: ${err.message}\n`);
                        continue;
                    }
                    throw err;
                }
                if (reactions) {
                    for (const r of reactions) {
                        const emoji = typeof r === 'string' ? r : r.emoji;
                        await response({ method: "PUT", endpoint: `/channels/${channelid}/messages/${msg!.id}/reactions/${emoji}/@me` });
                        await Bun.sleep(750);
                    }
                }
                await appendFile("./log.log", `📝 Sent '${embedName}'. Message ID: ${msg!.id} \n`);
                await guildconfigs.updateOne({ guildId: guild_id }, { [`messageConfigs.${embedName}.messageId`]: msg!.id });
            }
        }
        await response({ method: "PATCH", endpoint: `webhooks/${application_id}/${token}/messages/@original`, body: { embeds: [{ description: 'Embeds updated!' }] } });
    })();
    res.type = InteractionResponseType.DeferredChannelMessageWithSource;
});
commands.set('restart', async ({ res }) => {
    const botPid = parseInt(await Bun.file("./pid.txt").text());
    res.data = { embeds: [{ description: "🔄 **Restarting bot..**", color: 0x5865F2 }] };
    Bun.spawn(["powershell", "-ExecutionPolicy", "Bypass", "-File", "C:\\Users\\micha\\Desktop\\Bot\\restart.ps1", "-BotPid", `${botPid}`, "-intpid", `${process.pid}`], { stderr: "pipe", stdout: 'pipe', stdin: 'pipe' });
});

setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) if (s.expires < now) sessions.delete(id);
    for (const [state, expires] of oauthStates) if (expires < now) oauthStates.delete(state);
}, 60_000);
Bun.serve({
    port: 3000,
    websocket: { open() { }, message() { }, close() { } },
    routes: {
        "/": () => new Response(Bun.file("./index.html")),
        "/controller.js": () => new Response(Bun.file("./dist/controller.js"), { headers: { "Content-Type": "application/javascript" } }),
        "/favicon.ico": () => new Response(null, { status: 204 }),
        "/output.css": () => new Response(Bun.file("./dist/output.css"), { headers: { "Content-Type": "text/css" } }),
        "/api/auth/discord/login": () => {
            const state = randomToken();
            oauthStates.set(state, Date.now() + 5 * 60 * 1000);
            const params = new URLSearchParams({
                client_id: Bun.env.CLIENT_ID!,
                redirect_uri: Bun.env.DISCORD_REDIRECT_URI!,
                response_type: "code",
                scope: "identify",
                state,
            });
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: `https://discord.com/oauth2/authorize?${params}` } });
        },
        "/api/auth/discord/redirect": async (req) => {
            const url = new URL(req.url);
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            if (!code || !state || !oauthStates.has(state)) return new Response("Invalid or expired OAuth state", { status: StatusCodes.BAD_REQUEST });
            oauthStates.delete(state);
            const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: Bun.env.CLIENT_ID!,
                    client_secret: Bun.env.DISCORD_SECRET!,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: Bun.env.DISCORD_REDIRECT_URI!,
                }),
            });
            if (!tokenRes.ok) return new Response("OAuth token exchange failed", { status: 502 });
            const { access_token } = await tokenRes.json() as { access_token: string };
            const userRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${access_token}` } });
            if (!userRes.ok) return new Response("Failed to fetch Discord user", { status: StatusCodes.BAD_GATEWAY });
            const discordUser = await userRes.json() as { id: string; username: string };

            const sessionId = randomToken();
            sessions.set(sessionId, { userId: discordUser.id, expires: Date.now() + 24 * 60 * 60 * 1000 });
            return new Response(null, {
                status: 302,
                headers: {
                    Location: "/",
                    "Set-Cookie": `session=${sessionId}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`,
                },
            });
        },
        "/api/discord/users/:userId": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            GET: async (req) => {
                const session = getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { userId } = req.params;
                if (!userId) return Response.json({ error: "Invalid User" }, { status: StatusCodes.NOT_FOUND, headers: corsHeaders });
                try {
                    const user = await response({ method: "GET", endpoint: `users/${userId}` }) as APIUser;
                    return Response.json(
                        { ...user },
                        { headers: { ...corsHeaders, "Cache-Control": "private, max-age=3600" } }
                    );
                } catch {
                    return Response.json({ error: "Could not resolve user" }, { status: StatusCodes.NOT_FOUND, headers: corsHeaders });
                }
            }
        },
        "/api/auth/discord/bot-redirect": async (req) => {
            const url = new URL(req.url)
            const guildId = url.searchParams.get('guild_id')
            if (!guildId) return;
            const guild = await response({ method: "GET", endpoint: `guilds/${guildId}` }) as APIGuild;
            await guildconfigs.insertOne(
                {
                    guildId: guild.id,
                    guildname: guild.name,
                    icon: guild.icon,
                    modChannels: {
                        mutelogChannel: "", deletedlogChannel: "", welcomeChannel: "", updatedlogChannel: "", namelogChannel: "", banlogChannel: "", appealChannel: "", applicationChannel: "", adminChannel: "", applyChannel: "", voicelogChannel: ""
                    },
                    publicChannels: {},
                    generalchannels: [],
                    ownerId: guild.owner_id,
                    reactions: {},
                    automodsettings: { messagereasonsandweights: {}, automodreasonsandweights: {}, Duplicatespamthreshold: 3, mediathreshold: 1, messagethreshold: 10, spamthreshold: 4, capsthreshold: 0.7 },
                    responses: {},
                    staffroles: [],
                    Invites: [],
                    Data: [],
                    count: 0,
                    lastuser: "",
                    appealInvite: "https://discord.gg/xpYnPrSXDG",
                    messageConfigs: {},
                    baseMultiplier: 0,
                    exponent: 0,
                    flatOffset: 0,
                    roundToNearest: 0,
                    Stages: [
                        { "label": "15 min mute", "minutes": 0 },
                        { "label": "30 min mute", "minutes": 15 },
                        { "label": "45 min mute", "minutes": 30 },
                        { "label": "1 hour mute", "minutes": 45 },
                        { "label": "2 hour mute", "minutes": 60 },
                        { "label": "4 hour mute", "minutes": 120 },
                        { "label": "8 hour mute", "minutes": 240 },
                        { "label": "16 hour mute", "minutes": 960 },
                        { "label": "16 hour mute", "minutes": 960 }
                    ],
                    Ban: ""
                });
            appendFile("./log.log", `Created default config for new guild ${guild.id}`);
            return new Response(null, { status: StatusCodes.MOVED_TEMPORARILY, headers: { Location: "/" }, });
        },
        "/api/auth/me": {
            GET: (req) => {
                const session = getSession(req);
                if (!session) return Response.json({ loggedIn: false }, { headers: corsHeaders });
                return Response.json({ loggedIn: true, userId: session.userId }, { headers: corsHeaders });
            }
        },
        "/api/auth/logout": {
            POST: (req) => {
                const sid = parseCookies(req)["session"];
                if (sid) sessions.delete(sid);
                return new Response(null, { status: StatusCodes.NO_CONTENT, headers: { ...corsHeaders, "Set-Cookie": "session=; Path=/; Max-Age=0" } });
            }
        },
        "/api/guilds": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            GET: async (req) => {
                const session = getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const docs = await guildconfigs.find({}, { projection: { guildId: 1, name: 1, staffroles: 1, _id: 0, ownerId: 1 } }).toArray();
                const results = await Promise.all(docs.map(async (doc) => {
                    const memberRoles = await fetchMemberRoles(session.userId, doc.guildId as string);
                    if (!memberRoles) return null;
                    const role = roleFromStaffroles(session.userId, memberRoles, doc.staffroles as string[] | undefined, doc.ownerId as string | undefined);
                    if (!role) return null;
                    return { guildId: doc.guildId as string, name: (doc.name as string) ?? null, role };
                }));
                const authorized = results.filter((r): r is NonNullable<typeof r> => r !== null);
                return Response.json(authorized, { headers: corsHeaders });
            }
        },
        "/api/guilds/:guildId": {
            OPTIONS: () => new Response(null, { headers: corsHeaders }),
            GET: async (req) => {
                const session = getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                const doc = await guildconfigs.findOne({ guildId });
                if (!doc) return Response.json({ error: "Not found" }, { status: StatusCodes.NOT_FOUND, headers: corsHeaders });
                const [memberRoles, guildRoles, guildChannels, rules] = await Promise.all([
                    fetchMemberRoles(session.userId, guildId),
                    response({ method: "GET", endpoint: `guilds/${guildId}/roles` }) as Promise<APIRole[]>,
                    response({ method: "GET", endpoint: `guilds/${guildId}/channels` }) as Promise<APIChannel[]>,
                    response({ method: "GET", endpoint: `guilds/${guildId}/auto-moderation/rules` }) as Promise<APIAutoModerationRule[]>,
                ]);
                const selectableChannels = guildChannels
                    .filter((c: APIChannel) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type))
                    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
                const role = roleFromStaffroles(session.userId, memberRoles, doc.staffroles as string[] | undefined, doc.ownerId as string | undefined);
                if (!role) return Response.json({ error: "Forbidden" }, { status: StatusCodes.FORBIDDEN, headers: corsHeaders });
                return Response.json({
                    ...doc,
                    _viewerRole: role,
                    guildRoles: guildRoles,
                    guildChannels: selectableChannels,
                    rules: (rules.map(r => ({ id: r.id, name: r.name })))
                }, { headers: corsHeaders });
            },
            PUT: async (req) => {
                const session = getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                const existing = await guildconfigs.findOne({ guildId: guildId }, { projection: { staffroles: 1, ownerId: 1 } });
                if (!existing) {
                    await guildconfigs.insertOne({ guildId: guildId, staffroles: [] })
                    return Response.json(
                        { error: "This guild has no config yet. It must be initialized (with staffroles set) before it can be edited here." },
                        { status: 404, headers: corsHeaders }
                    );
                }
                const memberRoles = await fetchMemberRoles(session.userId, guildId);
                const role = roleFromStaffroles(session.userId, memberRoles, existing.staffroles as string[] | undefined, existing.ownerId as string | undefined);
                if (role !== "admin") return Response.json({ error: "Forbidden — admin role required to save" }, { status: StatusCodes.FORBIDDEN, headers: corsHeaders });

                let body: Record<string, unknown>;
                try { body = await req.json(); }
                catch { return Response.json({ error: "Invalid JSON body" }, { status: StatusCodes.BAD_REQUEST, headers: corsHeaders }); }
                const setDoc: Record<string, unknown> = {};
                for (const key of CONFIGURATOR_MANAGED_KEYS) {
                    if (key in body) setDoc[key] = body[key];
                }
                if (Object.keys(setDoc).length === 0) {
                    return Response.json({ error: "No recognized fields in body" }, { status: StatusCodes.BAD_REQUEST, headers: corsHeaders });
                }
                await guildconfigs.updateOne({ guildId }, { $set: setDoc }, { upsert: false });
                return Response.json({ ok: true }, { headers: corsHeaders });
            },
            DELETE: async (req) => {
                const session = getSession(req);
                if (!session) return Response.json({ error: "Not logged in" }, { status: StatusCodes.UNAUTHORIZED, headers: corsHeaders });
                const { guildId } = req.params;
                const existing = await guildconfigs.findOne({ guildId }, { projection: { staffroles: 1, ownerId: 1 } });
                if (!existing) return Response.json({ error: "Not found" }, { status: StatusCodes.NOT_FOUND, headers: corsHeaders });
                const memberRoles = await fetchMemberRoles(session.userId, guildId);
                const role = roleFromStaffroles(session.userId, memberRoles, existing.staffroles as string[] | undefined, existing.ownerId as string | undefined);
                if (role !== "admin") {
                    return Response.json({ error: "Forbidden — admin role required to delete" }, { status: StatusCodes.FORBIDDEN, headers: corsHeaders });
                }
                await response({ method: "DELETE", endpoint: `guilds/${guildId}/members/1420927654701301951` })
                await guildconfigs.deleteOne({ guildId });
                return Response.json({ ok: true }, { headers: corsHeaders });
            }
        },
        "/interactions": async (req) => {
            const rawBody = await req.text();
            const data = new TextEncoder().encode(req.headers.get('X-Signature-Timestamp') + rawBody);
            const signature = new Uint8Array(Buffer.from(req.headers.get('x-signature-ed25519')!, 'hex'));
            const publickey = new Uint8Array(Buffer.from(`${Bun.env.DISCORD_PKEY}`, 'hex'));
            if (!ed25519.verify(signature, data, publickey))
                return new Response('Unauthorized', { status: StatusCodes.UNAUTHORIZED });
            const body: APIInteraction = JSON.parse(rawBody);
            if (body.type == InteractionType.Ping) return Response.json({ type: InteractionResponseType.Pong });
            switch (body.type) {
                case InteractionType.ApplicationCommand: return await handleCommands(body as APIChatInputApplicationCommandGuildInteraction);
                case InteractionType.MessageComponent: return await handleComponents(body as APIMessageComponentInteraction);
                case InteractionType.ModalSubmit: return await handleModals(body as APIModalSubmitInteraction);
            }
        }
    }
})
