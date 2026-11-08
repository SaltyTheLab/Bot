import { cron, sleep, file, Image } from 'bun'
import { usersCollection, guildconfigs, type DbInvite } from './Database';
import statusMap from './statusMap';
import { ObjectId, type Document, type WithId } from 'mongodb';
import { ComponentType, ButtonStyle, MessageType, ActivityType, PresenceUpdateStatus, Client, Options, Role, Routes, Partials, GatewayIntentBits, TextChannel, MessageFlags, subtext, GuildMember, GuildMemberFlags, Invite, SectionBuilder, TextDisplayBuilder, ContainerBuilder, ButtonBuilder, ThumbnailBuilder, Collection, bold, quote, ChatInputCommandInteraction, EmbedBuilder, InteractionResponse, PermissionFlagsBits, MediaGalleryBuilder, ActionRowBuilder, ModalBuilder, User, SeparatorBuilder, SeparatorSpacingSize, ButtonComponent, AttachmentBuilder } from 'discord.js'
import { createHash } from 'crypto'
import awardXp from './xp';
import { apiClient, syncTwitchConfigs } from './twitch';
import { Resvg } from '@resvg/resvg-js';
import { buildApplicationHub, PART_CONFIG } from './applicationConfig';
import { readdir } from 'fs/promises';
process.on("uncaughtException", (err: any) => { console.error('[root] Uncaught exception', err) })
process.on("unhandledRejection", (reason: any) => { console.error('[root] Unhandled rejection', reason) });

const client = new Client({
    intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildModeration | GatewayIntentBits.GuildExpressions | GatewayIntentBits.GuildIntegrations | GatewayIntentBits.GuildWebhooks | GatewayIntentBits.GuildVoiceStates | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildMessageReactions | GatewayIntentBits.MessageContent,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    presence: { activities: [{ name: `for 0d 0h 0m 0s`, type: ActivityType.Watching, }], status: 'online', afk: false },
    makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings }),
    sweepers: { ...Options.DefaultSweeperSettings }
});
const ephemeral = (content: string) => { return new EmbedBuilder({ description: content }) };
const LOG_COLORS: Record<string, number> = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
const fmtDate = (ts: number) => new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' });
const notice = (description: string, color?: number) => new EmbedBuilder({ color: color ?? undefined, description: description }).toJSON();
async function runPunishment(interaction: ChatInputCommandInteraction, guildConfig: Document): Promise<void> {
    const { guildId, channelId, options, guild } = interaction
    const targetUser = options.getUser('target', true);
    const reason = options.getString('reason', true);
    const subcommand = options.getSubcommand();
    const { Stages, modChannels } = guildConfig;
    const punishmentDoc = await usersCollection.findOne({ userId: targetUser.id, guildId }, { projection: { punishments: 1 } });
    const punishments: any[] = punishmentDoc?.punishments ?? [];
    const activeWarns = punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0);
    let warnType = subcommand === 'ban' ? 'Ban' : subcommand === 'kick' ? 'Kick' : subcommand === 'mute' ? 'Mute' : 'Warn';
    const stage = Stages[Math.min(activeWarns, Stages.length - 1)] ?? { label: 'Warning', minutes: 0 };
    let durationMs = 0;
    let durationStr: string | null = null;
    if ((stage.minutes > 0 && warnType === 'Warn') || warnType === 'Mute') {
        const unit = interaction.options.getString('unit', true);
        const duration = interaction.options.getString('duration', true);
        const unitMap: Record<string, number> = { min: 60000, hour: 3600000, day: 86400000 };
        durationMs = stage.minutes > 0 ? stage.minutes * 60000 : Number(duration) * unitMap[unit]!;
        durationStr = stage.minutes > 0 ? stage.label : `${duration} ${unit}`;
        warnType = 'Mute';
    }
    const finalMessage = await interaction.editReply({
        embeds: [new EmbedBuilder({
            color: statusMap[warnType]!.color,
            author: { name: `${targetUser.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : statusMap[warnType]!.cmd}`, iconURL: targetUser.displayAvatarURL() ?? targetUser.defaultAvatarURL }
        })]
    });
    const object = new ObjectId();
    const newPunishment = { _id: object, userId: targetUser.id, moderatorId: interaction.user.id, reason, duration: durationMs, timestamp: Date.now(), active: 1, weight: 1, type: warnType, guildId, channel: channelId, refrence: `https://discord.com/channels/${guildId}/${channelId}/${finalMessage.id}`, warns: isFinite(activeWarns) ? activeWarns : 1 };
    await usersCollection.updateOne({ userId: targetUser.id, guildId }, { $push: { punishments: newPunishment as any } });
    const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === 'Ban' : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
    let dm = true;
    const container = new ContainerBuilder()
        .setAccentColor(statusMap[warnType]!.color)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder({ content: `<@${targetUser.id}>, ${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${guild?.name}](https://discord.com/channels/${guildId}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${guild?.name}` : `in ${guild?.name}`}` }),
                    new TextDisplayBuilder({ content: `Reason: \`${reason}\` ${['Ban', 'Kick'].includes(warnType) ? '' : `\nPunishment: ${durationStr ? `\`1 warn,${durationStr}\`` : `\`1 warn\``}`}\nActive Warnings: \`${activeWarns + 1}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>` }))
                .setThumbnailAccessory({ type: ComponentType.Thumbnail, media: { url: `${interaction.guild?.iconURL()}` }, })
        )
    warnType == 'Ban' ? container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder({ style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }))) : null
    const dmResult = targetUser.send({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    }) 
    if (!dmResult) dm = false
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId }, { $set: { Ban: targetUser.id } });
            await client.rest.put(Routes.guildBan(guildId!, targetUser.id), { body: { delete_message_seconds: 604800 }, reason: `Ban Command: ${reason}` });
            break;
        case 'Mute':
            await client.rest.patch(Routes.guildMember(guildId!, targetUser.id), { body: { communication_disabled_until: new Date(Date.now() + Math.min(durationMs, 2419200000)).toISOString() }, reason: `Mute Command: ${reason}` });
            break;
        case 'Kick':
            await client.rest.delete(Routes.guildMember(guildId!, targetUser.id), { reason: `Kick Command: ${reason}` });
            break;
    }
    const logcontainer = new ContainerBuilder()
        .setAccentColor(statusMap[warnType]!.color)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`${interaction.user.username} ${statusMap[warnType]!.log}\n\nuser:<@${targetUser.id}>\nChannel: <#${channelId}>\nHistory: ${caseHistory.join(' | ') || 'none'}\nReason: \`${reason}\`\n${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: ${durationStr ? `\`1 warn,${durationStr}\`` : '`1 warn`'}`}\nNext Punishment: \`${Stages[Math.min(activeWarns, Stages.length - 1)].label}\`\n\n${subtext(dm ? 'User DMed ✅' : 'User DMed 🚫')}`))
                .setThumbnailAccessory({
                    type: ComponentType.Thumbnail,
                    media: { url: targetUser.displayAvatarURL() }
                }))
    await client.rest.post(Routes.channelMessages(warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [logcontainer]
        }
    })
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne({ userId: targetUser.id, guildId }, { $set: { 'punishments.$[elem].active': 0 } }, { arrayFilters: [{ 'elem._id': object }] });
        }, 86400000);
    }
}
async function withGuards(interaction: ChatInputCommandInteraction, guildConfig: WithId<Document>, restrictedToFullMod: boolean = false): Promise<InteractionResponse | void> {
    const { member, options, } = interaction;
    const duration = options.getInteger('duration', true)
    const subcommand = options.getSubcommand(true)
    const targetuser = options.getUser('target', true)
    const targetmember = await interaction.guild!.members.fetch(targetuser.id);
    const { modChannels, staffroles } = guildConfig as WithId<Document>;
    if (subcommand) {
        if (duration! <= 0) {
            return await interaction.reply({ embeds: [notice('❌ Invalid duration')], flags: MessageFlags.Ephemeral })
        }
    }
    if (targetuser.id === member?.user.id) {
        return await interaction.reply({ embeds: [notice('You cannot moderate yourself.')], flags: MessageFlags.Ephemeral })
    }
    if (targetuser?.bot) {
        return interaction.reply({ embeds: [notice('You cannot moderate bots.')], flags: MessageFlags.Ephemeral })
    }
    if (restrictedToFullMod && !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        await client.rest.post(Routes.channelMessages(modChannels.adminChannel), {
            body: { embeds: [notice(`Jr. mod ${member?.user} tried to use a mod only command.`)] }
        });
        return await interaction.reply({ embeds: [notice('Jr mods do not have access to this command.')], flags: MessageFlags.Ephemeral })
    }
    if (targetmember?.roles.cache.some((role: Role) => staffroles.includes(role.id))) {
        await client.rest.post(Routes.channelMessages(modChannels.adminChannel), {
            body: { embeds: [notice(`<@${member?.user.id}> tried to moderate <@${targetuser!.id}>.`)] }
        });
        return await interaction.reply({ embeds: [notice(`<@${member?.user.id}> tried to moderate <@${targetuser!.id}>.`)] })

    }
};
function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
}
function buildNoteView(notes: any[], index: number, user: User, mod: User, opener: string, disabled = false) {
    const n = notes[index];
    return new ContainerBuilder({ accent_color: 0xdddddd, })
        .addSectionComponents(new SectionBuilder({ components: [{ type: ComponentType.TextDisplay, content: `<@${user.id}> notes | \`${index + 1} of ${notes.length}\`\n${String(n.note).split('\n').map(l => `> ${l}`).join('\n')}\n\n${subtext(`<@${mod.id}> | ${fmtDate(n.timestamp)}`)}` }], accessory: { type: ComponentType.Thumbnail, media: { url: user.avatarURL()! } } }))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({ custom_id: `note-prev-${user.id}-${index}-${opener}`, label: '◀️ prev', style: ButtonStyle.Secondary, disabled: disabled || index === 0 }),
            new ButtonBuilder({ custom_id: `note-next-${user.id}-${index}-${opener}`, label: '▶️ next', style: ButtonStyle.Secondary, disabled: disabled || index >= notes.length - 1 }),
            new ButtonBuilder({ custom_id: `note-del-${user.id}-${index}-${opener}-${n._id}`, label: '🗑️ delete', style: ButtonStyle.Secondary, disabled: disabled })
        ));
}
function buildModlogView(logs: any[], index: number, user: User, mod: User, opener: string, isAdmin: boolean, disabled = false) {
    const p = logs[index];
    const mins = Math.round(p.duration / 60000);
    const hours = Math.floor(mins / 60);
    const embed = new EmbedBuilder()
        .setColor(LOG_COLORS[p.type] ?? 0x838383)
        .setThumbnail(user.avatarURL())
        .addFields(
            { name: '**Member:**', value: `<@${user.id}>`, inline: true },
            { name: '**type:**', value: `\`${p.type}\``, inline: true },
            { name: '**Active:**', value: `\`${p.active == 1 ? 'true' : 'false'}\``, inline: true },
            { name: '**Reason:**', value: `\`${p.reason}\`` },
            { name: '**Punishments:**', value: `${p.type == 'Ban' ? '`Ban`' : `\`${p.weight} warn\``}${p.duration ? `,\`${hours > 0 ? `${hours} hour` : `${mins} minute`} Mute\`` : ''}` },
            { name: '**Warns at Log Time:**', value: `\`${isFinite(p.warns) ? p.warns : 0}\`` },
            { name: '**Channel:**', value: `<#${p.channel}>\n\n[Event Link](${p.refrence})` },
        )
        .setFooter({ text: `Staff: ${mod.username} | log ${index + 1} of ${logs.length} | ${fmtDate(p.timestamp)}`, iconURL: mod.avatarURL() ?? mod.defaultAvatarURL });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`modlog-prev-${user.id}-${index}-${opener}`).setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index === 0),
        new ButtonBuilder().setCustomId(`modlog-next-${user.id}-${index}-${opener}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index >= logs.length - 1),
    );
    if (isAdmin) row.addComponents(
        new ButtonBuilder().setCustomId(`modlog-del-${user.id}-${index}-${opener}-${p._id}`).setLabel('Delete').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    );
    return { embeds: [embed.toJSON()], components: [row.toJSON()] };
}
const commands = new Collection<string, (interaction: ChatInputCommandInteraction, guildConfig: WithId<Document>) => Promise<unknown>>();
const activeCooldowns = new Collection<string, number>();
function rangeForStreak(streak: number, k = 2): { min: number, max: number } {
    const width = Math.max(5, 100 / (1 + k * Math.log(streak + 1)));
    const center = width / 2 + (Math.random() - 0.5) * (100 - width); // range wanders, not glued to center
    let min = Math.ceil(Math.max(1, center - width / 2));
    let max = Math.ceil(Math.min(100, center + width / 2));
    return { min, max };
}
async function buildBlacklistEmbed(targetUser: User, guild_id: string) {
    const doc = await usersCollection.findOne({ userId: targetUser.id, guildId: guild_id }, { projection: { blacklist: 1 } });
    const blacklist: string[] = doc?.blacklist ?? [];
    const embed = new EmbedBuilder().setDescription(
        `<@${targetUser.id}>'s blacklist\n\nblacklist: ${blacklist.length ? blacklist.map(r => `<@&${r}>`).join(', ') : 'empty'}`,
    );
    return { embed, blacklist };
}
commands.set('dnd', async (interaction: ChatInputCommandInteraction) => {
    const { options } = interaction
    const sides = options.getInteger('sides', true)
    return await interaction.reply({ content: `you rolled a ${Math.ceil(Math.random() * sides)}` })
})
commands.set('games.rps', async (interaction: ChatInputCommandInteraction) => {
    const { member, guildId, options } = interaction;
    const choice = options.getString('choice', true)
    const oppChoices = ['rock', 'paper', 'scissors'];
    const opp = oppChoices[Math.floor(Math.random() * 3)]!;
    const beats: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const result = beats[opp] === choice!.toLowerCase() ? 'you win!!!' : beats[choice!] === opp ? 'Febot Wins!!!' : "It's a tie!";
    if (result === 'you win!!!') await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guildId }, { $inc: { coins: 20 } });
    return await interaction.reply({ embeds: [new EmbedBuilder({ color: 0xffa500, title: result, description: `You chose **${choice!}**.\nOpponent chose **${opp}**.` })] })
})
commands.set('games.logos', async (interaction: ChatInputCommandInteraction) => {
    const { member, user } = interaction;
    const logolist = await readdir('./images')
    const brand = logolist[Math.floor(Math.random() * logolist.length)]?.replace('.png', '')!
    const logo = file(`./images/${brand}.png`)
    const comps = shuffle([brand, ...shuffle(logolist.filter((l: any) => l.brand !== brand)).slice(0, 3)]).map((opt: string) =>
        new ButtonBuilder({ custom_id: `logos-${opt.replace('.png', '')}-${brand}`, label: opt.replace('.png', ''), style: ButtonStyle.Primary })
    )
    return await interaction.reply({
        embeds: [new EmbedBuilder()
            .setAuthor({ name: `Guess this logo ${member?.user.username}`, iconURL: user.avatarURL() ?? user.defaultAvatarURL })
            .setColor(Math.floor(Math.random() * 16777215))
        ],
        files: [new AttachmentBuilder(logo.stream(), { name: 'logo.png' })],
        components: [new ActionRowBuilder<ButtonBuilder>({ components: comps })]
    });
})
commands.set('games.tictactoe', async (interaction: ChatInputCommandInteraction) => {
    const { member, options } = interaction;
    const opponent = options.getUser('opponent', true)
    if (member!.user.id === opponent.id) { return await interaction.reply({ embeds: [ephemeral("You can't play against yourself.")] }) }
    const current = Math.random() < 0.5 ? member!.user.id : opponent.id!;
    const board = Array(9).fill('_')
    const rows = [0, 1, 2].map(i =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            [0, 1, 2].map(j => {
                const index = i * 3 + j;
                const cell = board[index]!;
                return new ButtonBuilder({
                    custom_id: `ttt-${board.join('')}-${member!.user.id}-${opponent.id}-${current}-${index}`,
                    label: cell === '_' ? '\u200b' : cell,
                    style: cell === 'X' ? ButtonStyle.Primary : cell === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary,
                    disabled: false
                })
            }),
        ),
    );
    const container = new ContainerBuilder()
        .setAccentColor(0x0000ff)
        .addTextDisplayComponents(new TextDisplayBuilder({ content: `<@${opponent}>, <@${member!.user}> wants to play tictactoe` }))
        .addActionRowComponents(rows);
    return await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container.toJSON()] })
});
commands.set('games.highlow', async (interaction: ChatInputCommandInteraction) => {
    const { min, max } = rangeForStreak(0);
    const start = min + Math.ceil(Math.random() * (max - min));
    let secret = min + Math.ceil(Math.random() * (max - min));
    while (secret === start) secret = min + Math.ceil(Math.random() * (max - min));
    const embed = new EmbedBuilder()
        .setColor(0x333300)
        .setTitle('Higher or Lower')
        .setDescription('I am thinking of a number. Do you think my number is higher or lower than the number below?')
        .addFields({ name: 'Current Number:', value: `${start}` });
    return await interaction.reply({
        embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({ custom_id: `highlow-higher-${start}-${secret}-${0}-${0}-${min}-${max}`, label: 'Higher', style: ButtonStyle.Primary }),
                new ButtonBuilder({ custom_id: `highlow-lower-${start}-${secret}-${0}-${0}-${min}-${max}`, label: 'Lower', style: ButtonStyle.Danger })
            ]
        })]
    })
});
commands.set('games.bet', async (interaction: ChatInputCommandInteraction) => {
    const { guildId, options, user } = interaction;
    const amount = options.getInteger('amount', true)
    const doc = await usersCollection.findOne({ userId: user.id, guildId: guildId }, { projection: { coins: 1 } });
    const coins: number = doc?.coins ?? 0;
    if (!amount || amount <= 0 || amount > coins) {
        return await interaction.reply({ content: amount && amount > 0 ? 'You cannot bet more than you have!' : 'Your bet must be at least 1.', flags: MessageFlags.Ephemeral })
    }
    const win = Math.random() >= 0.5;
    await usersCollection.updateOne({ userId: user.id, guildId: guildId }, { $inc: { coins: win ? Math.ceil(amount * 1.5) : -amount } });
    const embed = new EmbedBuilder()
        .setColor(win ? 0x007a00 : 0x7a0000)
        .setAuthor({ name: `${user.username} you bet ${amount} and ${win ? 'won' : 'lost'}!`, iconURL: user.avatarURL() ?? user.defaultAvatarURL });
    return await interaction.reply({ embeds: [embed] })
});
commands.set('appeal', async (interaction: ChatInputCommandInteraction) => {
    const { member, guildId, guild } = interaction;
    const userdata = await usersCollection.find({ userId: member?.user.id }).toArray();
    const seenGuilds = new Map<string, string>();
    for (const data of userdata) {
        for (const p of data.punishments || []) {
            const ban = p.filter((p: any) => p.type == "Ban")
            if (ban.length > 0 && !seenGuilds.has(guildId!)) seenGuilds.set(guildId!, guild!.name);
        }
    }
    const opts = Array.from(seenGuilds).map(([id, gName]) => ({ label: gName, value: id }));
    if (!opts.length) {
        return await interaction.reply({ content: "I couldn't find any entries", flags: MessageFlags.Ephemeral });
    }
    const modal = new ModalBuilder()
        .setCustomId('appealModal')
        .setTitle('Ban Appeal Submission')
        .addLabelComponents([
            { type: ComponentType.Label, label: "Guild", component: { type: ComponentType.StringSelect, custom_id: 'guildId', max_values: 1, options: opts, required: true } },
            { type: ComponentType.Label, label: "Why were you banned?", component: { type: ComponentType.TextInput, custom_id: 'reason', style: 1, required: true } },
            { type: ComponentType.Label, label: "Why should we accept your appeal?", component: { type: ComponentType.TextInput, custom_id: 'justification', style: 2, required: true } },
            { type: ComponentType.Label, label: 'Anything else we need to know?', component: { type: ComponentType.TextInput, custom_id: 'extra', style: 2, required: false } },
            { type: ComponentType.Label, label: 'Ban appeal evidence can go here.', component: { type: ComponentType.FileUpload, custom_id: 'evidence', required: false, min_values: 1, max_values: 5 } }
        ])
    return await interaction.showModal(modal)
});
commands.set('rank', async (interaction: ChatInputCommandInteraction, guildConfig: WithId<Document>) => {
    const { guildId, options, user } = interaction
    const targetUser = options.getUser('target') ?? user;
    const stats = await usersCollection.findOne({ userId: targetUser.id, guildId }, { projection: { level: 1, xp: 1, coins: 1, totalmessages: 1 } });
    if (!stats) return await interaction.reply({ content: 'No rank data found for that user.', flags: MessageFlags.Ephemeral });
    const { level, xp, coins, totalmessages } = stats;
    const { exponent, baseMultiplier, roundToNearest, flatOffset } = guildConfig as Document
    const [rank, avRes] = await Promise.all([
        usersCollection.countDocuments({ guildId: guildId, $or: [{ level: { $gt: level } }, { level: level, xp: { $gt: xp } }] }) as Promise<number>,
        fetch(targetUser.avatarURL() ?? targetUser.defaultAvatarURL) as Promise<Response>
    ])
    const resizedAvatarBuf = await new Image(await avRes.arrayBuffer()).resize(100, 100).png().toBase64();
    const reqXp = Math.round(((level < 100 ? level : 100) ** exponent * baseMultiplier + flatOffset) / roundToNearest);
    const rankCardSvg = `<svg width="500" height="150" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="avatarClip"><circle cx="70" cy="75" r="50"/></clipPath></defs><rect width="500" height="150" rx="16" fill="#2c2f33"/><circle cx="70" cy="75" r="52" stroke="#3ba55d" stroke-width="3" fill="none" /><image href="data:image/png;base64,${resizedAvatarBuf}" x="20" y="25" width="100" height="100" clip-path="url(#avatarClip)"/><text x="130" y="60" fill="white" font-size="20" font-family="Arial" font-weight="bold">${targetUser?.username.slice(0, 15) + (targetUser?.username.length! > 15 ? "..." : "")}</text><text x="300" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="middle">Level ${level}</text><text x="440" y="35" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="end">Rank #${rank + 1}</text><rect x="130" y="85" width="350" height="20" rx="10" fill="#484b4e"/><rect x="130" y="85" width="${Math.min(Math.max(350 * (xp / reqXp), 25), 350)}" height="20" rx="10" fill="#3ba55d"/><text x="480" y="75" fill="#ccc" font-size="16" font-family="Arial" text-anchor="end">${xp} / ${reqXp} xp</text><text x="150" y="130" fill="#ccc" font-size="18" font-family="Arial">Coins: ${coins} | Messages: ${totalmessages}</text></svg>`;
    const renderer = new Resvg(rankCardSvg, { font: { loadSystemFonts: true } });
    const rankCardBuffer = Buffer.from(renderer.render().asPng());
    return await interaction.reply({ files: [new AttachmentBuilder(rankCardBuffer, { name: 'rankcard.png' })] });
});
commands.set('blacklist.show', async (interaction: ChatInputCommandInteraction) => {
    const { guildId, options } = interaction;
    const target = options.getUser('target', true)
    const { embed } = await buildBlacklistEmbed(target, guildId!);
    return await interaction.reply({ embeds: [embed] })
});
commands.set('blacklist.modify', async (interaction: ChatInputCommandInteraction) => {
    const { guildId, options } = interaction;
    const action = options.getString('action', true)
    const target = options.getUser('target', true)
    const role = options.getRole('role', true)
    const { embed, blacklist } = await buildBlacklistEmbed(target, guildId!);
    switch (action) {
        case 'add':
            if (!blacklist.includes(role.id)) {
                await Promise.all([
                    usersCollection.updateOne({ userId: target, guildId: guildId }, { $push: { blacklist: role } as any }),
                    client.rest.delete(Routes.guildMemberRole(guildId!, target.id!, role.id))
                ])
                embed.setDescription(`<@&${role}> was blacklisted from <@${target!}>`);
            } else {
                embed.setDescription(`<@&${role}> is already blacklisted from <@${target!}>`);
            }
            break;
        case 'remove':
            await usersCollection.updateOne({ userId: target!, guildId: guildId }, { $pull: { blacklist: role } as any });
            embed.setDescription(`<@&${role}> was removed from <@${target!}>'s blacklist`);
            break;
    }
    return await interaction.reply({ embeds: [embed] });
});
commands.set('apply', async (interaction: ChatInputCommandInteraction) => {
    const { member, guildId } = interaction;
    const doc = await usersCollection.findOne({ userId: member?.user.id, guildId: guildId }, { projection: { application: 1 } }) as any;
    return await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: buildApplicationHub(doc?.application ?? {}, PART_CONFIG) })
});
commands.set('leaderboard', async (interaction) => {
    const { guildId, guild } = interaction;
    const board = await usersCollection.find({ guildId: guildId }).sort({ level: -1, xp: -1 }).limit(10).toArray();
    const embed = new EmbedBuilder({
        title: `Most active in ${guild!.name}`,
        color: 0x0c23a3,
        description: `**__LeaderBoard:__**\n${board.map((u, i) => `Rank \`${i + 1}\`: <@${u.userId}> - level \`${u.level}\` with \`${u.xp}\` xp`).join('\n')}`
    })
    embed.setThumbnail(guild?.iconURL() ?? null);
    return await interaction.reply({ embeds: [embed] })
});
commands.set('modlogs', async (Interaction) => {
    const { member, guildId, options, memberPermissions, user, guild } = Interaction;
    const targetUser = options.getUser('target', true);
    const isAdmin = memberPermissions!.has(PermissionFlagsBits.Administrator) || user.id == guild?.ownerId
    const { punishments } = await usersCollection.findOne({ userId: targetUser.id, guildId: guildId }, { projection: { punishments: 1 } }) as any;
    if (!punishments?.length) {
        return Interaction.reply({ embeds: [{ color: 0xf58931, description: `❌ No modlogs found for <@${targetUser!.id}>.` }] })
    }
    const moderator = await client.users.fetch(punishments[0].moderatorId);
    await Interaction.reply(buildModlogView(punishments, 0, targetUser, moderator, member!.user.id, isAdmin));
    setTimeout(() => {
        void Interaction.editReply({ components: buildModlogView(punishments, 0, targetUser, moderator, member!.user.id, isAdmin, true).components }).catch(() => null);
    }, 600000);
});
commands.set('note.add', async (interaction) => {
    const { member, guildId, options, } = interaction;
    const note = options.getString('note', true)
    const targetUser = options.getUser('target', true)
    const result = await usersCollection.updateOne(
        { userId: targetUser.id, guildId: guildId },
        { $push: { notes: { _id: new ObjectId(), moderatorId: member?.user.id, note, timestamp: Date.now() } } as any },
    );
    if (!result.matchedCount) {
        return await interaction.reply({ embeds: [notice(`❌ No record found for <@${targetUser.id}>.`)], flags: MessageFlags.Ephemeral })
    }
    const container = new ContainerBuilder()
        .setAccentColor(0x00a900)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder({ content: `📝 note created for <@${targetUser.id}>\n\n${quote(note!)}` }))
                .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: targetUser.avatarURL() ?? targetUser.defaultAvatarURL } })),
        );
    return await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] })
});
commands.set('note.show', async (interaction) => {
    const { member, guildId, options } = interaction;
    const u = options.getUser('target', true)
    const doc = await usersCollection.findOne({ userId: u.id, guildId: guildId }, { projection: { notes: 1 } });
    const sortednotes: any[] = [...(doc?.notes ?? [])].sort((a, b) => b.timestamp - a.timestamp);
    if (!sortednotes.length) {
        return await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00a900).setDescription(`❌ No notes found for <@${u!.id}>`).setThumbnail(u.avatarURL() ?? null).toJSON()] })
    }
    const mod = await client.users.fetch(sortednotes[0].moderatorId);
    return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [buildNoteView(sortednotes, 0, u!, mod, member!.user.id)] })
});
commands.set('applications', async (interaction, guildConfig) => {
    const { modChannels } = guildConfig as Document
    const decision = interaction.options.getString('decision', true)
    switch (decision) {
        case 'open':
            await client.rest.put(Routes.channelPermission(modChannels.applyChannel, "1463354464747524136"), { body: { type: 0, allow: "2147484672", deny: "0" } })
            break;
        case 'close':
            await client.rest.put(Routes.channelPermission(modChannels.applyChannel, "1463354464747524136"), { body: { type: 0, allow: "0", deny: "2147484672", } })
            await usersCollection.updateMany({ guildId: interaction.guildId }, { $set: { application: {} } });
            break;
    }
    return await interaction.reply({ embeds: [ephemeral(decision == 'closed' ? 'Apps have now been closed!' : 'Apps have now been opened!')] })
});
commands.set('member.mute', async (interaction: ChatInputCommandInteraction, guildConfig: WithId<Document>) => {
    const blocked = await withGuards(interaction, guildConfig);
    if (blocked) return blocked;
    runPunishment(interaction, guildConfig).catch(console.error);
    return await interaction.deferReply()
})
commands.set('member.create', async (interaction) => {
    const { options, guildId } = interaction;
    const targetUser = options.getUser('target', true)
    if (targetUser!.bot) return ephemeral('Bot accounts do not get member records.');
    const targetMember = await interaction.guild!.members.fetch(targetUser.id);
    if (!targetMember) return ephemeral('That user is not a member of this server.');
    const result = await usersCollection.updateOne(
        { userId: targetUser!.id, guildId: interaction.guildId },
        {
            $setOnInsert: {
                userId: targetUser!.id,
                guildId: guildId,
                level: 1,
                coins: 100,
                xp: 0,
                totalmessages: 0,
                punishments: [],
                notes: [],
                blacklist: [],
                total: 0,
                mediaCount: 0,
                duplicateCounts: {},
                timestamps: [],
                lastmessage: null,
                verified: false
            }
        },
        { upsert: true }
    );
    return await interaction.reply({ embeds: [ephemeral(result.upsertedCount ? `Created a member record for <@${targetUser!.id}>.` : `<@${targetUser!.id}> already has a member record; nothing was changed.`)] })
});
commands.set('member.ban', async (interaction, guildConfig, restrictedToFullMod = true) => {
    const blocked = await withGuards(interaction, guildConfig, restrictedToFullMod);
    if (blocked) return blocked;
    runPunishment(interaction, guildConfig);
    return await interaction.deferReply()
});
commands.set('member.warn', async (interaction, guildConfig) => {
    const blocked = await withGuards(interaction, guildConfig)
    if (blocked) return blocked;
    runPunishment(interaction, guildConfig)
    return await interaction.deferReply()
});
commands.set('member.unwarn', async (interaction, guildConfig, restrictedToFullMod = true) => {
    const blocked = await withGuards(interaction, guildConfig, restrictedToFullMod)
    if (blocked) return blocked;
    const target = interaction.options.getUser('target', true)
    const { punishments } = await usersCollection.findOne({ userId: target.id, guildId: interaction.guildId }, { projection: { punishments: 1 } }) as Document;
    const removed = punishments?.filter((p: any) => p.type === 'Warn').sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
    if (removed) { await usersCollection.updateOne({ userId: target, guildId: interaction.guildId }, { $pull: { punishments: { _id: removed._id } } as any }); }
    return await interaction.reply({ embeds: [notice(removed ? `Recent warn removed from <@${target}>` : `no recent warns found for <@${target}>`)] })
})
commands.set('member.unmute', async (interaction, guildConfig, restrictedToFullMod = true) => {
    await withGuards(interaction, guildConfig, restrictedToFullMod)
    const { options } = interaction
    const target = options.getUser('target', true)
    const member = await interaction.guild!.members.fetch(target.id);
    if (member!.isCommunicationDisabled())
        await member.timeout(null);
    return await interaction.reply({ embeds: [notice(member!.isCommunicationDisabled() ? '⚠️ User has been unmuted.' : '⚠️ User is not muted.')] })

})
commands.set('member.kick', async (interaction, guildConfig, restrictedToFullMod = true) => {
    const blocked = await withGuards(interaction, guildConfig, restrictedToFullMod);
    if (blocked) return blocked;
    runPunishment(interaction, guildConfig).catch(console.error);
    return await interaction.deferReply()
})
commands.set('link', async (interaction) => {
    const { member, options, guildId } = interaction;
    const channel = options.getString('channel', true)
    const twitchUser = await apiClient.users.getUserByName(channel!)
    if (!twitchUser) return await interaction.reply({ embeds: [ephemeral(`No Twitch channel found for \`${channel}\`.`)] })
    await usersCollection.updateOne({ userId: member?.user.id, guildId: guildId }, { $set: { twitchChannelId: twitchUser.id, twitchChannelLogin: twitchUser.name } });
    await interaction.reply({ embeds: [ephemeral(`Level Linked to Twitch channel ${bold(twitchUser.displayName)}.`)] })
});
commands.set('admin.clear', async (interaction) => {
    const { channel, options } = interaction
    const count = options.getInteger('count', true);
    if (count > 1 && channel instanceof TextChannel) {
        await (channel).bulkDelete(count, true)
        return await interaction.reply({ content: `Deleted ${count} messages.`, flags: MessageFlags.Ephemeral, })
    }
})
void syncTwitchConfigs().catch(error => console.error('[twitch] initial config sync failed', error));
async function grantDiscordXp(member: GuildMember, channel: TextChannel) {
    const guildId = member.guild.id;
    const levelUp = await awardXp({ userId: member.user.id, guildId: guildId }, guildId);
    if (!levelUp) return;
    if (levelUp.level > 2 && !member.roles.cache.has('1334238580914131026') && guildId === '1231453115937587270') {
        await member.roles.add('1334238580914131026');
    }

    await channel.send({
        embeds: [{
            author: { name: member.user.username, icon_url: member.user.avatarURL() ?? member.user.defaultAvatarURL },
            color: 0x00AE86,
            footer: { text: `${member.user.username} reached level ${levelUp.level}! You are now #${levelUp.rank + 1} in the server` },
        }]
    });
}
let massban = 0;
async function getReactionRoleConfig(guildId: string, messageId: string) {
    const doc = await guildconfigs.findOne({ guildId }, { projection: { messageConfigs: 1 } });
    if (!doc) return null
    return Object.values(doc?.messageConfigs ?? {}).find((info: any) => info?.messageId === messageId) as { reactions: { emoji: string; roleId: string | string[] }[] } | undefined;
}
cron("0 0 * * 0", async () => {
    const list = await usersCollection.find({ level: 1, totalmessages: 0, guildId: '1231453115937587270' }, { projection: { userId: 1, _id: 0 } }).toArray()
    const ids = list.flatMap(doc => doc.userId)
    for (const userId of ids) {
        try {
            await client.rest.delete(Routes.guildMember('1231453115937587270', userId))
            await sleep(750);
        }
        catch (error) {
            console.warn(`[inactive users] Could not remove ${userId}; they may no longer be in the guild`, error)
        }
    }
    await usersCollection.deleteMany({ guildId: '1231453115937587270', userId: { $in: ids } })
})
let presenceInterval: NodeJS.Timeout;
function startStatusLoop() {
    clearInterval(presenceInterval);
    presenceInterval = setInterval(() => {
        client.user?.setPresence({
            activities: [{
                name: `for ${Math.floor(client.uptime! / 86400000)}d ${Math.floor((client.uptime! / 3600000) % 24)}h ${Math.floor((client.uptime! / 60000) % 60)}m ${Math.floor((client.uptime! / 1000) % 60)}s`,
                type: ActivityType.Watching,
            }],
            status: PresenceUpdateStatus.Online,
            afk: false,
        });
    }, 5000);
}
client.on('clientReady', async (ready) => {
    console.info('[Gateway] Ready')
    startStatusLoop();
    await usersCollection.updateMany(
        { "punishments": { $elemMatch: { "active": 1, "timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } } } },
        { $set: { "punishments.$[elem].active": 0 } },
        { arrayFilters: [{ "elem.active": 1, "elem.timestamp": { $lt: Date.now() - 24 * 60 * 60 * 1000 } }] }
    );
    for (const guild of ready.guilds.cache.values()) {
        const { id, ownerId, invites } = guild
        if (!await guildconfigs.findOne({ guildId: id })) continue;
        const guildinvites = await invites.fetch();
        await guildconfigs.updateOne({ guildId: id }, { $set: { ownerId: ownerId, Invites: Object.fromEntries(guildinvites.map(i => [i.code, { uses: i.uses, id: i.inviter!.id, code: i.code }])) } })
    }
})
client.on('autoModerationActionExecution', async (action) => {
    const { guild, channel, ruleId, user, member } = action;
    const { level, punishments } = await usersCollection.findOne({ userId: user!.id, guildId: guild.id }, { projection: { level: 1, punishments: 1 } }) as Document;
    const { automodsettings: { automodreasonsandweights }, Stages, modChannels } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { automodsettings: 1, Stages: 1, modChannels: 1 } }) as Document;
    let totalWeight = automodreasonsandweights[ruleId].Weight;
    let reason = `AutoMod: ${automodreasonsandweights[ruleId].reason}`;
    if (level < 3) { totalWeight += 1; reason += ' while new to the server.'; }
    const bannable = level < 3 && (totalWeight >= 3 || punishments.length > 2);
    const activeWarns = punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0);
    const totalWarns = activeWarns + (!bannable ? totalWeight : 1);
    const { minutes, label } = Stages[Math.min(totalWarns - 1, Stages.length - 1)];
    let warnType = bannable ? 'Ban' : 'Warn';
    let durationMs = 0, durationStr: string | null = null;
    if (warnType === 'Warn' && minutes > 0) {
        durationMs = minutes * 60000;
        durationStr = minutes >= 60 ? `${Math.ceil(minutes / 60)} hour mute` : `${minutes} min mute`;
        warnType = 'Mute';
    }
    const finalMessage = await (channel! as TextChannel).send({
        embeds: [{
            author: {
                name: `${user!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : `${statusMap[warnType]?.cmd}`}`,
                icon_url: user?.avatarURL() ?? user?.defaultAvatarURL
            },
            color: statusMap[warnType]!.color,
        }]
    })
    const object = new ObjectId();
    const newPunishment = {
        _id: object, userId: user!.id, moderatorId: '1420927654701301951', reason,
        duration: durationMs, timestamp: Date.now(), active: 1,
        weight: !bannable ? totalWeight : 1, type: warnType, channel: channel!.id,
        refrence: `https://discord.com/channels/${guild.id}/${channel!.id}/${finalMessage.id}`,
        warns: isFinite(totalWarns) ? totalWarns - 1 : 0
    };
    await usersCollection.updateOne({ userId: user!.id, guildId: guild.id }, { $push: { punishments: newPunishment as any } }, { upsert: true });
    const caseHistory = [...punishments, newPunishment]
        .filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick')
        .slice(0, 10)
        .map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null)
        .filter(Boolean);
    let dm = true
    const container = new ContainerBuilder()
        .setAccentColor(statusMap[warnType]!.color)
        .addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder({
                content: `<@${user!.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${guild.name}](https://discord.com/channels/${guild.id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${guild.name}` : `in ${guild.name}`}`
            }))
            .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: guild.iconURL()! } })))
        .addTextDisplayComponents(new TextDisplayBuilder(
            {
                content: `Reason: \`${reason}\` ${(['Ban', 'Kick'].includes(warnType)) ? '' : `Punishment: \`${isFinite(totalWeight) ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nActive Warnings:\`${totalWarns}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`}`
            }
        ))
    if (warnType == 'Ban')
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder({ content: 'Click on the right side/below to go to the server:' }))
                .setButtonAccessory(new ButtonBuilder({ type: ComponentType.Button as const, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }))
        )

    try { user!.send({ flags: MessageFlags.IsComponentsV2, components: [container.toJSON()] }) }
    catch { dm = false; }
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId: guild.id }, { $set: { Ban: user!.id } });
            await guild.bans.create(user!.id, { deleteMessageSeconds: 604800, reason: `Ban Command: ${reason}` });
            break;
        case 'Mute':
            await member?.timeout(Math.min(durationMs, 2419200000), reason);
            break;
        case 'Kick':
            await member?.kick(reason);
            break;
    }
    await client.rest.post(Routes.channelMessages(warnType === 'Ban' ? modChannels.banlogChannel : modChannels.mutelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: statusMap[warnType]!.color,
                components: [{
                    type: ComponentType.Section,
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: client.user?.avatarURL() ?? client.user?.defaultAvatarURL }
                    },
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `febot ${statusMap[warnType]!.log}\n\nuser: <@${user!.id}>  Channel:<#${channel!.id}>  History: ${caseHistory.join(' | ')} || "none"\n\nReason: \`${reason}\`\n\n ${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${isFinite(totalWeight) ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nWarns at log time: \`${activeWarns}\`\nNext Punishment: \`${label}\`\n\n ${dm ? 'User DMed ✅' : 'User DMed 🚫'}`}`
                    }]
                }]
            }]
        }
    });
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => { await usersCollection.updateOne({ userId: user!.id, guildId: guild.id }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] }); }, 86400000);
    }
});
client.on('guildCreate', async (guild) => {
    const { id, ownerId } = guild
    const existing = await guildconfigs.findOne({ guildId: id });
    if (!existing) {
        await guildconfigs.insertOne(
            {
                guildId: id,
                modChannels: {
                    mutelogChannel: "",
                    deletedlogChannel: "",
                    welcomeChannel: "",
                    updatedlogChannel: "",
                    namelogChannel: "",
                    banlogChannel: "",
                    appealChannel: "",
                    applicationChannel: "",
                    adminChannel: "",
                    applyChannel: "",
                    voicelogChannel: ""
                },
                publicChannels: {},
                generalchannels: [],
                ownerId: ownerId,
                reactions: {},
                automodsettings: { messagereasonsandweights: {}, automodreasonsandweights: {}, Duplicatespamthreshold: 3, mediathreshold: 1, messagethreshold: 10, spamthreshold: 4, capsthreshold: 0.7 },
                responses: {},
                staffroles: [],
                Invites: [],
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
    };
    const guildinvites = await guild.invites.fetch();
    await guildconfigs.updateOne({ guildId: id }, { $set: { ownerId: ownerId, Invites: Object.fromEntries(guildinvites.map(i => [i.code, { uses: i.uses, inviter: i.inviter!.id, code: i.code }])) } })
    const owner = await guild.fetchOwner()
    const embed = new ContainerBuilder()
        .setAccentColor(0xf03030)
        .addTextDisplayComponents(new TextDisplayBuilder({ content: `Hello <@${owner}>, thank you for adding febot to your sever, be sure to setup your config in the [dashboard]{${process.env.DISCORD_REDIRECT}.` }))
    await owner.user.send({ flags: MessageFlags.IsComponentsV2, components: [embed] })
})
client.on('guildDelete', async (guild) => {
    await usersCollection.deleteMany({ guildId: guild.id })
    await guildconfigs.findOneAndDelete({ guildId: guild.id })
})
client.on('guildMemberAdd', async (member) => {
    const { guild, user, flags } = member;
    const { modChannels: { welcomeChannel, mutelogChannel }, generalchannels, Invites } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1, staffroles: 1, generalchannels: 1, Invites: 1 } }) as Document;
    const currentInvites = await guild.invites.fetch();
    const invite = currentInvites.find((i: any) => i.uses > (Invites[i.code]?.uses || 0)) ?? Object.values(Invites)?.find((i: any) => !currentInvites.get(i!.code!)) as DbInvite ?? undefined;
    const inviter: string | undefined | { uses: number; id: string; code: string } = invite instanceof Invite ? invite?.inviter?.id : invite && invite satisfies DbInvite ? invite!.id : undefined;
    const channel = await client.channels.fetch(welcomeChannel)
    const originalMessage = await (channel as TextChannel).send({
        allowedMentions: { "parse": [] },
        flags: MessageFlags.IsComponentsV2,
        components: [
            new ContainerBuilder()
                .setAccentColor(0x00FF99)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `<@${user.id}> joined the Server!\n\nDiscord Join Date: <t:${Math.floor(user.createdTimestamp / 1000)}>` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.avatarURL() ?? user.defaultAvatarURL } }))
                )
                .addSeparatorComponents(new SeparatorBuilder({ spacing: SeparatorSpacingSize.Large }))
                .addTextDisplayComponents(new TextDisplayBuilder({ content: subtext(`${invite instanceof Invite || (invite && invite satisfies DbInvite) ? `Invited by: <@${inviter}> | ${invite?.code}` : 'No Invite'}`) }))
                .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder({ style: ButtonStyle.Danger, custom_id: `ban_${user.id}_${invite instanceof Invite && inviter ? invite?.code : 'none'}`, label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}` })))
        ]
    }) 
    if (Date.now() - user.createdTimestamp < 172800000) {
        await member.kick('Account less than 2 days old');
        const channel = await guild.channels.fetch(mutelogChannel) as TextChannel
        await channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `A member was auto-kicked \n\n**User:**<@${user.id}>\n\n**Reason:**New Account\n** Created:** <t:${user.createdTimestamp}:R>\n\n**Created on:**<t:${Math.floor(user.createdTimestamp / 1000)}:R>` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.avatarURL() ?? user.defaultAvatarURL } }))
                )]
        })
        return;
    }
    try {
        await user.send({
            flags: MessageFlags.IsComponentsV2,
            components: [new ContainerBuilder()
                .setAccentColor(0x00FF99)
                .addTextDisplayComponents(new TextDisplayBuilder({ content: `Welcome to the server ${user}!\n\nBe sure to check out the rules and grab some roles in the role channel.` }))]
        })
    } catch { }
    if (!flags.has(GuildMemberFlags.DidRejoin) && !user.bot) {
        await usersCollection.insertOne({
            userId: user.id,
            guildId: guild.id,
            level: 1,
            coins: 100,
            xp: 0,
            totalmessages: 0,
            punishments: [],
            notes: [],
            blacklist: [],
            total: 0,
            mediaCount: 0,
            duplicateCounts: {},
            timestamps: [],
            lastmessage: null,
            verified: false
        })
    } else {
        if (guild.id == "1231453115937587270")
            await member.roles.add(`1463354464747524136`)
        const channel = await guild.channels.fetch(generalchannels[0]!) as TextChannel
        channel?.send({
            flags: MessageFlags.IsComponentsV2,
            components: [new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `Everyone, Welcome <@${user.id}> back to the server!\n\nDiscord Join Date: <t:${Math.floor(user.createdTimestamp / 1000)}>` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.avatarURL() ?? user.defaultAvatarURL } }))
                )]
        })
    }
    setTimeout(async () => {
        originalMessage.edit({
            allowedMentions: { "parse": [] },
            flags: MessageFlags.IsComponentsV2,
            components: [new ContainerBuilder()
                .setAccentColor(0x00FF99)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `<@${user.id}> joined the Server!\n\nDiscord Join Date: <t:${Math.floor(user.createdTimestamp / 1000)}>` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.avatarURL() ?? user.defaultAvatarURL } })),
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: subtext(`${invite ? `Invited by: <@${inviter}> | ${invite?.code}` : 'No Invite'}`) }))
                        .setButtonAccessory(new ButtonBuilder({
                            style: ButtonStyle.Danger,
                            custom_id: `ban_${user.id}_${invite && inviter ? invite?.code : 'none'}`,
                            label: `🔨 ${invite ? `Ban & Delete Invite` : 'Ban'}`,
                            disabled: true
                        }))
                )]
        })
        }, 15 * 60 * 1000)

})
client.on('guildMemberRemove', async (member) => {
    const { user, guild } = member;
    if (user.bot) { return }
    if (member.user.id == client.user!.id) {
        await guildconfigs.deleteOne({ guildId: guild.id });
        await usersCollection.deleteMany({ guildId: guild.id });
    }
    const { modChannels: { welcomeChannel } } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    await client.rest.post(Routes.channelMessages(welcomeChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2, components: [{
                type: ComponentType.Container, components: [{
                    type: ComponentType.Section,
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `<@${user.id}> left the server.\n\nJoined ${guild.name}: <t:${Math.floor(member.joinedTimestamp! / 1000)}>`
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: user.avatarURL() ?? user.defaultAvatarURL }
                    }
                }]
            }]
        }
    })
})
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const { guild, user, nickname } = newMember;
    const { modChannels: { namelogChannel } } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    if (!oldMember || nickname === oldMember.nickname || newMember.user.username == nickname) return;
    await client.rest.post(Routes.channelMessages(namelogChannel), {
        body: {
            flags: MessageFlags.IsComponentsV2,
            components: [{
                type: ComponentType.Container,
                accent_color: 0x4e85b6,
                components: [{
                    type: ComponentType.Section,
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `< @${user.id} > ** changed their nickname **\n\n ** Before:**\n${oldMember.nickname}\n\n ** After:**\n${newMember.nickname ?? user.username}`
                    }],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: { url: newMember.user.avatarURL() ?? newMember.user.defaultAvatarURL }
                    }
                }]
            }]

        }
    })
})
client.on('guildBanAdd', async (ban) => {
    const { user, guild } = ban;
    let dmed = true;
    await sleep(250);
    const { Ban, modChannels: { banlogChannel } } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { Ban: 1, modChannels: 1 } }) as Document
    if (Ban === user.id) { await guildconfigs.updateOne({ guildId: guild.id }, { $set: { Ban: '' } }); return; }
    else {
        massban += 1;
        const { punishments } = await usersCollection.findOne({ guildId: guild.id, userId: user.id }, { projection: { punishments: 1 } }) as Document
        const sortedpunishments = punishments.filter((p: any) => p.type === "Ban").sort((a: any, b: any) => b.timestamp - a.timestamp)
        await sleep(massban * 1000)
        try {
            await user.send({
                flags: MessageFlags.IsComponentsV2,
                components: [new ContainerBuilder()
                    .setAccentColor(0xd10000)
                    .addSectionComponents(
                        new SectionBuilder()
                            .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: guild.iconURL()! } }))
                            .addTextDisplayComponents(new TextDisplayBuilder({ content: `${user.username}, you were banned from [${guild.name}](https://discord.com/channels/${guild.id}).\n\n\nTo appeal this decision, please join our dedicated appeal server using the button below.\nReason: \`${sortedpunishments[0].reason}\`` })),
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder({ content: "Click the button below/on the right to go to the Server:" }))
                            .setButtonAccessory({ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' })
                    )]
            })
        } catch { dmed = false }
        const channel = guild.channels.cache.get(banlogChannel) as TextChannel;
        channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [new ContainerBuilder()
                .setAccentColor(0xff3030)
                .addSectionComponents(
                    new SectionBuilder()
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: guild.iconURL()! } }))
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `Mass Ban Detected\n**Moderator <@${sortedpunishments[0].moderatorId}> banned <@${user.id}>:\n\nID: <@${user.id}>\n\n**TAG:**${user.username}\n\n**Reason:**\`${sortedpunishments[0].reason}\`\n\n-# ${dmed ? 'User DMed ✅' : 'User Dmed ❌'}` }))
                )]
        })
        massban -= 1;
    }
})
client.on('guildBanRemove', async (ban) => {
    const { user, guild, reason } = ban
    const { modChannels: { banlogChannel } } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    const channel = guild.channels.cache.get(banlogChannel) as TextChannel;
    await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [
            new ContainerBuilder()
                .setAccentColor(0x309eff)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `A member was unbanned\n\n**User**: <@${user.id}>\n**Tag**:\`${user.username}\`\n**Reason**:\`${reason}\`` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.avatarURL() ?? user.defaultAvatarURL } }))
                )]
    })
})
client.on('inviteCreate', async (invite) => {
    await guildconfigs.updateOne({ guildId: invite.guild!.id }, { $set: { [`Invites.${invite.code}`]: { uses: invite.uses, inviter: invite.inviter!.id, code: invite.code } } });
})
client.on('inviteDelete', async (invite) => {
    await guildconfigs.updateOne({ guildId: invite.guild!.id }, { $unset: { [`Invites.${invite.code}`]: "" } });
})
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) reaction = await reaction.fetch();
    const { message: { guild, id, }, emoji } = reaction;
    if (!guild) return;
    const config = await getReactionRoleConfig(guild.id, id);
    if (!config) return;
    const { reactions } = config;
    const entry = reactions.find(e => e.emoji === emoji.id || e.emoji == emoji.name);
    if (!entry) return;
    const roleIds = Array.isArray(entry.roleId) ? entry.roleId : [entry.roleId];
    const userDoc = await usersCollection.findOne({ userId: user.id, guildId: guild.id }, { projection: { blacklist: 1 } });
    if (userDoc?.blacklist?.length && roleIds.some(id => userDoc.blacklist.includes(id))) {
        await reaction.users.remove(user.id).catch(() => { }); // optional: un-react so it doesn't look like it worked
        return;
    }
    const member = guild.members.cache.get(user.id);
    await member!.roles.add(roleIds);
});
client.on('messageReactionRemove', async (reaction, user) => {
    const { message: { guild, id }, emoji } = reaction;
    if (!guild || user.bot) return;
    const config = await getReactionRoleConfig(guild.id, id);
    if (!config) return;
    const entry = config.reactions.find(entry => entry.emoji === (emoji.id! ?? emoji.name!));
    if (!entry || !config) return;
    const roleIds = Array.isArray(entry.roleId) ? entry.roleId : [entry.roleId];
    const member = guild.members.cache.get(user.id);
    await Promise.all(roleIds.map(id => member!.roles.remove(id)));
})
client.on('messageDelete', async (deletedData) => {
    const { id, channelId, guildId, stickers, attachments, author, content } = deletedData;
    if (deletedData.partial || !author || author.bot) return;
    const imageAttachments = attachments.filter(att => att.contentType?.startsWith('image/')).map(att => att.proxyURL);
    const { modChannels: { deletedlogChannel } } = await guildconfigs.findOne({ guildId }, { projection: { modChannels: 1 } }) as Document;
    const container = new ContainerBuilder()
        .setAccentColor(0xf03030)
        .addSectionComponents({
            type: ComponentType.Section,
            components: [{
                type: ComponentType.TextDisplay, content: `Message by ${author.username} was deleted in <#${channelId}>\n\n${content || 'No text content'}`
            }],
            accessory: { type: ComponentType.Thumbnail, media: { url: author.avatarURL() ?? author.defaultAvatarURL } }
        })
    if (stickers.size > 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder({ content: 'stickers deleted:' }))
        container.addMediaGalleryComponents(new MediaGalleryBuilder({ items: [{ media: { url: stickers.first()!.url } }] }))
    }
    if (imageAttachments.length > 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder({ content: 'Images deleted:' }))
        container.addMediaGalleryComponents(new MediaGalleryBuilder({ items: imageAttachments.map(url => ({ media: { url } })) }));
    }
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>({ components: [new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guildId}/${channelId}/${id}`).setLabel('Event link')] }))
    await client.rest.post(Routes.channelMessages(deletedlogChannel), { body: { flags: MessageFlags.IsComponentsV2, components: [container] } })
})
client.on('messageUpdate', async (oldMessage, newMessage) => {
    const { author, id, channelId, content, guildId, guild } = newMessage;
    if (!oldMessage.content || oldMessage.content == newMessage.content || oldMessage.author?.bot) return;
    const { modChannels: { updatedlogChannel } } = await guildconfigs.findOne({ guildId: newMessage.guildId }, { projection: { modChannels: 1 } }) as Document
    const channel = guild?.channels.cache.get(updatedlogChannel) as TextChannel
    await channel.send({
        allowedMentions: { parse: [] },
        flags: MessageFlags.IsComponentsV2,
        components: [
            new ContainerBuilder()
                .setAccentColor(0x309eff)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `<@${author!.id}> edited a message in <#${channelId}>\n\n **Before:**\n${oldMessage.content || ''}\n\n **After:**\n${content || ''}` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: author.avatarURL() ?? author.defaultAvatarURL } }))
                )
                .addActionRowComponents(
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(new ButtonBuilder({
                            type: ComponentType.Button, style: ButtonStyle.Link,
                            label: 'Event Link',
                            url: `https://discordapp.com/channels/${guildId}/${channelId}/messages/${id}`
                        })))]
    })
})
client.on('messageCreate', async (message) => {
    const { author, member, content, attachments, type, mentions, guild, channel } = message;
    if (author.bot == true || !guild || type === MessageType.ChatInputCommand || type === MessageType.UserJoin) return;
    const { publicChannels: { countingChannel }, responses, staffroles, generalchannels, automodsettings: { messagereasonsandweights, messagethreshold, Duplicatespamthreshold, mediathreshold, spamthreshold, capsthreshold }, count, lastMessageId, lastuser, Stages, modChannels: { banlogChannel, mutelogChannel } } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { publicChannels: 1, responses: 1, staffroles: 1, mediaexclusions: 1, automodsettings: 1, count: 1, lastuser: 1, baseMultiplier: 1, lastMessageId: 1, exponent: 1, flatOffset: 1, roundToNearest: 1, generalchannels: 1, Stages: 1, modChannels: 1 } }) as Document
    const isstaff = member?.roles.cache.some((role: Role) => staffroles.includes(role.id)) || author.id == guild.ownerId
    const hasMedia = (attachments.size > 0 || /https?:\/\/[^\s]+/i.test(content)) && generalchannels.includes(channel.id)
    let messageWords: string = '!';
    let changed: boolean = false
    if (channel.id == countingChannel) {
        if (!/^\d+$/.test(content) || message.id === lastMessageId) return;
        await guildconfigs.findOneAndUpdate({ guildId: guild.id }, (count + 1 == parseInt(content) && lastuser !== author.id) ? { $inc: { count: 1 }, $set: { lastuser: author.id, lastMessageId: message.id } } : { $set: { count: 0, lastuser: null, lastMessageId: null } })
        try {
        return (count + 1 == parseInt(content) && lastuser !== author.id) ?
            await message.react("%E2%9C%85") : await message.reply({ content: `<@${author.id}> missed or already counted!` })
        } catch (error) {
            console.error(`[counting] Could not react to message ${message.id}`, error)
        }
    }
    if (content.length >= 1) {
        const stripped = content.replace(/<a?:\w+:\d+>|[\-!$.,?_\\*#()\[\]{}\+:;='"`~/|^&]/g, '');
        if (stripped.length > 0) { messageWords = stripped; changed = true; }
        const lowerwords = messageWords.toLowerCase()
        const reactionsToApply = [];
        for (const [trigger, text] of Object.entries(responses))
            if (lowerwords.includes(trigger))
                    await message.reply(text as string)
            if (lowerwords.includes('bad') && lowerwords.includes('bot'))
                reactionsToApply.push('😡')
            if (lowerwords.includes('857445139416088647'))
                reactionsToApply.push(encodeURIComponent('SaltyEyes:1257522749635563561'))
            if (lowerwords.includes('gay'))
                reactionsToApply.push('🏳️‍🌈')
            for (const emoji of reactionsToApply)
                await message.react(emoji);
    }
    const key = createHash('md5').update(messageWords).digest('hex')
    const capsRatio = messageWords.length > 20 ? (messageWords.match(/[A-Z]/g)?.length ?? 0) / messageWords.length : 0;
    const { automodMarks, punishments, level } = await usersCollection.findOneAndUpdate(
        { userId: author.id, guildId: guild.id }, [
        {
            $set: {
                previoustime: { $ifNull: ["$lastmessage", 0] },
                markDuplicateSpam: {
                    $gt: [
                        { $add: [{ $ifNull: [`$duplicateCounts.${key}`, 0] }, changed ? 1 : 0] }
                        , Duplicatespamthreshold]
                },
                markMessageThreshold: { $gte: [{ $add: ["$total", 1] }, messagethreshold] },
                markInactive30: { $gte: [{ $subtract: [Date.now(), { $ifNull: ["$lastmessage", 0] }] }, 1800000] },
                markMediaViolation: { $and: [hasMedia, { $gt: [{ $add: ["$mediaCount", hasMedia ? 1 : 0] }, mediathreshold] }, { $lt: [{ $add: ["$total", 1] }, messagethreshold] }] },
                markGeneralSpam: {
                    $gt: [
                        {
                            $size: {
                                $filter: {
                                    input: { $concatArrays: [{ $ifNull: ["$timestamps", []] }, [Date.now().toString()]] },
                                    cond: { $lt: [{ $subtract: [Date.now(), { $toLong: "$$this" }] }, 8000] }
                                }
                            }
                        },
                        spamthreshold
                    ]
                }
                }
            },
            { $set: { isModReset: { $or: ["$markDuplicateSpam", "$markMessageThreshold", "$markInactive30"] } } },
            {
                $set: {
                    totalmessages: { $add: [{ $ifNull: ["$totalmessages", 0] }, 1] },
                    total: { $cond: ["$isModReset", 0, { $add: ["$total", 1] }] },
                    mediaCount: { $cond: ["$isModReset", 0, { $add: ["$mediaCount", hasMedia ? 1 : 0] }] },
                    duplicateCounts: { $cond: ["$isModReset", {}, changed ? { $mergeObjects: ["$duplicateCounts", { [key]: { $add: [{ $ifNull: [`$duplicateCounts.${key}`, 0] }, 1] } }] } : "$duplicateCounts"] },
                    timestamps: { $slice: [{ $concatArrays: ["$timestamps", [Date.now().toString()]] }, -15] },
                    lastmessage: Date.now()
                }
            },
        {
            // marks assigned from the pre-reset booleans captured in stage 1, untouched by stage 3's reset
            $set: { automodMarks: { everyonePing: mentions.everyone, duplicateSpam: "$markDuplicateSpam", mediaViolation: "$markMediaViolation", generalspam: "$markGeneralSpam", capSpam: capsRatio > capsthreshold } }
        },
        { $unset: ["isModReset", "markDuplicateSpam", "markMessageThreshold", "markInactive30", "markMediaViolation", "markGeneralSpam"] }
    ], { returnDocument: 'after', projection: { automodMarks: 1, punishments: 1, level: 1 }, upsert: true }) as Document;
    await grantDiscordXp(member!, channel as TextChannel);
    const isNewUser = Date.now() - member?.joinedTimestamp! < 2 * 24 * 60 * 60 * 1000 && level < 3
    if (isstaff) return;
    if (mentions.everyone) await message.delete();
    const activeChecks = Object.keys(messagereasonsandweights).filter((key: string) => automodMarks[key]).map(key => ({ ...messagereasonsandweights[key] })) as Array<{ reason: string, Weight: number }>;
    let totalWeight = activeChecks.reduce((acc, check) => acc + check.Weight, 0) as number;
    if (totalWeight == 0) return;
    await usersCollection.updateOne({ guildId: guild.id, userId: member!.user.id }, {
        $set: { 'automodMarks.everyonePing': false, 'automodMarks.duplicateSpam': false, 'automodMarks.mediaViolation': false, 'automodMarks.generalspam': false, 'automodMarks.capSpam': false }
    })
    let reasonText = `AutoMod: ${activeChecks.map(check => check.reason).join('; ')}`;
    if (isNewUser) { totalWeight += 1; reasonText += ' while new to the server.'; }
    const bannable = isNewUser && (totalWeight >= 3 || mentions.everyone)

    const activeWarns = punishments.length > 0 ? punishments.filter((p: any) => p.active === 1).reduce((acc: number, cur: any) => acc + (cur.weight || 1), 0) : 0;
    const totalWarns = activeWarns + totalWeight;
    const { minutes, label } = Stages[Math.min(totalWarns > 0 ? totalWarns - 1 : 0, Stages.length - 1)];
    const object = new ObjectId();
    let warnType = bannable ? 'Ban' : 'Warn';
    let durationMs = 0, durationStr = null;
    if (warnType === 'Warn' && minutes > 0) {
        durationMs = minutes * 60000;
        durationStr = minutes >= 60 ? `${Math.ceil(minutes / 60)} hour mute` : `${minutes} min mute`;
        warnType = 'Mute';
    }
    const finalMessage = await channel.send({
        embeds: [{
            author: {
                name: `${member!.user!.username} ${warnType === 'Mute' ? `was issued a ${durationStr}` : `${statusMap[warnType]?.cmd}`}`,
                icon_url: member!.user?.avatarURL() ?? member!.user?.defaultAvatarURL
            },
            color: statusMap[warnType]!.color,
        }]
    });
    const newPunishment = { _id: object, userId: author.id, moderatorId: '1420927654701301951', reasonText, duration: durationMs, timestamp: Date.now(), active: 1, weight: !bannable ? totalWeight : 1, type: warnType, guildId: guild.id, channel: channel.id, refrence: `https://discord.com/channels/${guild.id}/${channel.id}/${finalMessage.id}`, warns: isFinite(totalWarns) ? totalWarns - 1 : 0 };
    await usersCollection.updateOne({ userId: author.id, guildId: guild.id }, { $push: { punishments: newPunishment as any } });
    const caseHistory = [...punishments, newPunishment].filter((r: any) => warnType === 'Ban' ? r.type === "Ban" : r.type !== 'Kick').slice(0, 10).map((p: any, idx: number) => p.refrence ? `[Case ${idx + 1}](${p.refrence})` : null).filter(Boolean);
    let dm = true;
    const container = new ContainerBuilder()
        .setAccentColor(statusMap[warnType]!.color)
        .addSectionComponents(
            new SectionBuilder()
                .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: message.guild?.iconURL()! } }))
                .addTextDisplayComponents(new TextDisplayBuilder({ content: `<@${author.id}>,${statusMap[warnType]!.dm} ${warnType === 'Ban' ? ` [${message.guild!.name}](https://discord.com/channels/${guild.id}). To appeal this decision, please join our dedicated appeal server using the button below.` : warnType === 'Mute' ? `\`${durationStr}\` in ${message.guild!.name}` : `in ${message.guild!.name}`}\n\nReason: \`${reasonText}\` ${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${isFinite(totalWeight) ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nActive Warnings: \`${totalWarns}\`\nWarn expires: <t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`}` })))
    if (warnType === 'Ban')
        container
            .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(new ButtonBuilder({ type: ComponentType.Button, style: ButtonStyle.Link, label: "Appeal", url: 'https://discord.gg/qMjjyXyYbr' }))) 
    try {
        await author.send({
            flags: MessageFlags.IsComponentsV2,
            components: [container]
        })
    } catch { dm = false; }
    switch (warnType) {
        case 'Ban':
            await guildconfigs.updateOne({ guildId: guild.id }, { $set: { Ban: author.id } });
            await guild?.bans.create(author.id, { deleteMessageSeconds: 604800, reason: `Ban Command: ${reasonText}` })
            break;
        case 'Mute':
            await member!.timeout(Math.min(durationMs, 2419200000), reasonText)
            break;
        case 'Kick':
            await member?.kick(reasonText)
            break;
    }
    const logchannel = guild.channels.cache.get(warnType === 'Ban' ? banlogChannel : mutelogChannel) as TextChannel
    logchannel.send({
        flags: MessageFlags.IsComponentsV2, components: [{
            type: ComponentType.Container, accent_color: statusMap[warnType]!.color, components: [{
                type: ComponentType.Section,
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `<@${client.user?.id}> ${statusMap[warnType]!.log}\n\n user:<@${author.id}>\nChannel:<#${channel.id}>\nHistory: ${caseHistory.join(' | ') || "none"}\n\nReason:  \`${reasonText}\`\n${['Ban', 'Kick'].includes(warnType) ? '' : `Punishment: \`${isFinite(totalWeight) ? totalWeight : 1} warn\`${durationStr ? `, \`${durationStr}\`` : ''}\nWarns at log time: \`${activeWarns}\`\nNext Punishment: \`${label}\`\n\n${subtext(dm ? 'User DMed ✅' : 'User DMed 🚫')}`}`
                }],
                accessory: {
                    type: ComponentType.Thumbnail,
                    media: { url: author.avatarURL() ?? author.defaultAvatarURL }
                }
            }]
        }]
    })
    if (['Warn', 'Mute'].includes(warnType)) {
        setTimeout(async () => {
            await usersCollection.updateOne({ userId: author.id, guildId: guild.id }, { $set: { "punishments.$[elem].active": 0 } }, { arrayFilters: [{ "elem._id": object }] });
        }, 86400000);
    }
});
client.on('voiceStateUpdate', async (oldState, newState) => {
    const { guild, channelId, member } = newState;
    const { modChannels: { voicelogChannel } } = await guildconfigs.findOne({ guildId: guild.id }, { projection: { modChannels: 1 } }) as Document
    if (oldState.channelId === channelId) return;
    const channel = guild.channels.cache.get(voicelogChannel) as TextChannel
    channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [
            new ContainerBuilder()
                .setAccentColor(channelId !== null ? 0x305830 : 0x8b0000)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: channelId !== null ? `${member?.user.username} joined <#${channelId}>.` : `${member?.user.username} left <#${oldState.channelId}>` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: member!.user.avatarURL() ?? member!.user.defaultAvatarURL } }))
                )]
    })
})
client.on('guildUpdate', async (oldGuild, newGuild) => {
    const { ownerId } = await guildconfigs.findOne({ guildId: oldGuild.id }, { projection: { ownerId: 1 } }) as Document;
    if (newGuild.ownerId == ownerId) return;
    else await guildconfigs.updateOne({ guildId: newGuild.id }, { $set: { ownerId: newGuild.ownerId } })
})
client.on('shardError', async (err, shardId) => {
    console.error(`[root] Shard ${shardId} error`, err)
})
client.on('shardDisconnect', async (event, shardId) => {
    console.info(`[root] Shard ${shardId} disconnected. Code: ${event.code}`)
})
client.on('shardResume', async (shardId, replayedEvents) => {
    console.info(`[root] Shard ${shardId} resumed, replayed ${replayedEvents} events`)
})
client.on('interactionCreate', async (interaction) => {
    if (interaction.isModalSubmit()) {
        const { guildId, customId, member, fields, user } = interaction;
        const updates: Record<string, any> = {};
        if (customId.startsWith('appeal')) {
            const targetGuild = fields.getField('guild', ComponentType.StringSelect)
            const reason = fields.getField('reason', ComponentType.TextInput)
            const justification = fields.getField('justification', ComponentType.TextInput)
            const extra = fields.getField('extra', ComponentType.TextInput)
            const gConf = await guildconfigs.findOne({ guildId: targetGuild }, { projection: { staffroles: 1, modChannels: 1 } }) as any;
            const attachments = fields.getUploadedFiles('evidence');
            const channel = await client.channels.fetch(gConf.modChannels.appealChannel);
            const container = new ContainerBuilder()
                .setAccentColor(0x13cbd8)
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder({ content: `Appeal for <@${member?.user.id}>\n\nWhy did you get banned?\n${reason.value}\n\nWhy should we accept your appeal?\n${justification!.value}\n\nExtra info:\n${extra!.value || "None"}` }))
                        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.avatarURL() ?? user.defaultAvatarURL } }))
                )
            if (attachments)
                container.addMediaGalleryComponents(new MediaGalleryBuilder({ items: Object.values(attachments).map((i: any) => ({ media: { url: i.url } })) }))
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(new ButtonBuilder({ custom_id: `unban_approve_${member?.user.id}`, label: 'Approve', style: ButtonStyle.Success }), new ButtonBuilder({ type: ComponentType.Button, custom_id: `unban_reject_${member?.user.id}`, label: 'Reject', style: ButtonStyle.Danger })
                    ))
            const appealMsg = await (channel as TextChannel)!.send({
                    flags: MessageFlags.IsComponentsV2,
                components: [
                    new TextDisplayBuilder({ content: `<@&${gConf.staffroles[0]}> <@&${gConf.staffroles[1]}>` }),
                    container
                ]
            })
            const messagechannel = appealMsg.channel as TextChannel;
            await messagechannel.threads.create({ name: `${member?.user.username}` })
            await usersCollection.updateOne({ userId: member?.user.id, guildId: targetGuild }, { $set: { appeals: { _id: new ObjectId(), reason: reason!.value, justification: justification!.value, extra: extra!.value } } });
            return await interaction.reply({ content: 'Your appeal has been submitted!', flags: MessageFlags.Ephemeral })
        }
        else if (customId.startsWith('apply-modal-')) {
            const part = Number(customId.split('-')[2]);
            const config = PART_CONFIG[part];
            if (!config) return;
            const modalComponents = config.modal.toJSON().components as any[];
            modalComponents.forEach((label, index) => {
                const component = label.component;
                const dbKey = config.fields[index];
                if (!component?.custom_id || !dbKey) return;
                const value = component.type === ComponentType.StringSelect
                    ? interaction.fields.getStringSelectValues(component.custom_id)[0]
                    : interaction.fields.getTextInputValue(component.custom_id);
                if (value !== undefined) updates[`application.${dbKey}`] = value;
            });
            if (Object.keys(updates).length) {
                await usersCollection.updateOne({ userId: member?.user.id, guildId }, { $set: updates });
            }
            const doc = await usersCollection.findOne({ userId: member?.user.id, guildId: guildId }, { projection: { application: 1 } }) as any;
            return await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: buildApplicationHub(doc?.application ?? {}, PART_CONFIG) })
        }
    }
    if (interaction.isButton()) {
        const { guildId, member, customId, memberPermissions, channel, message, user, guild } = interaction
        const { modChannels, appealInvite, generalchannels } = await guildconfigs.findOne({ guildId: guildId }, { projection: { modChannels: 1, appealInvite: 1, generalchannels: 1 } }) as Document
        const isAdmin = memberPermissions?.has(PermissionFlagsBits.Administrator) || user.id == guild?.ownerId
        if (customId.startsWith('ban_')) {
            const [, targetId, inviteCode] = customId.split('_');
            if (memberPermissions!.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ embeds: [ephemeral('jrs cannot use this button.')] })
            const targetUser = await client.users.fetch(targetId!)
            await guildconfigs.updateOne({ guildId: guildId }, { $set: { Ban: targetUser.id } });
            const doc = await usersCollection.findOne({ userId: targetUser!.id, guildId: guildId }, { projection: { punishments: 1 } });
            const punishments: any[] = doc?.punishments;
            const finalMessage = await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xd10000).setAuthor({ name: `<@${targetUser.id}> was banned`, iconURL: targetUser.avatarURL() ?? targetUser.defaultAvatarURL }).toJSON()] })
            const newPunishment = { _id: new ObjectId(), userId: targetUser.id, moderatorId: member!.user.id, reason: 'troll', duration: 0, timestamp: Date.now(), active: 1, weight: 1, type: 'Ban', guildId, channel: channel!.id, refrence: `https://discord.com/channels/${guildId}/${channel!.id}/${finalMessage.id}`, warns: 1 };
            await usersCollection.updateOne({ userId: targetUser.id, guildId: guildId }, { $push: { punishments: newPunishment as any } });
            const caseHistory = [...punishments, newPunishment].filter(r => r.type === 'Ban').slice(0, 10)
                .map((p, i) => p.refrence ? `[Case ${i + 1}](${p.refrence})` : null).filter(Boolean);
            let dm = true;
            try {
                const dmContainer = new ContainerBuilder()
                    .setAccentColor(0xd10000)
                    .addSectionComponents(new SectionBuilder({ components: [{ type: ComponentType.TextDisplay, content: `<@${targetUser.id}>, you were banned from [${guild?.name}](https://discord.com/channels/${guildId}). To appeal this decision, please join our dedicated appeal server using the button below.\n${bold('Reason:')} ${quote('troll')}` }], accessory: { type: ComponentType.Thumbnail, media: { url: guild?.iconURL()! } } }))
                    .addSeparatorComponents(new SeparatorBuilder({ spacing: SeparatorSpacingSize.Small }))
                    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>({ components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: 'Apeal', url: 'https://discord.gg/qMjjyXyYbr' }] }));
                targetUser.send({ flags: MessageFlags.IsComponentsV2, components: [dmContainer] })
            } catch { dm = false; }
            await guild?.bans.create(targetUser.id, { reason: 'Ban Command: troll', deleteMessageSeconds: 604800 });
            const logchannel = guild?.channels.cache.get(modChannels.banlogChannel) as TextChannel
            await logchannel.send({
                flags: MessageFlags.IsComponentsV2,
                components: [new ContainerBuilder()
                    .setAccentColor(0xd10000)
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder({ content: `${member!.user.username} banned a member\n\nuser: <@${targetUser.id}>\nChannel: <#${channel!.id}>\nHistory: ${caseHistory.join(' | ') || 'none'}\nReason: Troll\n\n${subtext(dm ? 'User DMed ✅' : 'User DMed 🚫')}` }))
                            .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: targetUser.avatarURL() ?? targetUser.defaultAvatarURL } }))
                    )
                ]
            })
            if (inviteCode !== 'none') await guild?.invites.delete(inviteCode!);
            const pushedbutton = message.resolveComponent(customId) as ButtonComponent;
            message.components[3]!.components =
                ButtonBuilder
                    .from(pushedbutton.toJSON())
                    .setLabel(inviteCode !== 'none' ? '🔨 Banned & Invite Deleted!' : '🔨 Banned!').toJSON();
            return await interaction.update({ flags: MessageFlags.IsComponentsV2, components: message.components });
        }
        else if (customId.startsWith('unban_')) {
            const [, action, userId] = customId.split('_');
            const approved = action === 'approve';
            const color = approved ? 0x008900 : 0x890000;
            const targetUser = await client.users.fetch(userId!);
            const doc = await usersCollection.findOne({ userId, guildId: guildId }, { projection: { appeals: 1 } });
            const appeals = doc?.appeals;
            if (!appeals) return ephemeral('I could not find any appeal entries');
            if (!memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
                await client.rest.post(Routes.channelMessages(modChannels.adminChannel), { body: { embeds: [notice(`Letting you know <@${member?.user.id}> tried to jump the gun on an appeal.`)] } });
                return ephemeral('Please wait for an admin to make a decision.');
            }
            if (!approved) await usersCollection.deleteOne({ userId, guildId: guildId }); // wipes the whole doc
            else {
                await guild?.bans.remove(userId!);
                await usersCollection.updateOne({ userId, guildId: guildId }, { $set: { appeals: {} } });
            }
            try {
                await targetUser.send({
                    embeds: [new EmbedBuilder().setColor(color).setDescription(
                        approved ? `<@${userId}> your ban appeal has been accepted! click below to rejoin the server!\n\n invite: ${appealInvite}` : `<@${userId}> your ban appeal has been denied.`,
                    ).toJSON()]
                });
            } catch { /* DMs closed */ }
            const gallery = message.components.filter(component => component.type == ComponentType.MediaGallery)[0]
            const container = new ContainerBuilder()
                .setAccentColor(color)
                .addSectionComponents(new SectionBuilder({ components: [{ type: ComponentType.TextDisplay, content: `## Ban appeal: ${approved ? 'Approved' : 'Denied'}\n**Why did you get banned?**\n${appeals.reason}\n\n**Why accept appeal?**\n${appeals.justification}\n\n**Extra info**\n${appeals.extra || 'None'}` }], accessory: { type: ComponentType.Thumbnail, media: { url: targetUser.avatarURL() ?? targetUser.defaultAvatarURL } } }));
            if (gallery) container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(gallery.items.map(i => ({ media: { url: i.media.url } }))),
            );
            container.addTextDisplayComponents(new TextDisplayBuilder({ content: subtext(`${approved ? 'Approved' : 'Denied'} by <@${member!.user.id}> | User ID: ${userId}`) }));
            return await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [container] })
        }
        else if (customId.startsWith('apply-part-')) {
            const part = Number(customId.split('-')[2]);
            return await interaction.showModal(PART_CONFIG[part]!.modal.toJSON())
        }
        else if (customId === 'apply-submit') {
            const doc = await usersCollection.findOne({ userId: member?.user.id, guildId: guildId }, { projection: { application: 1 } });
            const application = doc?.application ?? {};
            const APP_FIELDS: [string, string][] = [
                ['Age Range:', 'Agerange'], ['Prior Experience:', 'Experience'], ['History:', 'History'], ['Timezone:', 'Timezone'],
                ['Server Activity:', 'Activity'], ['Why mod?:', 'why'], ['Troll definition:', 'Trolldef'], ['Raid definition:', 'Raiddef'],
                ['Staff issues action:', 'Staffissues'], ['Member report action:', 'Memberreport'],
                ['Harassment via DM response:', 'dmmember'], ['General chat argument step:', 'arguments'],
                ['Rulebreaking DM response:', 'rulebreakdm'], ['Mod breaking rules step:', 'staffrulebreak'], ['Illegal content step:', 'illegal'],
            ];
            const embed = new EmbedBuilder({
                color: 0x13b6df,
                title: 'Mod Application',
                author: { name: `@${member!.user.username}`, iconURL: user.avatarURL() ?? user.defaultAvatarURL },
                fields: APP_FIELDS.map(([name, key]) => ({ name, value: String(application[key]).slice(0, 1024) })),
                timestamp: Date.now()
            })
            await client.rest.post(Routes.channelMessages(modChannels.applicationChannel), { body: { embeds: [embed.toJSON()] } });
            await usersCollection.updateOne({ userId: member?.user.id, guildId: guildId }, { $set: { application: {} } });
            const message = await interaction.update({
                flags: MessageFlags.IsComponentsV2,
                components: [new ContainerBuilder({
                    accent_color: 0x2ecc71,
                    components: [new TextDisplayBuilder({ content: '## Application submitted!\nThanks for applying — the mod team will review it soon.' }).setContent('## Application submitted!\nThanks for applying — the mod team will review it soon.').toJSON()]
                })]
            })
            setTimeout(async () => { await message.delete() }, 60_000);

        }
        else if (customId.startsWith('note-') || customId.startsWith('modlog-')) {
            const isNote = customId.startsWith('note-');
            const [, action, target, index, opener, itemId] = customId.split('-');
            if (member!.user.id !== opener) return interaction.reply({ embeds: [ephemeral('You did not initiate this command')] });
            const targetUser = await client.users.fetch(target!)
            let idx = parseInt(index!);
            if (action === 'del') {
                const itemObjId = ObjectId.createFromHexString(itemId!);
                if (isNote) {
                    const found = await usersCollection.findOne({ userId: target, guildId: guildId, 'notes._id': itemObjId }, { projection: { 'notes.$': 1 } });
                    const note = found?.notes?.[0];
                    if (note && !isAdmin && Date.now() - note.timestamp >= 172_800_000) return ephemeral('Contact an admin, deletion time expired.');
                    if (note) await usersCollection.updateOne({ userId: target, guildId: guildId }, { $pull: { notes: { _id: itemObjId } } as any });
                } else {
                    await usersCollection.updateOne({ userId: target, guildId: guildId }, { $pull: { punishments: { _id: itemObjId } } as any });
                }
                idx = Math.max(0, idx - 1);
            } else {
                idx = Math.max(0, action === 'next' ? idx + 1 : idx - 1);
            }

            if (isNote) {
                const doc = await usersCollection.findOne({ userId: target, guildId: guildId }, { projection: { notes: 1 } });
                const notes: any[] = [...(doc?.notes ?? [])].sort((a, b) => b.timestamp - a.timestamp);
                if (!notes.length) {
                    return await interaction.update({
                        flags: MessageFlags.IsComponentsV2,
                        components: [new ContainerBuilder().setAccentColor(0xdddddd).addTextDisplayComponents(new TextDisplayBuilder({ content: 'All notes deleted.' }).setContent('All notes deleted.'))]
                    })
                }
                idx = Math.min(idx, notes.length - 1);
                const mod = await client.users.fetch(notes[idx].moderatorId);
                return await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [buildNoteView(notes, idx, targetUser, mod, opener!)] })
            } else {
                const doc = await usersCollection.findOne({ userId: target, guildId: guildId }, { projection: { punishments: 1 } });
                const logs: any[] = doc?.punishments ?? [];
                if (!logs.length) {
                    return await interaction.reply({ embeds: [notice('All logs deleted.')], components: [] })
                }
                idx = Math.min(idx, logs.length - 1);

                const mod = await client.users.fetch(logs[idx].moderatorId);
                return await interaction.update(buildModlogView(logs, idx, targetUser, mod, opener!, isAdmin!))
            }
        }
        else if (customId.startsWith('logos')) {
            const pushedbutton = message.resolveComponent(customId) as ButtonComponent
            const logo = customId.slice(`logos-${pushedbutton.label}-`.length);
            const actionRow = message.components[0];
            if (!actionRow || actionRow.type !== ComponentType.ActionRow) return;
            const buttons = actionRow.components.filter((component): component is ButtonComponent => component.type === ComponentType.Button);
            const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.map(button =>
                ButtonBuilder.from(button.toJSON()).setDisabled(true).setStyle(
                    button.customId === customId
                        ? pushedbutton.label === logo ? ButtonStyle.Success : ButtonStyle.Danger
                        : ButtonStyle.Secondary
                )
            ));
            if (pushedbutton.label === logo) await usersCollection.findOneAndUpdate({ userId: member?.user.id, guildId: guildId }, { $inc: { coins: 20 } });
            return await interaction.update({ components: [updatedRow] })
        }
        else if (customId.startsWith('ttt-')) {
            const [, boardStr, player1, player2, currentplayer, index] = customId.split('-');
            if (member?.user.id !== currentplayer) return interaction.reply({ embeds: [ephemeral("It's not your turn.")], flags: MessageFlags.Ephemeral }) 
            const board = boardStr!.split('');
            const marker = currentplayer === player1 ? 'X' : 'O';
            board[parseInt(index!)] = marker;
            const win = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].some((c: number[]) => c.every((i: number) => board[i] === marker));
            const tie = !win && board.every((c: string) => c !== '_');
            if (win || tie) {
                if (win) await usersCollection.findOneAndUpdate({ userId: currentplayer, guildId: guildId }, { $inc: { coins: 100 } });
                setTimeout(() => { message.delete(); }, 10000);
            }
            const rows = [0, 1, 2].map(i =>
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    [0, 1, 2].map(j => {
                        const index = i * 3 + j;
                        const cell = board[index]!;
                        return new ButtonBuilder({
                            custom_id: `ttt-${board.join('')}-${player1}-${player2}-${nextPl}-${index}`,
                            label: cell === '_' ? '\u200b' : cell,
                            style: cell === 'X' ? ButtonStyle.Primary : cell === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary,
                            disabled: cell !== '_' || win || tie
                        })
                    }),
                ),
            );
            const nextPl = currentplayer === player1 ? player2 : player1;
            return await interaction.update({
                flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder()
                    .setAccentColor(win ? 0xceab10 : tie ? 0x555555 : 0x0000ff)
                    .addTextDisplayComponents(new TextDisplayBuilder({ content: `${bold('TicTacToe')}\n${win ? `<@${currentplayer}> wins!` : tie ? "It's a draw!" : `It's <@${nextPl}> turn!`}` }))
                    .addActionRowComponents(rows)]
            })
        }
        else if (customId.startsWith('highlow-')) {
            const [, choice, startNum, secretNum, streakNum, potNum, prevMin, prevMax] = customId.split('-');
            if (choice === 'cashout') {
                const pot = parseInt(startNum!);
                await usersCollection.updateOne({ userId: member?.user.id, guildId: customId }, { $inc: { coins: pot } });
                return await interaction.reply({
                    embeds: [{ color: 0x2ecc71, title: 'Cashed Out 💰', description: `You walked away with **${pot}** coins. Smart move, or was it?` }],
                    components: [],
                });
            } else {
                const start = parseInt(startNum!), secret = parseInt(secretNum!), streak = parseInt(streakNum!), pot = parseInt(potNum!);
                const won = (choice === 'higher' && secret > start) || (choice === 'lower' && secret < start);
                if (won) {
                    const winProbability = Math.max(choice === 'higher' ? (parseInt(prevMin!) - start) : (start - parseInt(prevMin!)), 1) / (parseInt(prevMax!) - parseInt(prevMin!));
                    const gained = Math.round(8 / winProbability);
                    const { min, max } = rangeForStreak(streak + 1);
                    const newStart = min + Math.ceil(Math.random() * (max - min));
                    let newSecret = min + Math.ceil(Math.random() * (max - min));
                    const row = new ActionRowBuilder<ButtonBuilder>({
                        components: [
                            new ButtonBuilder({ custom_id: `highlow-higher-${newStart}-${newSecret}-${streak + 1}-${pot + gained}-${min}-${max}`, label: 'Higher', style: ButtonStyle.Primary }),
                            new ButtonBuilder({ custom_id: `highlow-lower-${newStart}-${newSecret}-${streak + 1}-${pot + gained}-${min}-${max}`, label: 'Lower', style: ButtonStyle.Danger }),
                            new ButtonBuilder({ custom_id: `highlow-cashout-${pot}`, label: `Cash Out (${pot})`, style: ButtonStyle.Success })
                        ]
                    })
                    while (newSecret === newStart) newSecret = min + Math.ceil(Math.random() * (max - min));
                    return await interaction.update({
                        embeds: [{
                            title: `Correct! (Streak: ${streak + 1})`,
                            color: 0xc79c0f,
                            description: `📉 Range tightening — this round's number is between **${min}** and **${max}**.`,
                            fields: [{ name: 'Current Number:', value: `${newStart}` }],
                        }],

                        components: [row],
                    })
                } else {
                    if (streak === 0) await usersCollection.updateOne({ userId: member?.user.id, guildId: guildId }, { $inc: { coins: -10 } });
                    return interaction.update({
                        embeds: [{ color: 0x870000, title: 'You Lost! 💀', description: `The number was **${secret}**.\n(Guess was ${choice} than ${start})\n\nYou lost a pot of **${pot}** coins. 💸` }],
                        components: [],
                    })
                }
            }
        }
        else if (customId.startsWith('verify')) {
            if (Date.now() - (member as GuildMember)!.joinedTimestamp! < ((Math.random() + 5) * 1000)) {
                await user.send({
                    embeds: [{
                        author: { name: user.username, icon_url: user.avatarURL() ?? user.defaultAvatarURL },
                        description: `Hi <@${user.id}>, your interaction speed with the verification system was too fast for a typical human and was flagged for an auto kick.\n\nYou are free to rejoin the server through a new or public invite.`
                    }]
                })
                await guild?.members.kick(user.id)
                return;
            }
            await (member as GuildMember)?.roles.add('1463354464747524136');
            const generalchannel = guild?.channels.cache.get(generalchannels[0]) as TextChannel;
            await generalchannel.send({ embeds: [{ description: `Everyone, Welcome <@${member?.user.id}> to the server !\n\n`, thumbnail: { url: user!.avatarURL() ?? user.defaultAvatarURL }, fields: [{ name: 'Discord Join Date:', value: `<t:${user.createdTimestamp / 1000}>`, inline: true }] }] })
            await usersCollection.findOneAndUpdate({ userId: member?.user.id }, { $set: { verified: true } })
            return await user.send({ content: `Welcome to ${guild!.name} <@${member?.user.id}>!! Be sure to grab some roles in the role claim channel!!` });
        }
    }
    if (interaction.isChatInputCommand()) {
        const { options, commandName, member, guildId } = interaction
        const guildConfig = await guildconfigs.findOne({ guildId: guildId }, { projection: { modChannels: 1, publicChannel: 1, staffroles: 1, exponent: 1, baseMultiplier: 1, roundToNearest: 1, flatOffset: 1, Stages: 1 }, });
        const subcommand = options ? options.getSubcommand(false) : null
        const key = subcommand ? `${commandName}.${subcommand}` : commandName;
        const expiry = activeCooldowns.get(`${member!.user.id}.${key}`);
        const handler = commands.get(key);
        if (!handler) return ephemeral(`Unhandled command: ${key}`);
        if (expiry && expiry > Date.now()) {
            return await interaction.reply({ embeds: [notice(`<@${member!.user.id}>, you can use ${subcommand ? key.split('.')[1] : commandName} command again in <t:${Math.floor(expiry / 1000)}:R>`)], flags: MessageFlags.Ephemeral })
        }
        activeCooldowns.set(`${member!.user.id}.${key}`, Date.now() + 3000);
        return await handler(interaction, guildConfig!)
    }
})
client.login(process.env.TOKEN)